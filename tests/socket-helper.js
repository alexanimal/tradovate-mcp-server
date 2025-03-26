/**
 * Helper file for socket.ts tests
 * Provides robust mock implementations with controlled behavior
 */

const EventEmitter = require('events');

// Mock WebSocket implementation
class MockWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0; // WebSocket.CONNECTING
    this.sent = [];
    
    // Don't auto-connect, tests should control this
    process.nextTick(() => {
      this.readyState = 1; // WebSocket.OPEN
      this.emit('open');
    });
  }

  send(data) {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open');
    }
    this.sent.push(data);
    return true;
  }

  close() {
    this.readyState = 3; // WebSocket.CLOSED
    this.emit('close', { code: 1000, reason: 'Normal closure' });
    this.removeAllListeners();
  }

  addEventListener(event, listener) {
    this.on(event, listener);
  }

  removeEventListener(event, listener) {
    this.off(event, listener);
  }
  
  // Method to clean up any listeners to prevent memory leaks
  cleanup() {
    this.removeAllListeners();
  }
}

// WebSocket connection states
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

// Create a WebSocket mock factory that can be injected globally
const createWebSocketMock = () => {
  const instances = [];
  
  const WebSocketMock = jest.fn().mockImplementation((url) => {
    const instance = new MockWebSocket(url);
    instances.push(instance);
    return instance;
  });
  
  WebSocketMock.instances = instances;
  WebSocketMock.CONNECTING = 0;
  WebSocketMock.OPEN = 1;
  WebSocketMock.CLOSING = 2;
  WebSocketMock.CLOSED = 3;
  
  // Helper to clean up all instances
  WebSocketMock.cleanup = () => {
    instances.forEach(ws => {
      if (ws.cleanup) ws.cleanup();
    });
    instances.length = 0;
  };
  
  return WebSocketMock;
};

// Mock authentication module with reliable behavior
const mockAuth = {
  accessToken: 'mock-access-token',
  expiresAt: Date.now() + 3600000,
  
  getAccessToken: jest.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    expiresAt: Date.now() + 3600000
  }),
  
  tradovateRequest: jest.fn().mockImplementation(async (method, endpoint, data, isMarketData) => {
    if (endpoint.includes('contract/find')) {
      return { id: 12345, name: 'ESM5' };
    }
    return {};
  })
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Helper functions to simulate WebSocket events
function simulateWebSocketOpen(ws) {
  ws.readyState = MockWebSocket.OPEN;
  ws.emit('open');
}

function simulateWebSocketError(ws, error) {
  ws.emit('error', error || new Error('Mock WebSocket error'));
}

function simulateWebSocketClose(ws, code = 1000, reason = 'Normal closure') {
  ws.readyState = MockWebSocket.CLOSED;
  ws.emit('close', { code, reason });
}

function simulateWebSocketMessage(ws, data) {
  // Don't try to emit on undefined ws
  if (!ws) return;
  
  const event = typeof data === 'string' ? { data } : data;
  ws.emit('message', event);
}

// Helper to simulate authentication flow
function simulateAuthentication(ws, success = true, messageId = 0) {
  // Don't try to simulate on undefined ws
  if (!ws) return;
  
  // Simulate 'o' message to initiate auth flow
  simulateWebSocketMessage(ws, 'o');
  
  // Synchronously add a small delay to give event handlers time to register
  process.nextTick(() => {
    if (success) {
      simulateWebSocketMessage(ws, `a[{"i":${messageId},"s":200,"d":"auth-success"}]`);
    } else {
      simulateWebSocketMessage(ws, `a[{"i":${messageId},"s":403,"d":"auth-failed"}]`);
    }
  });
}

// Export mock implementations and helpers
module.exports = {
  MockWebSocket,
  createWebSocketMock,
  mockAuth,
  mockLogger,
  simulateWebSocketOpen,
  simulateWebSocketError,
  simulateWebSocketClose,
  simulateWebSocketMessage,
  simulateAuthentication
}; 