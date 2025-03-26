/**
 * Helper file for connect.ts tests
 * Exposes internal state and provides mock implementations
 */

const EventEmitter = require('events');

// Mock WebSocket implementation
class MockWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 0; // WebSocket.CONNECTING
    this.sent = [];
  }

  send(data) {
    this.sent.push(data);
    return true;
  }

  close() {
    this.emit('close', 1000, 'Normal closure');
    this.readyState = 3; // WebSocket.CLOSED
  }

  // Node-style WebSocket methods
  on(event, listener) {
    super.on(event, listener);
    return this;
  }

  removeListener(event, listener) {
    super.removeListener(event, listener);
    return this;
  }

  once(event, listener) {
    super.once(event, listener);
    return this;
  }

  // Browser-style WebSocket methods
  addEventListener(event, listener) {
    return this.on(event, listener);
  }

  removeEventListener(event, listener) {
    return this.removeListener(event, listener);
  }

  // Helper methods for testing
  mockOpen() {
    this.readyState = 1; // WebSocket.OPEN
    this.emit('open');
  }

  mockMessage(data) {
    this.emit('message', data);
  }

  mockError(error) {
    this.emit('error', error || new Error('Mock WebSocket error'));
  }

  mockClose(code = 1000, reason = 'Normal closure') {
    this.readyState = 3; // WebSocket.CLOSED
    this.emit('close', code, reason);
  }
}

// Static properties for WebSocket connection states
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

// Mock authentication module
const mockAuth = {
  accessToken: 'mock-access-token',
  expiresAt: Date.now() + 3600000,
  
  getTradovateMdApiUrl: jest.fn().mockReturnValue('wss://demo.tradovateapi.com/v1/websocket'),
  
  isTokenValid: jest.fn().mockImplementation((expiresAt) => {
    return expiresAt > Date.now();
  }),
  
  getAccessToken: jest.fn().mockImplementation(async () => {
    return {
      accessToken: mockAuth.accessToken,
      expiresAt: mockAuth.expiresAt
    };
  })
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Export mock implementations and helpers
module.exports = {
  MockWebSocket,
  mockAuth,
  mockLogger
}; 