const { describe, test, expect, beforeEach, afterEach, afterAll } = require('@jest/globals');
const WebSocket = require('ws');
const Auth = require('../src/socket');

// Mock dependencies
// Update the WebSocket mock to be a jest function that can be cleared properly
jest.mock('ws', () => {
  const mockWebSocketFn = jest.fn();
  mockWebSocketFn.CONNECTING = 0;
  mockWebSocketFn.OPEN = 1;
  mockWebSocketFn.CLOSING = 2;
  mockWebSocketFn.CLOSED = 3;
  return mockWebSocketFn;
});

jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../src/auth', () => ({
  getAccessToken: jest.fn().mockResolvedValue({ 
    accessToken: 'mock-access-token', 
    expiresAt: Date.now() + 3600000 
  }),
  tradovateRequest: jest.fn().mockImplementation((method, endpoint) => {
    if (endpoint.includes('find')) {
      return Promise.resolve({ id: 12345 });
    } else if (endpoint.includes('suggest')) {
      return Promise.resolve([{ id: 12345 }]);
    }
    return Promise.resolve({});
  })
}));

describe('Socket Implementation Tests', () => {
  let TradovateSocket;
  let mockWs;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset WebSocket mock - no need to call mockClear since jest.clearAllMocks() handles it
    mockWs = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
      sent: []
    };
    
    // Track sent messages 
    mockWs.send.mockImplementation((msg) => {
      mockWs.sent.push(msg);
    });
    
    // Provide mock WebSocket instance
    WebSocket.mockImplementation(() => mockWs);
    
    // Re-import to get fresh module
    jest.isolateModules(() => {
      TradovateSocket = require('../src/socket').TradovateSocket;
    });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  afterAll(() => {
    jest.resetModules();
  });
  
  test('should initialize with default properties', () => {
    const socket = new TradovateSocket();
    expect(socket).toBeDefined();
    expect(socket.isConnected()).toBe(false);
  });
  
  // Helper to setup a mock connection
  const setupMockConnection = async () => {
    const socket = new TradovateSocket();
    const connectPromise = socket.connect('wss://test-url.com', 'test-token');
    
    // Simulate the open event
    const openHandler = mockWs.addEventListener.mock.calls.find(
      call => call[0] === 'open'
    )[1];
    
    // Trigger open event
    openHandler();
    
    // Now we need to wait a bit for the setTimeout in the open handler to execute
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Extract the message ID from the sent auth message
    expect(mockWs.sent.length).toBeGreaterThan(0);
    const authMsg = mockWs.sent[0];
    const authIdMatch = authMsg.match(/authorize\n(\d+)/);
    expect(authIdMatch).toBeTruthy();
    
    // Find the message handler for auth responses
    const messageHandlers = mockWs.addEventListener.mock.calls.filter(
      call => call[0] === 'message'
    );
    expect(messageHandlers.length).toBeGreaterThan(0);
    
    // Get the auth handler (second message handler in our new implementation)
    const authHandler = messageHandlers[1][1];
    
    // Simulate successful auth response
    authHandler({ data: `a[{"i":${authIdMatch[1]},"s":200}]` });
    
    // Resolve the connection promise
    await connectPromise;
    
    return { socket, authId: authIdMatch[1] };
  };
  
  test('should connect successfully', async () => {
    const { socket } = await setupMockConnection();
    expect(socket.isConnected()).toBe(true);
  });
  
  test('should handle connection errors', async () => {
    const socket = new TradovateSocket();
    const connectPromise = socket.connect('wss://test-url.com', 'test-token');
    
    // Find error handler
    const errorHandler = mockWs.addEventListener.mock.calls.find(
      call => call[0] === 'error'
    )[1];
    
    // Simulate error
    errorHandler(new Error('Connection failed'));
    
    await expect(connectPromise).rejects.toThrow('Connection failed');
    expect(socket.isConnected()).toBe(false);
  });
  
  test('should handle connection timeout', async () => {
    jest.useFakeTimers();
    const socket = new TradovateSocket();
    const connectPromise = socket.connect('wss://test-url.com', 'test-token');
    
    // Fast forward 31 seconds to trigger timeout
    jest.advanceTimersByTime(31000);
    
    await expect(connectPromise).rejects.toThrow('Connection timeout');
    expect(socket.isConnected()).toBe(false);
    
    jest.useRealTimers();
  });
  
  test('should handle authentication failure', async () => {
    const socket = new TradovateSocket();
    const connectPromise = socket.connect('wss://test-url.com', 'test-token');
    
    // Simulate the open event
    const openHandler = mockWs.addEventListener.mock.calls.find(
      call => call[0] === 'open'
    )[1];
    
    // Trigger open event
    openHandler();
    
    // Now we need to wait a bit for the setTimeout in the open handler to execute
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Extract the message ID from the sent auth message
    expect(mockWs.sent.length).toBeGreaterThan(0);
    const authMsg = mockWs.sent[0];
    const authIdMatch = authMsg.match(/authorize\n(\d+)/);
    expect(authIdMatch).toBeTruthy();
    
    // Find the message handler for auth responses
    const messageHandlers = mockWs.addEventListener.mock.calls.filter(
      call => call[0] === 'message'
    );
    
    // Get the auth handler (second message handler)
    const authHandler = messageHandlers[1][1];
    
    // Simulate auth failure
    authHandler({ data: `a[{"i":${authIdMatch[1]},"s":401,"d":"Access is denied"}]` });
    
    await expect(connectPromise).rejects.toThrow('Authorization failed');
  });
  
  test('should send messages correctly', async () => {
    const { socket, authId } = await setupMockConnection();
    
    // Find the general message handler
    const messageHandlers = mockWs.addEventListener.mock.calls.filter(
      call => call[0] === 'message'
    );
    const generalHandler = messageHandlers[0][1];
    
    // Call send
    const sendPromise = socket.send({ url: 'test/endpoint', body: { param: 'value' } });
    
    // Find the last sent message (should be the test message, not the auth message)
    const lastSentMsg = mockWs.sent[mockWs.sent.length - 1];
    
    // Expected format: endpoint\nid\nquery\nbody
    const [endpoint, id, query, body] = lastSentMsg.split('\n');
    expect(endpoint).toBe('test/endpoint');
    expect(id).toBeTruthy();
    expect(JSON.parse(body)).toEqual({ param: 'value' });
    
    // Simulate response
    generalHandler({ data: `a[{"i":${id},"s":200,"d":"Success"}]` });
    
    const response = await sendPromise;
    expect(response.s).toBe(200);
    expect(response.d).toBe('Success');
  });
  
  test('should handle send error responses', async () => {
    const { socket } = await setupMockConnection();
    
    // Find the general message handler
    const messageHandlers = mockWs.addEventListener.mock.calls.filter(
      call => call[0] === 'message'
    );
    const generalHandler = messageHandlers[0][1];
    
    // Call send
    const sendPromise = socket.send({ url: 'test/endpoint', body: { param: 'value' } });
    
    // Find the request ID in the sent message
    const lastSentMsg = mockWs.sent[mockWs.sent.length - 1];
    const [_, id] = lastSentMsg.split('\n');
    
    // Simulate error response
    generalHandler({ data: `a[{"i":${id},"s":400,"d":"Bad Request"}]` });
    
    await expect(sendPromise).rejects.toMatch(/FAILED/);
  });
  
  test('should throw error when sending without connection', async () => {
    const socket = new TradovateSocket();
    await expect(
      socket.send({ url: 'test/endpoint' })
    ).rejects.toThrow('WebSocket is not connected');
  });
  
  test('should add and remove listeners', async () => {
    const { socket } = await setupMockConnection();
    
    // Find message handler to simulate events
    const messageHandlers = mockWs.addEventListener.mock.calls.filter(
      call => call[0] === 'message'
    );
    const generalHandler = messageHandlers[0][1];
    
    // Add listener
    const mockListener = jest.fn();
    const remove = socket.addListener(mockListener);
    
    // Simulate message event
    generalHandler({ data: 'a[{"d":{"test":"data"}}]' });
    
    expect(mockListener).toHaveBeenCalledWith({"d":{"test":"data"}});
    
    // Remove listener
    remove();
    
    // Simulate another message event
    mockListener.mockClear();
    generalHandler({ data: 'a[{"d":{"more":"data"}}]' });
    
    // Listener should not be called
    expect(mockListener).not.toHaveBeenCalled();
  });
  
  test('should handle message processing errors', async () => {
    const { socket } = await setupMockConnection();
    
    // Find message handler to simulate events
    const messageHandlers = mockWs.addEventListener.mock.calls.filter(
      call => call[0] === 'message'
    );
    const generalHandler = messageHandlers[0][1];
    
    // Add listener that throws
    const mockListener = jest.fn().mockImplementation(() => {
      throw new Error('Listener error');
    });
    socket.addListener(mockListener);
    
    // Simulate message event - this should not throw
    generalHandler({ data: 'a[{"d":{"test":"data"}}]' });
    
    // Ensure listener was called
    expect(mockListener).toHaveBeenCalled();
  });
  
  test('should handle subscription requests', async () => {
    const { socket } = await setupMockConnection();
    
    // Mock send to simulate subscription response
    const sendSpy = jest.spyOn(socket, 'send').mockResolvedValue({
      s: 200,
      i: 123,
      d: { realtimeId: 'rt-123' }
    });
    
    // Subscribe
    const mockSubscription = jest.fn();
    const unsubscribe = await socket.subscribe({
      url: 'md/subscribequote',
      body: { symbol: 'AAPL' },
      subscription: mockSubscription
    });
    
    // Verify send was called
    expect(sendSpy).toHaveBeenCalled();
    
    // Verify unsubscribe function was returned
    expect(typeof unsubscribe).toBe('function');
  });
  
  test('should handle unsubscribe function', async () => {
    const { socket } = await setupMockConnection();
    
    // Create a spy for the send method
    const sendSpy = jest.spyOn(socket, 'send');
    
    // Mock first call for subscribe
    sendSpy.mockResolvedValueOnce({
      s: 200,
      i: 123,
      d: { realtimeId: 'rt-123' }
    });
    
    // Mock second call for unsubscribe
    sendSpy.mockResolvedValueOnce({
      s: 200,
      i: 124,
      d: 'Success'
    });
    
    // Subscribe
    const unsubscribe = await socket.subscribe({
      url: 'md/subscribequote',
      body: { symbol: 'AAPL' },
      subscription: jest.fn()
    });
    
    // Reset the mock to check only the unsubscribe call
    sendSpy.mockClear();
    
    // Call unsubscribe
    await unsubscribe();
    
    // Verify send was called with the correct unsubscribe parameters
    expect(sendSpy).toHaveBeenCalledWith({
      url: 'md/unsubscribequote',
      body: { symbol: 'AAPL' }
    });
  });
  
  test('should close the connection', async () => {
    const { socket } = await setupMockConnection();
    
    // Close the connection
    socket.close();
    
    // Verify the WebSocket close method was called
    expect(mockWs.close).toHaveBeenCalled();
    expect(socket.isConnected()).toBe(false);
  });
  
  test('should create market data socket', async () => {
    // Import the function directly
    const { createMarketDataSocket } = require('../src/socket');
    
    // Setup mocks for successful connection
    const mockConnect = jest.fn().mockResolvedValue();
    TradovateSocket.prototype.connect = mockConnect;
    
    // Call the function
    const socket = await createMarketDataSocket();
    
    // Verify it was called with the correct URL
    expect(mockConnect).toHaveBeenCalledWith(
      'wss://md-demo.tradovateapi.com/v1/websocket',
      'mock-access-token'
    );
  });
  
  test('should create trading socket', async () => {
    // Import the function directly
    const { createTradingSocket } = require('../src/socket');
    
    // Setup mocks for successful connection
    const mockConnect = jest.fn().mockResolvedValue();
    TradovateSocket.prototype.connect = mockConnect;
    
    // Call the function
    const socket = await createTradingSocket();
    
    // Verify it was called with the correct URL
    expect(mockConnect).toHaveBeenCalledWith(
      'wss://demo.tradovateapi.com/v1/websocket',
      'mock-access-token'
    );
  });
}); 