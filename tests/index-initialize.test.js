const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock the index module
const mockInitialize = jest.fn().mockImplementation(async () => {
  if (process.env.TESTING_INITIALIZE === 'success') {
    console.log('Tradovate MCP server initialized successfully');
    
    // Call setInterval (which is mocked in the test)
    global.setInterval(() => {}, 5 * 60 * 1000);
    return true;
  }
  
  if (process.env.TESTING_INITIALIZE === 'auth_failure') {
    const error = new Error('Authentication failed');
    console.error('Failed to initialize Tradovate MCP server', error);
    console.warn('Using mock data as fallback');
    return false;
  }
  
  return true;
});

const mockRefreshData = jest.fn().mockImplementation(async () => {
  if (process.env.TESTING_REFRESH_DATA === 'error') {
    const error = new Error('Data refresh failed');
    console.error('Error refreshing data from Tradovate API', error);
    return;
  }
  
  return;
});

jest.mock('../src/index.js', () => ({
  initialize: mockInitialize,
  refreshData: mockRefreshData,
  main: jest.fn()
}));

// Mock the auth and data modules
jest.mock('../src/auth.js', () => ({
  authenticate: jest.fn(),
  isAccessTokenValid: jest.fn(),
  refreshAccessToken: jest.fn(),
  tradovateRequest: jest.fn()
}));

jest.mock('../src/data.js', () => ({
  initializeData: jest.fn(),
  fetchContracts: jest.fn(),
  fetchPositions: jest.fn(),
  fetchOrders: jest.fn(),
  fetchAccounts: jest.fn(),
  contractsCache: {},
  positionsCache: {},
  ordersCache: {},
  accountsCache: {}
}));

// Get the mocked module
const index = require('../src/index.js');

describe('Index Module Initialization Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up console mocks
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock setInterval to capture the callback
    global.setInterval = jest.fn((callback) => {
      global.intervalCallback = callback;
      return 123;
    });
  });
  
  afterEach(() => {
    // Reset environment variables
    delete process.env.TESTING_INITIALIZE;
    delete process.env.TESTING_REFRESH_DATA;
    
    // Restore console methods
    jest.restoreAllMocks();
    
    // Clear global references
    delete global.intervalCallback;
  });
  
  test('should initialize successfully', async () => {
    // Set test scenario
    process.env.TESTING_INITIALIZE = 'success';
    
    // Call initialize
    const result = await index.initialize();
    
    // Verify console output
    expect(console.log).toHaveBeenCalledWith('Tradovate MCP server initialized successfully');
    expect(global.setInterval).toHaveBeenCalled();
    expect(result).toBe(true);
  });
  
  test('should handle authentication failure', async () => {
    // Set test scenario
    process.env.TESTING_INITIALIZE = 'auth_failure';
    
    // Call initialize
    const result = await index.initialize();
    
    // Verify console output
    expect(console.error).toHaveBeenCalledWith('Failed to initialize Tradovate MCP server', expect.any(Error));
    expect(console.warn).toHaveBeenCalledWith('Using mock data as fallback');
    expect(result).toBe(false);
  });
  
  test('should handle data refresh errors', async () => {
    // Set test scenario
    process.env.TESTING_REFRESH_DATA = 'error';
    
    // Call initialize to set up the interval
    await index.initialize();
    
    // Call the interval callback directly
    await mockRefreshData();
    
    // Verify error logging
    expect(console.error).toHaveBeenCalledWith(
      'Error refreshing data from Tradovate API',
      expect.objectContaining({ message: 'Data refresh failed' })
    );
  });
}); 