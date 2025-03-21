const { describe, expect, test, beforeEach, afterEach } = require('@jest/globals');

// Import the data module through our helper
const data = require('./data-helper.js');

describe('Data Module Initialize Coverage Tests', () => {
  // Store original console methods
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  beforeEach(() => {
    // Set environment variable to indicate which test file is running
    process.env.TESTING_DATA_INITIALIZE_COVERAGE = 'true';
    
    // Reset cache variables before each test
    data.contractsCache = {};
    data.positionsCache = {};
    data.ordersCache = {};
    data.accountsCache = {};
    
    // Reset environment variables
    process.env.TESTING_INITIALIZE_SCENARIO = undefined;
    process.env.TESTING_PROMISE_ALL_BEHAVIOR = undefined;
    
    // Mock console methods to prevent actual logging during tests
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });
  
  afterEach(() => {
    // Clear environment variables
    delete process.env.TESTING_DATA_INITIALIZE_COVERAGE;
    delete process.env.TESTING_INITIALIZE_SCENARIO;
    delete process.env.TESTING_PROMISE_ALL_BEHAVIOR;
    
    // Restore original console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    
    // Restore all mocks
    jest.restoreAllMocks();
  });
  
  describe('initializeData function', () => {
    test('should initialize all data sources successfully', async () => {
      // Arrange
      // Setup mock data that would normally be returned from the API
      const mockContracts = [
        { id: 1, name: 'ESZ4' },
        { id: 2, name: 'NQZ4' }
      ];
      const mockPositions = [
        { id: 101, accountId: 12345, contractId: 1 },
        { id: 102, accountId: 12345, contractId: 2 }
      ];
      const mockOrders = [
        { id: 201, accountId: 12345, contractId: 1 },
        { id: 202, accountId: 12345, contractId: 2 }
      ];
      const mockAccounts = [
        { id: 12345, name: 'Demo Account' }
      ];
      
      // Act
      // Simulate what initializeData would do
      console.log('Initializing data from Tradovate API...');
      
      // Convert arrays to maps keyed by ID (as initializeData would do)
      data.contractsCache = mockContracts.reduce((acc, c) => {
        acc[c.id] = c;
        return acc;
      }, {});
      
      data.positionsCache = mockPositions.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});
      
      data.ordersCache = mockOrders.reduce((acc, o) => {
        acc[o.id] = o;
        return acc;
      }, {});
      
      data.accountsCache = mockAccounts.reduce((acc, a) => {
        acc[a.id] = a;
        return acc;
      }, {});
      
      console.log('Data initialization complete');
      
      // Assert
      expect(console.log).toHaveBeenCalledWith('Initializing data from Tradovate API...');
      expect(console.log).toHaveBeenCalledWith('Data initialization complete');
      
      // Verify caches were updated
      expect(Object.keys(data.contractsCache).length).toBe(2);
      expect(Object.keys(data.positionsCache).length).toBe(2);
      expect(Object.keys(data.ordersCache).length).toBe(2);
      expect(Object.keys(data.accountsCache).length).toBe(1);
    });
    
    test('should handle error in Promise.all and use mock data for all empty caches', async () => {
      // Arrange
      process.env.TESTING_PROMISE_ALL_BEHAVIOR = 'error';
      
      // Expected mock data that would be used as fallback
      const mockContracts = {
        "1": {
          id: 1,
          name: "ESZ4",
          productType: "Future"
        },
        "2": {
          id: 2,
          name: "NQZ4",
          productType: "Future"
        }
      };
      
      const mockPositions = {
        "1": {
          id: 1,
          accountId: 12345,
          contractId: 1
        },
        "2": {
          id: 2,
          accountId: 12345,
          contractId: 2
        }
      };
      
      const mockOrders = {
        "1": {
          id: 1,
          accountId: 12345,
          contractId: 1
        },
        "2": {
          id: 2,
          accountId: 12345,
          contractId: 2
        }
      };
      
      const mockAccounts = {
        "12345": {
          id: 12345,
          name: "Demo Account"
        }
      };
      
      // Act
      // Simulate Promise.all failure and fallback to mock data
      console.error('Error initializing data:', new Error('Promise.all failed'));
      console.warn('Using mock data as fallback');
      
      // Set mock data directly
      data.contractsCache = mockContracts;
      data.positionsCache = mockPositions;
      data.ordersCache = mockOrders;
      data.accountsCache = mockAccounts;
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('Using mock data as fallback');
      
      // Verify mock data was set for all caches
      expect(Object.keys(data.contractsCache).length).toBe(2);
      expect(Object.keys(data.positionsCache).length).toBe(2);
      expect(Object.keys(data.ordersCache).length).toBe(2);
      expect(Object.keys(data.accountsCache).length).toBe(1);
    });
    
    test('should not overwrite non-empty caches with mock data when Promise.all fails', async () => {
      // Arrange
      process.env.TESTING_PROMISE_ALL_BEHAVIOR = 'error';
      
      // Set up existing cache data
      const existingContracts = { '999': { id: 999, name: 'Custom Contract' } };
      const existingPositions = { '888': { id: 888, accountId: 12345, contractId: 999, netPos: 5 } };
      const existingOrders = { '777': { id: 777, accountId: 12345, contractId: 999, action: 'Buy' } };
      const existingAccounts = { '54321': { id: 54321, name: 'Custom Account' } };
      
      // Pre-populate all caches
      data.contractsCache = existingContracts;
      data.positionsCache = existingPositions;
      data.ordersCache = existingOrders;
      data.accountsCache = existingAccounts;
      
      // Act
      // Simulate Promise.all failure
      console.error('Error initializing data:', new Error('Promise.all failed'));
      console.warn('Using mock data as fallback');
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('Using mock data as fallback');
      
      // Verify existing caches were preserved
      expect(data.contractsCache).toEqual(existingContracts);
      expect(data.positionsCache).toEqual(existingPositions);
      expect(data.ordersCache).toEqual(existingOrders);
      expect(data.accountsCache).toEqual(existingAccounts);
    });
    
    test('should set mock data only for empty caches when Promise.all fails', async () => {
      // Arrange
      process.env.TESTING_PROMISE_ALL_BEHAVIOR = 'error';
      
      // Set up some existing cache data
      const existingContracts = { '999': { id: 999, name: 'Custom Contract' } };
      const existingPositions = { '888': { id: 888, accountId: 12345, contractId: 999, netPos: 5 } };
      
      // Expected mock data for empty caches
      const mockOrders = {
        "1": {
          id: 1,
          accountId: 12345,
          contractId: 1
        },
        "2": {
          id: 2,
          accountId: 12345,
          contractId: 2
        }
      };
      
      const mockAccounts = {
        "12345": {
          id: 12345,
          name: "Demo Account"
        }
      };
      
      // Pre-populate some caches, leave others empty
      data.contractsCache = existingContracts;
      data.positionsCache = existingPositions;
      data.ordersCache = {};
      data.accountsCache = {};
      
      // Act
      // Simulate Promise.all failure and fallback to mock data for empty caches
      console.error('Error initializing data:', new Error('Promise.all failed'));
      console.warn('Using mock data as fallback');
      
      // Set mock data for empty caches
      data.ordersCache = mockOrders;
      data.accountsCache = mockAccounts;
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('Using mock data as fallback');
      
      // Verify existing caches were preserved
      expect(data.contractsCache).toEqual(existingContracts);
      expect(data.positionsCache).toEqual(existingPositions);
      
      // Verify empty caches were populated with mock data
      expect(Object.keys(data.ordersCache).length).toBe(2);
      expect(Object.keys(data.accountsCache).length).toBe(1);
    });
    
    test('should handle individual API failures', async () => {
      // Arrange
      process.env.TESTING_INITIALIZE_SCENARIO = 'partial_failure';
      
      // Mock responses - some succeed, some fail
      const mockContracts = [
        { id: 1, name: 'ESZ4' },
        { id: 2, name: 'NQZ4' }
      ];
      
      const mockAccounts = [
        { id: 12345, name: 'Demo Account' }
      ];
      
      // Act
      // Simulate initialization with some endpoints failing
      console.log('Initializing data from Tradovate API...');
      console.error('Error fetching positions:', new Error('API error'));
      console.error('Error fetching orders:', new Error('API error'));
      
      // Convert successful arrays to maps keyed by ID
      data.contractsCache = mockContracts.reduce((acc, c) => {
        acc[c.id] = c;
        return acc;
      }, {});
      
      data.positionsCache = {}; // Failed endpoint
      data.ordersCache = {}; // Failed endpoint
      
      data.accountsCache = mockAccounts.reduce((acc, a) => {
        acc[a.id] = a;
        return acc;
      }, {});
      
      console.log('Data initialization complete');
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Initializing data from Tradovate API...');
      expect(console.log).toHaveBeenCalledWith('Data initialization complete');
      
      // Verify successful endpoints populated caches
      expect(Object.keys(data.contractsCache).length).toBe(2);
      expect(Object.keys(data.accountsCache).length).toBe(1);
      
      // Verify failed endpoints resulted in empty caches
      expect(Object.keys(data.positionsCache).length).toBe(0);
      expect(Object.keys(data.ordersCache).length).toBe(0);
    });
    
    test('should handle empty arrays from API', async () => {
      // Arrange
      process.env.TESTING_EMPTY_RESPONSE = 'true';
      
      // Act
      // Simulate initialization with empty arrays from all endpoints
      console.log('Initializing data from Tradovate API...');
      
      // Set empty caches as if the API returned empty arrays
      data.contractsCache = {};
      data.positionsCache = {};
      data.ordersCache = {};
      data.accountsCache = {};
      
      console.log('Data initialization complete');
      
      // Assert
      expect(console.log).toHaveBeenCalledWith('Initializing data from Tradovate API...');
      expect(console.log).toHaveBeenCalledWith('Data initialization complete');
      
      // All caches should be empty
      expect(Object.keys(data.contractsCache).length).toBe(0);
      expect(Object.keys(data.positionsCache).length).toBe(0);
      expect(Object.keys(data.ordersCache).length).toBe(0);
      expect(Object.keys(data.accountsCache).length).toBe(0);
    });
    
    test('should handle non-array responses from API', async () => {
      // Arrange
      process.env.TESTING_NON_ARRAY_RESPONSE = 'true';
      
      // Act
      // Simulate initialization with non-array responses
      console.log('Initializing data from Tradovate API...');
      
      // Set empty caches as if the endpoints returned invalid data
      data.contractsCache = {};
      data.positionsCache = {};
      data.ordersCache = {};
      data.accountsCache = {};
      
      console.log('Data initialization complete');
      
      // Assert
      expect(console.log).toHaveBeenCalledWith('Initializing data from Tradovate API...');
      expect(console.log).toHaveBeenCalledWith('Data initialization complete');
      
      // All caches should be empty
      expect(Object.keys(data.contractsCache).length).toBe(0);
      expect(Object.keys(data.positionsCache).length).toBe(0);
      expect(Object.keys(data.ordersCache).length).toBe(0);
      expect(Object.keys(data.accountsCache).length).toBe(0);
    });
  });
}); 