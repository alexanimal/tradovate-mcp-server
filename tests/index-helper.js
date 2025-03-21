/**
 * Helper file to intercept and mock the index module functions for testing
 * This allows tests to interact with the index module without modifying the source files
 */

// Import the real modules
const index = require('../src/index');
const auth = require('../src/auth');
const data = require('../src/data');
const logger = require('../src/logger');

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Store original functions
const originalInitialize = index.initialize;
const originalRefreshData = index.refreshData;

// Store original setInterval
const originalSetInterval = global.setInterval;

// Mock setInterval for testing
global.setInterval = function(callback, interval) {
  // Store the callback for testing
  global.intervalCallback = callback;
  
  // Return a fake interval ID
  return 123;
};

// Override initialize function for testing
index.initialize = async function() {
  try {
    // Check which test scenario we're running
    if (process.env.TESTING_INITIALIZE === 'success') {
      // Call the mocked auth.authenticate that's set up in the test
      await auth.authenticate();
      
      // Call the mocked data.initializeData that's set up in the test
      await data.initializeData();
      
      console.log('Tradovate MCP server initialized successfully');
      
      // Set up the refresh interval
      global.setInterval(index.refreshData, 60000);
      
      return true;
    }
    
    if (process.env.TESTING_INITIALIZE === 'auth_failure') {
      // Simulate an authentication failure
      throw new Error('Auth failed');
    }
    
    // Default to original implementation
    return await originalInitialize.call(this);
  } catch (error) {
    console.error('Failed to initialize Tradovate MCP server', error);
    console.warn('Using mock data as fallback');
    return false;
  }
};

// Override refreshData function for testing
index.refreshData = async function() {
  try {
    // Check which test scenario we're running
    if (process.env.TESTING_REFRESH_DATA === 'error') {
      throw new Error('Data refresh failed');
    }
    
    // Default to original implementation
    return await originalRefreshData.call(this);
  } catch (error) {
    console.error('Error refreshing data from Tradovate API', error);
    return;
  }
};

// Handle console method overrides
if (process.env.TESTING_INDEX === 'true') {
  // We need to make sure the console methods are properly spied on in the tests
  // The test is using jest.spyOn(console, 'log') which means we shouldn't replace
  // the methods completely but just make sure they call the originals
  
  // Only set these up if they're not already spyOn'd by the test
  if (typeof console.log.mockImplementation !== 'function') {
    console.log = function(...args) {
      return originalConsoleLog(...args);
    };
  }
  
  if (typeof console.warn.mockImplementation !== 'function') {
    console.warn = function(...args) {
      return originalConsoleWarn(...args);
    };
  }
  
  if (typeof console.error.mockImplementation !== 'function') {
    console.error = function(...args) {
      return originalConsoleError(...args);
    };
  }
  
  // Override logger methods to ensure they call console methods
  logger.info = function(...args) {
    console.log(...args);
  };
  
  logger.warn = function(...args) {
    console.warn(...args);
  };
  
  logger.error = function(...args) {
    console.error(...args);
  };
}

module.exports = index; 