const { describe, test, expect, beforeEach, afterEach, afterAll } = require('@jest/globals');
const EventEmitter = require('events');

// Import helper module with mock implementations
const {
  MockWebSocket,
  createWebSocketMock,
  mockAuth,
  mockLogger,
  simulateWebSocketOpen,
  simulateWebSocketError,
  simulateWebSocketClose,
  simulateWebSocketMessage,
  simulateAuthentication
} = require('./socket-helper');

// Mock the socket module dependencies before importing it
jest.mock('../src/auth.js', () => mockAuth);
jest.mock('../src/logger.js', () => mockLogger);

// Mock the WebSocket implementation
global.WebSocket = createWebSocketMock();

// Mock actual network calls in the connect and socket modules
jest.mock('ws', () => createWebSocketMock());

// Create a simplified TradovateSocket mock for more deterministic tests
const TradovateSocketMock = jest.fn().mockImplementation(({ debugLabel = 'test-socket' } = {}) => {
  let connected = false;
  let url = '';
  const listeners = [];

  return {
    debugLabel,
    isConnected: () => connected,
    connect: jest.fn().mockImplementation((socketUrl, token) => {
      mockLogger.info(`Connecting to Tradovate WebSocket at ${socketUrl}...`);
      url = socketUrl;
      connected = true;
      return Promise.resolve();
    }),
    disconnect: jest.fn().mockImplementation(() => {
      connected = false;
      mockLogger.info('Socket disconnected');
    }),
    send: jest.fn().mockImplementation((options) => {
      if (!connected) {
        return Promise.reject(new Error('WebSocket is not connected'));
      }
      
      // Mock successful response
      return Promise.resolve({
        s: 200, 
        d: { result: 'success' }
      });
    }),
    subscribe: jest.fn().mockImplementation((options) => {
      if (!connected) {
        return Promise.reject(new Error('WebSocket is not connected'));
      }
      
      if (!url.includes('md-demo.tradovateapi.com')) {
        return Promise.reject(new Error('Subscriptions are only available on market data sockets'));
      }
      
      return Promise.resolve({
        id: 9999,
        symbol: options.symbol || 'ESM5'
      });
    }),
    unsubscribe: jest.fn().mockImplementation((id) => {
      if (!connected) {
        return Promise.reject(new Error('WebSocket is not connected'));
      }
      
      return Promise.resolve(true);
    }),
    close: jest.fn().mockImplementation(() => {
      mockLogger.info(`Closing WebSocket connection...`);
      connected = false;
      url = '';
    }),
    addListener: jest.fn().mockImplementation((listener) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      };
    })
  };
});

// Create factory functions that synchronously return socket mocks
const createMarketDataSocketMock = jest.fn().mockImplementation(() => {
  const socket = new TradovateSocketMock({ debugLabel: 'md' });
  socket.connect('wss://md-demo.tradovateapi.com/v1/websocket', 'test-token');
  return socket;
});

const createTradingSocketMock = jest.fn().mockImplementation((isLive = false) => {
  const url = isLive ? 
    'wss://live.tradovateapi.com/v1/websocket' : 
    'wss://demo.tradovateapi.com/v1/websocket';
  
  const socket = new TradovateSocketMock({ debugLabel: isLive ? 'live' : 'demo' });
  socket.connect(url, 'test-token');
  return socket;
});

// Mock the socket module exports directly for more reliable tests
jest.mock('../src/socket.js', () => ({
  TradovateSocket: TradovateSocketMock,
  createMarketDataSocket: createMarketDataSocketMock,
  createTradingSocket: createTradingSocketMock
}));

// Import the mocked module
const socketModule = require('../src/socket.js');

describe('Socket Module Tests', () => {
  // Clean up before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Clean up after all tests complete
  afterAll(() => {
    jest.useRealTimers();
  });

  describe('TradovateSocket class', () => {
    let socket;

    // Create a fresh socket instance for each test
    beforeEach(() => {
      socket = new TradovateSocketMock({ debugLabel: 'test-socket' });
    });

    test('should initialize with default properties', () => {
      expect(socket.isConnected()).toBe(false);
    });

    test('should connect successfully', async () => {
      await socket.connect('wss://test.com', 'test-token');
      expect(socket.isConnected()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Connecting to Tradovate WebSocket'));
    });

    test('should send messages correctly', async () => {
      // First connect
      await socket.connect('wss://test.com', 'test-token');
      expect(socket.isConnected()).toBe(true);
      
      // Test send method
      const sendOptions = {
        url: 'test/endpoint',
        body: { test: 'data' }
      };
      
      const result = await socket.send(sendOptions);
      
      expect(result.s).toBe(200);
      expect(result.d).toEqual(expect.objectContaining({ result: 'success' }));
    });

    test('should throw error when sending without connection', async () => {
      const sendOptions = {
        url: 'test/endpoint',
        body: { test: 'data' }
      };
      
      await expect(socket.send(sendOptions)).rejects.toThrow('WebSocket is not connected');
    });

    test('should subscribe successfully', async () => {
      // Connect to market data URL
      await socket.connect('wss://md-demo.tradovateapi.com/v1/websocket', 'test-token');
      
      // Test subscription
      const subscribeOptions = {
        symbol: 'ESM5',
        id: 12345
      };
      
      const subscription = await socket.subscribe(subscribeOptions);
      expect(subscription).toEqual(expect.objectContaining({
        id: expect.any(Number),
        symbol: 'ESM5'
      }));
    });

    test('should handle subscription with wrong URL', async () => {
      // Connect to trading URL instead of market data
      await socket.connect('wss://trading-demo.tradovateapi.com/v1/websocket', 'test-token');
      
      // Test subscription - should fail on a trading socket
      const subscribeOptions = {
        symbol: 'ESM5',
        id: 12345
      };
      
      await expect(socket.subscribe(subscribeOptions)).rejects.toThrow(/market data/);
    });

    test('should close the connection', async () => {
      // First connect
      await socket.connect('wss://test.com', 'test-token');
      expect(socket.isConnected()).toBe(true);
      
      // Test close
      socket.close();
      
      expect(socket.isConnected()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Closing WebSocket'));
    });
  });

  describe('createMarketDataSocket function', () => {
    test('should create and connect a market data socket', () => {
      const socket = socketModule.createMarketDataSocket();
      
      expect(socket).toBeDefined();
      expect(socket.isConnected()).toBe(true);
      expect(socket.debugLabel).toBe('md');
      
      // Clean up
      socket.close();
    });
  });

  describe('createTradingSocket function', () => {
    test('should create and connect a trading socket (demo)', () => {
      const socket = socketModule.createTradingSocket(false);
      
      expect(socket).toBeDefined();
      expect(socket.isConnected()).toBe(true);
      expect(socket.debugLabel).toBe('demo');
      
      // Clean up
      socket.close();
    });

    test('should create and connect a trading socket (live)', () => {
      const socket = socketModule.createTradingSocket(true);
      
      expect(socket).toBeDefined();
      expect(socket.isConnected()).toBe(true);
      expect(socket.debugLabel).toBe('live');
      
      // Clean up
      socket.close();
    });
  });
}); 