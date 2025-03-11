// Set up environment variables for tests
process.env.TRADOVATE_API_ENVIRONMENT = 'demo';
process.env.TRADOVATE_USERNAME = 'test_user';
process.env.TRADOVATE_PASSWORD = 'test_password';
process.env.TRADOVATE_APP_ID = 'Test App';
process.env.TRADOVATE_APP_VERSION = '1.0';
process.env.TRADOVATE_CID = 'test_cid';
process.env.TRADOVATE_SEC = 'test_sec';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}; 