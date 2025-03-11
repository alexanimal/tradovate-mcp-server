/// <reference types="jest" />

// Mock environment variables
process.env.TRADOVATE_API_ENVIRONMENT = 'demo';
process.env.TRADOVATE_USERNAME = 'test_user';
process.env.TRADOVATE_PASSWORD = 'test_password';
process.env.TRADOVATE_APP_ID = 'Test App';
process.env.TRADOVATE_APP_VERSION = '1.0';
process.env.TRADOVATE_CID = 'test_cid';
process.env.TRADOVATE_SEC = 'test_sec';

// Mock axios
import axios from 'axios';

jest.mock('axios', () => {
  return {
    default: {
      get: jest.fn(),
      post: jest.fn(),
    },
    get: jest.fn(),
    post: jest.fn(),
  };
});

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}; 