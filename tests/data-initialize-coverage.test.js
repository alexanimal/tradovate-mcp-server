const { describe, expect, test, beforeEach, afterEach } = require('@jest/globals');

// Mock the auth module
jest.mock('../src/auth.js', () => ({
  tradovateRequest: jest.fn()
}));

// Import the mocked tradovateRequest
const { tradovateRequest } = require('../src/auth.js');

// Import the data module directly
const data = require('../src/data.js');

describe('Data Module Initialize Coverage Tests', () => {
  // Store original console methods
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset cache variables before each test
    data.contractsCache = {};
    data.positionsCache = {};
    data.ordersCache = {};
    data.accountsCache = {};
    
    // Mock console methods to prevent actual logging
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });
  
  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });
  
  describe('initializeData function', () => {
    test('should initialize all data sources successfully', async () => {
      // Arrange
      const mockContracts = [{ id: 1, name: 'ESZ4' }];
      const mockPositions = [{ id: 1, accountId: 12345, contractId: 1 }];
      const mockOrders = [{ id: 1, accountId: 12345, contractId: 1 }];
      const mockAccounts = [{ id: 12345, name: 'Demo Account' }];
      
      tradovateRequest.mockResolvedValueOnce(mockContracts)
                      .mockResolvedValueOnce(mockPositions)
                      .mockResolvedValueOnce(mockOrders)
                      .mockResolvedValueOnce(mockAccounts);
      
      // Act
      await data.initializeData();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledTimes(4);
      expect(console.log).toHaveBeenCalledWith('Initializing data from Tradovate API...');
      expect(console.log).toHaveBeenCalledWith('Data initialization complete');
      
      // Verify caches were updated
      expect(data.contractsCache).toEqual({ '1': mockContracts[0] });
      expect(data.positionsCache).toEqual({ '1': mockPositions[0] });
      expect(data.ordersCache).toEqual({ '1': mockOrders[0] });
      expect(data.accountsCache).toEqual({ '12345': mockAccounts[0] });
    });
    
    test('should handle error in Promise.all and use mock data for all empty caches', async () => {
      // Arrange - Make Promise.all throw an error
      const originalPromiseAll = Promise.all;
      Promise.all = jest.fn().mockRejectedValue(new Error('Promise.all error'));
      
      // Act
      await data.initializeData();
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('Using mock data as fallback');
      
      // Verify mock data was set for all caches
      expect(Object.keys(data.contractsCache).length).toBe(2);
      expect(Object.keys(data.positionsCache).length).toBe(2);
      expect(Object.keys(data.ordersCache).length).toBe(2);
      expect(Object.keys(data.accountsCache).length).toBe(1);
      
      // Verify the structure of the mock data
      expect(data.contractsCache['1']).toHaveProperty('id', 1);
      expect(data.contractsCache['1']).toHaveProperty('name', 'ESZ4');
      expect(data.contractsCache['1']).toHaveProperty('productType', 'Future');
      
      expect(data.positionsCache['1']).toHaveProperty('id', 1);
      expect(data.positionsCache['1']).toHaveProperty('accountId', 12345);
      expect(data.positionsCache['1']).toHaveProperty('contractId', 1);
      
      expect(data.ordersCache['1']).toHaveProperty('id', 1);
      expect(data.ordersCache['1']).toHaveProperty('accountId', 12345);
      expect(data.ordersCache['1']).toHaveProperty('contractId', 1);
      
      expect(data.accountsCache['12345']).toHaveProperty('id', 12345);
      expect(data.accountsCache['12345']).toHaveProperty('name', 'Demo Account');
      
      // Restore original Promise.all
      Promise.all = originalPromiseAll;
    });
    
    test('should not overwrite non-empty caches with mock data when Promise.all fails', async () => {
      // Arrange - Make Promise.all throw an error
      const originalPromiseAll = Promise.all;
      Promise.all = jest.fn().mockRejectedValue(new Error('Promise.all error'));
      
      // Set up existing cache data
      const existingContracts = { '999': { id: 999, name: 'Custom Contract' } };
      const existingPositions = { '888': { id: 888, accountId: 12345, contractId: 999, netPos: 5 } };
      const existingOrders = { '777': { id: 777, accountId: 12345, contractId: 999, action: 'Buy' } };
      const existingAccounts = { '54321': { id: 54321, name: 'Custom Account' } };
      
      data.contractsCache = existingContracts;
      data.positionsCache = existingPositions;
      data.ordersCache = existingOrders;
      data.accountsCache = existingAccounts;
      
      // Act
      await data.initializeData();
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('Using mock data as fallback');
      
      // Verify existing caches were preserved
      expect(data.contractsCache).toEqual(existingContracts);
      expect(data.positionsCache).toEqual(existingPositions);
      expect(data.ordersCache).toEqual(existingOrders);
      expect(data.accountsCache).toEqual(existingAccounts);
      
      // Restore original Promise.all
      Promise.all = originalPromiseAll;
    });
    
    test('should set mock data only for empty caches when Promise.all fails', async () => {
      // Arrange - Make Promise.all throw an error
      const originalPromiseAll = Promise.all;
      Promise.all = jest.fn().mockRejectedValue(new Error('Promise.all error'));
      
      // Set up some existing cache data, but leave others empty
      const existingContracts = { '999': { id: 999, name: 'Custom Contract' } };
      const existingPositions = { '888': { id: 888, accountId: 12345, contractId: 999, netPos: 5 } };
      
      data.contractsCache = existingContracts;
      data.positionsCache = existingPositions;
      // ordersCache and accountsCache remain empty
      
      // Act
      await data.initializeData();
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('Using mock data as fallback');
      
      // Verify existing caches were preserved
      expect(data.contractsCache).toEqual(existingContracts);
      expect(data.positionsCache).toEqual(existingPositions);
      
      // Verify mock data was set for empty caches
      expect(Object.keys(data.ordersCache).length).toBe(2);
      expect(Object.keys(data.accountsCache).length).toBe(1);
      
      // Verify the structure of the mock data
      expect(data.ordersCache['1']).toHaveProperty('id', 1);
      expect(data.ordersCache['1']).toHaveProperty('accountId', 12345);
      expect(data.ordersCache['1']).toHaveProperty('contractId', 1);
      
      expect(data.accountsCache['12345']).toHaveProperty('id', 12345);
      expect(data.accountsCache['12345']).toHaveProperty('name', 'Demo Account');
      
      // Restore original Promise.all
      Promise.all = originalPromiseAll;
    });
    
    test('should handle individual API failures', async () => {
      // Arrange
      const mockContracts = [{ id: 1, name: 'ESZ4' }];
      const mockAccounts = [{ id: 12345, name: 'Demo Account' }];
      
      // First and fourth calls succeed, others fail
      tradovateRequest.mockResolvedValueOnce(mockContracts)
                      .mockRejectedValueOnce(new Error('API error'))
                      .mockRejectedValueOnce(new Error('API error'))
                      .mockResolvedValueOnce(mockAccounts);
      
      // Act
      await data.initializeData();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledTimes(4);
      expect(console.error).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Initializing data from Tradovate API...');
      expect(console.log).toHaveBeenCalledWith('Data initialization complete');
      
      // Verify successful caches were updated
      expect(data.contractsCache).toEqual({ '1': mockContracts[0] });
      expect(data.accountsCache).toEqual({ '12345': mockAccounts[0] });
      
      // Failed caches should be empty
      expect(data.positionsCache).toEqual({});
      expect(data.ordersCache).toEqual({});
    });
    
    test('should handle empty arrays from API', async () => {
      // Arrange
      tradovateRequest.mockResolvedValue([]);
      
      // Act
      await data.initializeData();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledTimes(4);
      expect(console.log).toHaveBeenCalledWith('Initializing data from Tradovate API...');
      expect(console.log).toHaveBeenCalledWith('Data initialization complete');
      
      // All caches should be empty
      expect(data.contractsCache).toEqual({});
      expect(data.positionsCache).toEqual({});
      expect(data.ordersCache).toEqual({});
      expect(data.accountsCache).toEqual({});
    });
    
    test('should handle non-array responses from API', async () => {
      // Arrange
      tradovateRequest.mockResolvedValue({ data: 'not an array' });
      
      // Act
      await data.initializeData();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledTimes(4);
      expect(console.log).toHaveBeenCalledWith('Initializing data from Tradovate API...');
      expect(console.log).toHaveBeenCalledWith('Data initialization complete');
      
      // All caches should be empty
      expect(data.contractsCache).toEqual({});
      expect(data.positionsCache).toEqual({});
      expect(data.ordersCache).toEqual({});
      expect(data.accountsCache).toEqual({});
    });
  });
}); 