const { describe, test, expect, beforeEach, afterEach, afterAll } = require('@jest/globals');
const EventEmitter = require('events');

// Import helper for WebSocket mocking
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

// Mock dependencies but keep real socket implementation
jest.mock('../src/auth.js', () => mockAuth);
jest.mock('../src/logger.js', () => mockLogger);

// Create WebSocket mock 
const WebSocketMock = createWebSocketMock();
jest.mock('ws', () => WebSocketMock);

// Import the real implementation
const socketModule = require('../src/socket.js');
const { TradovateSocket } = socketModule;

// Constants for Tradovate URLs
const MD_URL = 'wss://md-demo.tradovateapi.com/v1/websocket';
const WS_DEMO_URL = 'wss://demo.tradovateapi.com/v1/websocket';

describe('Socket Implementation Tests', () => {
  let socket;
  let mockWs;
  
  beforeEach(() => {
    jest.clearAllMocks();
    WebSocketMock.cleanup();
    socket = new TradovateSocket({ debugLabel: 'test-socket' });
  });
  
  afterEach(() => {
    try {
      WebSocketMock.cleanup();
      
      // Ensure we don't try to close the socket if it's already being closed
      if (socket.isConnected && socket.isConnected()) {
        socket.close = jest.fn(); // Replace close with a mock to avoid actual closure
      }
    } finally {
      jest.clearAllMocks();
    }
  });
  
  afterAll(() => {
    WebSocketMock.cleanup();
    jest.useRealTimers();
  });
  
  // Helper function to simulate the WebSocket connection and auth flow
  async function setupMockConnection(socket, url = 'wss://test.tradovateapi.com/v1/websocket') {
    // Start connect process
    const connectPromise = socket.connect(url, 'test-token');
    
    // Get the WebSocket instance
    const wsInstances = WebSocketMock.instances;
    expect(wsInstances.length).toBeGreaterThan(0);
    mockWs = wsInstances[wsInstances.length - 1];
    
    // First we need to set the socket to OPEN state
    simulateWebSocketOpen(mockWs);
    
    // Emit the initial handshake message
    simulateWebSocketMessage(mockWs, 'o');
    
    // Extract the message ID from the sent auth message
    expect(mockWs.sent.length).toBeGreaterThan(0);
    const authMsg = mockWs.sent[0];
    const authIdMatch = authMsg.match(/authorize\n(\d+)/);
    expect(authIdMatch).toBeTruthy();
    const authId = parseInt(authIdMatch[1]);
    
    // Simulate successful auth response
    simulateWebSocketMessage(mockWs, `a[{"i":${authId},"s":200,"d":"auth-success"}]`);
    
    // Wait for connection to complete
    await connectPromise;
    
    return mockWs;
  }
  
  test('should initialize with default properties', () => {
    expect(socket.isConnected()).toBe(false);
  });
  
  test('should connect successfully', async () => {
    await setupMockConnection(socket);
    expect(socket.isConnected()).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Connecting to Tradovate WebSocket'));
  });
  
  test('should handle connection errors', async () => {
    const connectPromise = socket.connect('wss://test.com', 'test-token');
    
    // Get the WebSocket instance
    const wsInstances = WebSocketMock.instances;
    expect(wsInstances.length).toBeGreaterThan(0);
    mockWs = wsInstances[wsInstances.length - 1];
    
    // First open the connection so error handling works properly
    simulateWebSocketOpen(mockWs);
    
    // Simulate error
    simulateWebSocketError(mockWs, new Error('Connection error'));
    
    await expect(connectPromise).rejects.toThrow('Connection error');
    expect(socket.isConnected()).toBe(false);
  });
  
  test('should handle connection timeout', async () => {
    jest.useFakeTimers();
    
    // Mock setTimeout to avoid actual waiting
    const connectPromise = socket.connect('wss://test.com', 'test-token');
    
    // Fast-forward time to trigger timeout
    jest.advanceTimersByTime(31000);
    
    await expect(connectPromise).rejects.toThrow('Connection timeout');
    expect(socket.isConnected()).toBe(false);
    
    jest.useRealTimers();
  });
  
  test('should handle authentication failure', async () => {
    // Start connect process
    const connectPromise = socket.connect('wss://test.com', 'test-token');
    
    // Get the WebSocket instance
    const wsInstances = WebSocketMock.instances;
    expect(wsInstances.length).toBeGreaterThan(0);
    mockWs = wsInstances[wsInstances.length - 1];
    
    // First open the connection
    simulateWebSocketOpen(mockWs);
    
    // Emit the initial handshake message
    simulateWebSocketMessage(mockWs, 'o');
    
    // Extract the message ID from the sent auth message
    expect(mockWs.sent.length).toBeGreaterThan(0);
    const authMsg = mockWs.sent[0];
    const authIdMatch = authMsg.match(/authorize\n(\d+)/);
    expect(authIdMatch).toBeTruthy();
    const authId = parseInt(authIdMatch[1]);
    
    // Simulate failed auth response
    simulateWebSocketMessage(mockWs, `a[{"i":${authId},"s":403,"d":"auth-failed"}]`);
    
    await expect(connectPromise).rejects.toThrow('Authorization failed');
    expect(socket.isConnected()).toBe(false);
  });
  
  test('should send messages correctly', async () => {
    // First connect
    await setupMockConnection(socket);
    
    // Test send method
    const sendOptions = {
      url: 'test/endpoint',
      body: { test: 'data' }
    };
    
    const sendPromise = socket.send(sendOptions);
    
    // Extract message ID from the sent message
    expect(mockWs.sent.length).toBeGreaterThan(1); // Auth + our message
    const msgParts = mockWs.sent[1].split('\n');
    const msgId = parseInt(msgParts[1]);
    
    // Simulate successful response
    simulateWebSocketMessage(mockWs, `a[{"i":${msgId},"s":200,"d":{"result":"success"}}]`);
    
    const result = await sendPromise;
    
    expect(result.s).toBe(200);
    expect(result.d).toEqual({ result: "success" });
    expect(mockWs.sent.length).toBe(2); // Auth + our test message
    expect(mockWs.sent[1]).toContain('test/endpoint');
  });
  
  test('should handle send error responses', async () => {
    // First connect
    await setupMockConnection(socket);
    
    // Test send method with error response
    const sendOptions = {
      url: 'test/endpoint',
      body: { test: 'data' }
    };
    
    const sendPromise = socket.send(sendOptions);
    
    // Extract message ID from the sent message
    expect(mockWs.sent.length).toBeGreaterThan(1); // Auth + our message
    const msgParts = mockWs.sent[1].split('\n');
    const msgId = parseInt(msgParts[1]);
    
    // Simulate error response
    simulateWebSocketMessage(mockWs, `a[{"i":${msgId},"s":404,"d":{"error":"Not found"}}]`);
    
    await expect(sendPromise).rejects.toMatch(/FAILED:/);
  });
  
  test('should throw error when sending without connection', async () => {
    const sendOptions = {
      url: 'test/endpoint',
      body: { test: 'data' }
    };
    
    await expect(socket.send(sendOptions)).rejects.toThrow('WebSocket is not connected');
  });
  
  test('should add and remove listeners', async () => {
    await setupMockConnection(socket);
    
    // Create a test listener
    const testListener = jest.fn();
    const unsubscribe = socket.addListener(testListener);
    
    // Simulate a message event
    simulateWebSocketMessage(mockWs, 'a[{"test":"data"}]');
    
    // Check that the listener was called
    expect(testListener).toHaveBeenCalled();
    
    // Unsubscribe and verify it's removed
    unsubscribe();
    testListener.mockClear();
    
    // Simulate another message
    simulateWebSocketMessage(mockWs, 'a[{"test":"data2"}]');
    
    // Listener should not be called
    expect(testListener).not.toHaveBeenCalled();
  });
  
  test('should handle message processing errors', async () => {
    await setupMockConnection(socket);
    
    // Send invalid message format
    simulateWebSocketMessage(mockWs, 'invalid-json');
    
    // Should not throw and should log error
    expect(mockLogger.error).toHaveBeenCalled();
  });
  
  test('should handle subscription requests', async () => {
    // Connect to Market Data URL specifically
    await setupMockConnection(socket, MD_URL);
    
    // Create a mock subscription callback
    const mockSubscriptionCallback = jest.fn();
    
    // Test subscribe method with proper options
    const subscribeOptions = {
      url: 'md/subscribequote',
      body: { symbol: 'ESM5' },
      subscription: mockSubscriptionCallback
    };
    
    const subscribePromise = socket.subscribe(subscribeOptions);
    
    // Extract message ID from the sent message
    expect(mockWs.sent.length).toBeGreaterThan(1); // Auth + our message
    const msgParts = mockWs.sent[1].split('\n');
    const msgId = parseInt(msgParts[1]);
    
    // Simulate successful response
    simulateWebSocketMessage(mockWs, `a[{"i":${msgId},"s":200,"d":{"subscriptionId":123}}]`);
    
    // The subscribe method returns an unsubscribe function
    const unsubscribeFunction = await subscribePromise;
    expect(typeof unsubscribeFunction).toBe('function');
    
    // Simulate receiving a quote for the subscribed symbol
    simulateWebSocketMessage(mockWs, `a[{"d":{"quotes":[{"contractId":12345,"price":4200.50}]}}]`);
    
    // Verify that the subscription callback was called
    expect(mockSubscriptionCallback).toHaveBeenCalled();
  }, 10000);
  
  test('should handle unsubscribe function', async () => {
    // Connect to Market Data URL specifically
    await setupMockConnection(socket, MD_URL);
    
    // Create a mock subscription callback
    const mockSubscriptionCallback = jest.fn();
    
    // Test subscribe method with proper options
    const subscribeOptions = {
      url: 'md/subscribequote',
      body: { symbol: 'ESM5' },
      subscription: mockSubscriptionCallback
    };
    
    // Subscribe first
    const subscribePromise = socket.subscribe(subscribeOptions);
    
    // Extract message ID from the sent message for the subscribe call
    expect(mockWs.sent.length).toBeGreaterThan(1); // Auth + our message
    const subMsgParts = mockWs.sent[1].split('\n');
    const subMsgId = parseInt(subMsgParts[1]);
    
    // Simulate successful response to the subscribe request
    simulateWebSocketMessage(mockWs, `a[{"i":${subMsgId},"s":200,"d":{"subscriptionId":123}}]`);
    
    // Get the unsubscribe function
    const unsubscribeFunction = await subscribePromise;
    
    // Replace socket's send method to return a resolved promise
    // This avoids actually making the cancellation request
    const originalSend = socket.send;
    socket.send = jest.fn().mockResolvedValue({ s: 200, d: { result: 'success' } });
    
    // Call the unsubscribe function
    await unsubscribeFunction();
    
    // Verify send was called with the expected parameters
    expect(socket.send).toHaveBeenCalledWith({
      url: 'md/unsubscribequote',
      body: { symbol: 'ESM5' }
    });
    
    // Restore original send method
    socket.send = originalSend;
  }, 10000);
  
  test('should close the connection', async () => {
    await setupMockConnection(socket);
    
    // Spy on the close method
    const mockClose = jest.spyOn(mockWs, 'close');
    
    // Close the connection
    socket.close();
    
    // Verify the WebSocket was closed
    expect(mockClose).toHaveBeenCalled();
    expect(socket.isConnected()).toBe(false);
  });
  
  test('should create market data socket', async () => {
    // Replace the real connect method temporarily to avoid actual connection
    const originalConnect = TradovateSocket.prototype.connect;
    TradovateSocket.prototype.connect = jest.fn().mockResolvedValue(undefined);
    
    try {
      // Call the factory function
      const mdSocket = await socketModule.createMarketDataSocket();
      
      expect(mdSocket).toBeInstanceOf(TradovateSocket);
      expect(TradovateSocket.prototype.connect).toHaveBeenCalledWith(
        expect.stringContaining('md-demo.tradovateapi.com'),
        expect.any(String)
      );
    } finally {
      // Restore original connect method
      TradovateSocket.prototype.connect = originalConnect;
    }
  });
  
  test('should create trading socket', async () => {
    // Replace the real connect method temporarily to avoid actual connection
    const originalConnect = TradovateSocket.prototype.connect;
    TradovateSocket.prototype.connect = jest.fn().mockResolvedValue(undefined);
    
    try {
      // Call the factory function for demo
      const demoSocket = await socketModule.createTradingSocket(false);
      
      expect(demoSocket).toBeInstanceOf(TradovateSocket);
      expect(TradovateSocket.prototype.connect).toHaveBeenCalledWith(
        expect.stringContaining('demo.tradovateapi.com'),
        expect.any(String)
      );
      
      // Reset for live test
      TradovateSocket.prototype.connect.mockClear();
      
      // Call the factory function for live
      const liveSocket = await socketModule.createTradingSocket(true);
      
      expect(liveSocket).toBeInstanceOf(TradovateSocket);
      expect(TradovateSocket.prototype.connect).toHaveBeenCalledWith(
        expect.stringContaining('live.tradovateapi.com'),
        expect.any(String)
      );
    } finally {
      // Restore original connect method
      TradovateSocket.prototype.connect = originalConnect;
    }
  });
}); 