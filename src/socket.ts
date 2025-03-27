import WebSocket from 'ws';
import * as logger from './logger.js';
import { getAccessToken } from './auth.js';

// URLs for Tradovate APIs
const URLS = {
  MD_URL: 'wss://md-demo.tradovateapi.com/v1/websocket',
  WS_DEMO_URL: 'wss://demo.tradovateapi.com/v1/websocket',
  WS_LIVE_URL: 'wss://live.tradovateapi.com/v1/websocket'
};

// Helper function for waiting
const waitForMs = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// No operation function
const noop = (): void => {};

// Types
interface TradovateSocketOptions {
  debugLabel?: string;
}

interface SendOptions {
  url: string;
  query?: string;
  body?: Record<string, any>;
  onResponse?: (item: any) => void;
  onReject?: () => void;
}

interface SubscribeOptions {
  url: 'md/getchart' | 'md/subscribedom' | 'md/subscribequote' | 'md/subscribehistogram' | 'user/syncrequest';
  body: Record<string, any>;
  subscription: (item: Record<string, any>) => void;
}

interface ResponseMessage {
  e?: string;
  d?: any;
  i: number;
  s: number;
}

type Listener = (data: any) => void;
type UnsubscribeFunction = () => void;

// Connection status enum
enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error'
}

/**
 * WebSocketManager - A singleton class to manage global WebSocket connections
 * This allows tools to access already authenticated WebSockets without blocking
 */
export class WebSocketManager {
  private static instance: WebSocketManager;
  private marketDataSocket: TradovateSocket | null = null;
  private tradingSocket: TradovateSocket | null = null;
  private mdStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private tradingStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private connectPromises: {
    md: Array<{ resolve: Function, reject: Function }>;
    trading: Array<{ resolve: Function, reject: Function }>;
  } = { md: [], trading: [] };

  private constructor() {
    // Private constructor to enforce singleton pattern
    this.initializeConnections();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Initialize connections without blocking
   * This starts connections in the background
   */
  private async initializeConnections() {
    // Start both connections non-blocking
    this.connectToMarketData();
    this.connectToTrading();
  }

  /**
   * Connect to market data socket in background
   */
  private async connectToMarketData() {
    if (this.mdStatus === ConnectionStatus.CONNECTING || 
        this.mdStatus === ConnectionStatus.AUTHENTICATING) {
      return; // Already connecting
    }
    
    this.mdStatus = ConnectionStatus.CONNECTING;
    
    try {
      logger.info('Connecting to Market Data WebSocket in background...');
      const { accessToken } = await getAccessToken();
      
      this.marketDataSocket = new TradovateSocket({ debugLabel: 'market-data' });
      this.mdStatus = ConnectionStatus.AUTHENTICATING;
      
      await this.marketDataSocket.connect(URLS.MD_URL, accessToken);
      
      this.mdStatus = ConnectionStatus.AUTHENTICATED;
      logger.info('Market Data WebSocket connected and authenticated successfully');
      
      // Resolve any pending promises
      this.connectPromises.md.forEach(promise => promise.resolve(this.marketDataSocket));
      this.connectPromises.md = [];
    } catch (error) {
      this.mdStatus = ConnectionStatus.ERROR;
      logger.error('Failed to connect to Market Data WebSocket:', error);
      
      // Reject any pending promises
      this.connectPromises.md.forEach(promise => 
        promise.reject(new Error(`Failed to connect to Market Data WebSocket: ${error}`))
      );
      this.connectPromises.md = [];
      
      // Try to reconnect after delay
      setTimeout(() => {
        this.mdStatus = ConnectionStatus.DISCONNECTED;
        this.connectToMarketData();
      }, 5000);
    }
  }

  /**
   * Connect to trading socket in background
   */
  private async connectToTrading(useLive: boolean = false) {
    if (this.tradingStatus === ConnectionStatus.CONNECTING || 
        this.tradingStatus === ConnectionStatus.AUTHENTICATING) {
      return; // Already connecting
    }
    
    this.tradingStatus = ConnectionStatus.CONNECTING;
    
    try {
      const environment = useLive ? 'live' : 'demo';
      logger.info(`Connecting to Trading WebSocket (${environment}) in background...`);
      const { accessToken } = await getAccessToken();
      
      const url = useLive ? URLS.WS_LIVE_URL : URLS.WS_DEMO_URL;
      this.tradingSocket = new TradovateSocket({ 
        debugLabel: useLive ? 'trading-live' : 'trading-demo' 
      });
      
      this.tradingStatus = ConnectionStatus.AUTHENTICATING;
      await this.tradingSocket.connect(url, accessToken);
      
      this.tradingStatus = ConnectionStatus.AUTHENTICATED;
      logger.info(`Trading WebSocket (${environment}) connected and authenticated successfully`);
      
      // Resolve any pending promises
      this.connectPromises.trading.forEach(promise => promise.resolve(this.tradingSocket));
      this.connectPromises.trading = [];
    } catch (error) {
      this.tradingStatus = ConnectionStatus.ERROR;
      logger.error('Failed to connect to Trading WebSocket:', error);
      
      // Reject any pending promises
      this.connectPromises.trading.forEach(promise => 
        promise.reject(new Error(`Failed to connect to Trading WebSocket: ${error}`))
      );
      this.connectPromises.trading = [];
      
      // Try to reconnect after delay
      setTimeout(() => {
        this.tradingStatus = ConnectionStatus.DISCONNECTED;
        this.connectToTrading(useLive);
      }, 5000);
    }
  }

  /**
   * Get market data socket - returns existing socket or connects if needed
   * This won't block if the socket is already connected
   */
  public getMarketDataSocket(): Promise<TradovateSocket> {
    return new Promise((resolve, reject) => {
      // If already connected, return immediately
      if (this.mdStatus === ConnectionStatus.AUTHENTICATED && this.marketDataSocket) {
        resolve(this.marketDataSocket);
        return;
      }
      
      // Add to queue of promises to resolve when connection completes
      this.connectPromises.md.push({ resolve, reject });
      
      // If not already connecting, start connection
      if (this.mdStatus === ConnectionStatus.DISCONNECTED) {
        this.connectToMarketData();
      }
    });
  }

  /**
   * Get trading socket - returns existing socket or connects if needed
   * This won't block if the socket is already connected
   */
  public getTradingSocket(useLive: boolean = false): Promise<TradovateSocket> {
    return new Promise((resolve, reject) => {
      // If already connected, return immediately
      if (this.tradingStatus === ConnectionStatus.AUTHENTICATED && this.tradingSocket) {
        resolve(this.tradingSocket);
        return;
      }
      
      // Add to queue of promises to resolve when connection completes
      this.connectPromises.trading.push({ resolve, reject });
      
      // If not already connecting, start connection
      if (this.tradingStatus === ConnectionStatus.DISCONNECTED) {
        this.connectToTrading(useLive);
      }
    });
  }

  /**
   * Get the connection status for market data
   */
  public getMarketDataStatus(): ConnectionStatus {
    return this.mdStatus;
  }

  /**
   * Get the connection status for trading
   */
  public getTradingStatus(): ConnectionStatus {
    return this.tradingStatus;
  }

  /**
   * Close all connections
   */
  public closeAll() {
    if (this.marketDataSocket) {
      this.marketDataSocket.close();
      this.marketDataSocket = null;
      this.mdStatus = ConnectionStatus.DISCONNECTED;
    }
    
    if (this.tradingSocket) {
      this.tradingSocket.close();
      this.tradingSocket = null;
      this.tradingStatus = ConnectionStatus.DISCONNECTED;
    }
    
    // Reject any pending promises
    this.connectPromises.md.forEach(promise => 
      promise.reject(new Error('Connection closed'))
    );
    this.connectPromises.md = [];
    
    this.connectPromises.trading.forEach(promise => 
      promise.reject(new Error('Connection closed'))
    );
    this.connectPromises.trading = [];
  }
}

/**
 * A generic implementation for the Tradovate real-time APIs WebSocket client.
 */
export class TradovateSocket {
  private counter: number = 0;
  private curTime: Date = new Date();
  private listeningURL: string = '';
  private debugLabel: string;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private listeners: Listener[] = [];

  constructor(options: TradovateSocketOptions = {}) {
    this.debugLabel = options.debugLabel || 'tvSocket';
  }

  private increment(): number {
    return this.counter++;
  }

  private getCurTime(): Date {
    return this.curTime;
  }

  private setCurTime(t: Date): void {
    this.curTime = t === this.curTime ? this.curTime : t;
  }

  public addListener(listener: Listener): UnsubscribeFunction {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Connect this client socket to one of the Tradovate real-time API URLs.
   * @param url The Tradovate WebSocket URL to use for this client.
   * @param token Your access token, acquired using the REST API.
   * @returns Promise that resolves when connection is established
   */
  public async connect(url: string, token: string): Promise<void> {
    logger.info(`Connecting to Tradovate WebSocket at ${url}...`);
    const self = this;

    return new Promise<void>((res, rej) => {
      // Add timeout for connection
      const connectionTimeout = setTimeout(() => {
        logger.error(`Connection timeout for ${url}`);
        rej(new Error(`Connection timeout for ${url}`));
      }, 30000);

      try {
        this.listeningURL = url;
        this.ws = new WebSocket(url);

        // Long running message handler
        this.ws.addEventListener('message', function onEvents(msg) {
          try {
            self.setCurTime(checkHeartbeats(self.ws as WebSocket, self.getCurTime()));
            const [T, data] = prepareMessage(msg.data.toString());
            
            logger.info(`${self.debugLabel}\n ${T} ${JSON.stringify(data)}`);

            if (T === 'a' && data && data.length > 0) {
              self.listeners.forEach(listener => data.forEach((d: any) => listener(d)));
            }
          } catch (error) {
            logger.error('Error in message handler:', error);
          }
        });

        // Authentication message handler - modified to avoid using send() before connected=true
        this.ws.addEventListener('message', function onConnect(msg) {
          try {
            const [T, _] = prepareMessage(msg.data.toString());
            logger.debug(`Received authentication message: ${T}`);
            if (T === 'o') {
              // Instead of using self.send(), directly send the authorization message
              // This avoids the connected flag check in the send() method
              if (self.ws) {
                const id = self.increment();
                
                // Format the auth message based on whether it's a Tradovate API URL
                // Tradovate URLs contain 'tradovateapi.com' 
                let authMessage: string;
                if (url.includes('tradovateapi.com')) {
                  // Format for Tradovate API - token as proper JSON
                  authMessage = `authorize\n2\n\n${token}`;
                  logger.info(`Sending Tradovate API authorization message with ID ${id}`);
                } else {
                  // Format for MCP server - token as raw string with newline
                  authMessage = `authorize\n2\n\n${token}\n`;
                  logger.info(`Sending MCP authorization message with ID ${id}`);
                }
                
                // Create a one-time message handler for the auth response
                const authResponseHandler = (authMsg: WebSocket.MessageEvent) => {
                  try {
                    logger.debug(`Received auth response: ${authMsg.data.toString()}`);
                    const [_, authData] = prepareMessage(authMsg.data.toString());
                    
                    for (const item of authData) {
                      if (item.i === id) {
                        if (item.s === 200) {
                          // Auth successful
                          logger.info('Authentication successful');
                          if (self.ws) {
                            self.ws.removeEventListener('message', authResponseHandler);
                            self.ws.removeEventListener('message', onConnect);
                          }
                          self.connected = true;
                          clearTimeout(connectionTimeout);
                          res();
                          return;
                        } else {
                          // Auth failed
                          logger.error('Authorization failed:', JSON.stringify(item));
                          if (self.ws) {
                            self.ws.removeEventListener('message', authResponseHandler);
                            self.ws.removeEventListener('message', onConnect);
                          }
                          clearTimeout(connectionTimeout);
                          rej(new Error(`Authorization failed: ${JSON.stringify(item?.d) || 'unknown error'}`));
                          return;
                        }
                      }
                    }
                  } catch (error) {
                    logger.error('Error processing auth response:', error);
                    clearTimeout(connectionTimeout);
                    rej(error);
                  }
                };
                
                self.ws.addEventListener('message', authResponseHandler);
                self.ws.send(authMessage);
              }
            }
          } catch (error) {
            logger.error('Error in onConnect handler:', error);
            clearTimeout(connectionTimeout);
            rej(error);
          }
        });

        // Error handler
        this.ws.addEventListener('error', (error) => {
          logger.error('WebSocket connection error:', error);
          clearTimeout(connectionTimeout);
          rej(error);
        });

        // Close handler
        this.ws.addEventListener('close', (event) => {
          logger.info(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
          self.connected = false;
          // Only reject if we haven't already resolved
          if (!self.connected) {
            clearTimeout(connectionTimeout);
            rej(new Error(`WebSocket closed prematurely. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`));
          }
        });
      } catch (error) {
        logger.error('Error setting up WebSocket connection:', error);
        clearTimeout(connectionTimeout);
        rej(error);
      }
    });
  }

  /**
   * Send a message via an authorized WebSocket. Parameters will depend on the request.
   * @param options Send options including URL, query, body, and callbacks
   * @returns Promise that resolves with the response
   */
  public async send(options: SendOptions): Promise<ResponseMessage> {
    const { url, query, body, onResponse, onReject } = options;
    const self = this;

    if (!this.ws || !this.connected) {
      throw new Error('WebSocket is not connected. Call connect() first.');
    }

    return new Promise<ResponseMessage>((res, rej) => {
      const id = this.increment();
      
      const onEventHandler = (msg: WebSocket.MessageEvent) => {
        const [_, data] = prepareMessage(msg.data.toString());
        
        data.forEach((item: ResponseMessage) => {
          if (item.s === 200 && item.i === id) {
            if (onResponse) {
              onResponse(item);
            }
            if (self.ws) {
              self.ws.removeEventListener('message', onEventHandler);
            }
            res(item);
          } else if (item.s && item.s !== 200 && item.i && item.i === id) {
            logger.error(JSON.stringify(item));
            if (self.ws) {
              self.ws.removeEventListener('message', onEventHandler);
            }
            if (onReject) onReject();
            rej(`\nFAILED:\n\toperation '${url}'\n\tquery ${query ? JSON.stringify(query, null, 2) : ''}\n\tbody ${body ? JSON.stringify(body, null, 2) : ''}\n\treason '${JSON.stringify(item?.d, null, 2) || 'unknown'}'`);
          }
        });
      };

      this.ws?.addEventListener('message', onEventHandler);
      if (this.ws) {
        this.ws.send(`${url}\n${id}\n${query || ''}\n${JSON.stringify(body || {})}`);
      } else {
        throw new Error('WebSocket connection lost');
      }
    });
  }

  /**
   * Creates a subscription to one of the real-time data endpoints. 
   * Returns a Promise of a function that when called cancels the subscription.
   * @param options Subscribe options including URL, body, and subscription callback
   * @returns Promise that resolves with an unsubscribe function
   */
  public async subscribe(options: SubscribeOptions): Promise<UnsubscribeFunction> {
    const { url, body, subscription } = options;
    const self = this;

    let removeListener: UnsubscribeFunction = noop;
    let cancelUrl = '';
    let cancelBody: Record<string, any> = {};
    let contractId: number | null = null;
    
    let response = await this.send({ url, body });

    if (response.d && response.d['p-ticket']) {
      await waitForMs(response.d['p-time'] * 1000);
      let nextResponse = await self.send({
        url, 
        body: { ...body, 'p-ticket': response.d['p-ticket'] }
      });
      response = nextResponse;
    }

    const realtimeId = response?.d?.realtimeId || response?.d?.subscriptionId;
    
    if (body?.symbol && typeof body.symbol === 'string' && !body.symbol.startsWith('@')) {
      // This would normally use tvGet but we're using tradovateRequest instead
      try {
        const contractRes = await import('./auth.js').then(m => 
          m.tradovateRequest('GET', `/contract/find?name=${body.symbol}`)
        );
        contractId = contractRes?.id || null;
        
        if (!contractId) {
          const suggestions = await import('./auth.js').then(m => 
            m.tradovateRequest('GET', `/contract/suggest?name=${body.symbol}`)
          );
          contractId = suggestions[0]?.id;
        }
      } catch (error) {
        logger.error('Error finding contract:', error);
      }
    }

    if (!realtimeId && response.d && response.d.users) {
      // For user sync request's initial response
      subscription(response.d);
    }

    return new Promise<UnsubscribeFunction>((res, rej) => {
      switch (url.toLowerCase()) {
        case 'md/getchart': {
          cancelUrl = 'md/cancelChart';
          cancelBody = { subscriptionId: realtimeId };
          if (this.listeningURL !== URLS.MD_URL) {
            rej('Cannot subscribe to Chart Data without using the Market Data URL.');
            return;
          }
          removeListener = self.addListener(data => {
            if (data.d && data.d.charts) {
              data.d.charts.forEach((chart: any) => 
                chart.id === realtimeId ? subscription(chart) : noop()
              );
            }
          });
          break;
        }
        case 'md/subscribedom': {
          cancelUrl = 'md/unsubscribedom';
          cancelBody = { symbol: body.symbol };
          if (this.listeningURL !== URLS.MD_URL) {
            rej('Cannot subscribe to DOM Data without using the Market Data URL.');
            return;
          }
          removeListener = self.addListener(data => {
            if (data.d && data.d.doms) {
              data.d.doms.forEach((dom: any) => 
                dom.contractId === contractId ? subscription(dom) : noop()
              );
            }
          });
          break;
        }
        case 'md/subscribequote': {
          cancelUrl = 'md/unsubscribequote';
          cancelBody = { symbol: body.symbol };
          if (this.listeningURL !== URLS.MD_URL) {
            rej('Cannot subscribe to Quote Data without using the Market Data URL.');
            return;
          }
          removeListener = self.addListener(data => {
            if (data.d && data.d.quotes) {
              data.d.quotes.forEach((quote: any) => 
                quote.contractId === contractId ? subscription(quote) : noop()
              );
            }
          });
          break;
        }
        case 'md/subscribehistogram': {
          cancelUrl = 'md/unsubscribehistogram';
          cancelBody = { symbol: body.symbol };
          if (this.listeningURL !== URLS.MD_URL) {
            rej('Cannot subscribe to Histogram Data without using the Market Data URL.');
            return;
          }
          removeListener = self.addListener(data => {
            if (data.d && data.d.histograms) {
              data.d.histograms.forEach((histogram: any) => 
                histogram.contractId === contractId ? subscription(histogram) : noop()
              );
            }
          });
          break;
        }
        case 'user/syncrequest': {
          if (this.listeningURL !== URLS.WS_DEMO_URL && this.listeningURL !== URLS.WS_LIVE_URL) {
            rej('Cannot subscribe to User Data without using one of the Demo or Live URLs.');
            return;
          }
          removeListener = self.addListener(data => {
            if ((data?.d?.users) || (data?.e === 'props')) {
              subscription(data.d);
            }
          });
          break;
        }
        default:
          rej('Incorrect URL parameters provided to subscribe.');
          return;
      }

      res(async () => {
        removeListener();
        if (cancelUrl && cancelUrl !== '') {
          await self.send({ url: cancelUrl, body: cancelBody });
        }
      });
    });
  }

  /**
   * Close the WebSocket connection
   */
  public close(): void {
    if (this.ws) {
      logger.info('Closing WebSocket connection...');
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  public isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Check if we need to send a heartbeat
 */
function checkHeartbeats(socket: WebSocket, curTime: Date): Date {
  const now = new Date();  // Time at call of onmessage

  if (now.getTime() - curTime.getTime() >= 2500) {
    socket.send('[]');   // Send heartbeat
    return new Date();   // Set the new base time
  }
  
  return curTime;
}

/**
 * Parse WebSocket message
 */
function prepareMessage(raw: string): [string, any[]] {
  const T = raw.slice(0, 1);
  const data = raw.length > 1 ? JSON.parse(raw.slice(1)) : [];

  return [T, data];
}

/**
 * Create a new socket connection with the Tradovate Market Data API
 * This uses the WebSocketManager to avoid blocking operations
 */
export async function createMarketDataSocket(retryCount = 2): Promise<TradovateSocket> {
  try {
    // Get socket from manager - this won't block if already connected
    const socketManager = WebSocketManager.getInstance();
    return await socketManager.getMarketDataSocket();
  } catch (error) {
    logger.error('Error getting Market Data WebSocket:', error);
    
    // Retry logic
    if (retryCount > 0) {
      logger.info(`Retrying Market Data WebSocket connection (${retryCount} attempts left)...`);
      await waitForMs(2000);
      return createMarketDataSocket(retryCount - 1);
    }
    
    throw new Error(`Failed to get Market Data WebSocket: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a new socket connection with the Tradovate WebSocket API (demo or live)
 * This uses the WebSocketManager to avoid blocking operations
 */
export async function createTradingSocket(useLive: boolean = false, retryCount = 2): Promise<TradovateSocket> {
  try {
    // Get socket from manager - this won't block if already connected
    const socketManager = WebSocketManager.getInstance();
    return await socketManager.getTradingSocket(useLive);
  } catch (error) {
    logger.error('Error getting Trading WebSocket:', error);
    
    // Retry logic
    if (retryCount > 0) {
      logger.info(`Retrying Trading WebSocket connection (${retryCount} attempts left)...`);
      await waitForMs(2000);
      return createTradingSocket(useLive, retryCount - 1);
    }
    
    throw new Error(`Failed to get Trading WebSocket: ${error instanceof Error ? error.message : String(error)}`);
  }
} 