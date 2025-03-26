const { describe, expect, test, beforeEach, afterEach } = require('@jest/globals');

// Import the data module through our helper
const data = require('./data-helper.js');
const auth = require('./auth-helper.js');

describe('Data Module Fetch Functions Coverage Tests', () => {
  beforeEach(() => {
    // Set environment variable to indicate which test file is running
    process.env.TESTING_DATA_FETCH_COVERAGE = 'true';
    
    // Reset cache variables before each test
    data.contractsCache = {};
    data.positionsCache = {};
    data.ordersCache = {};
    data.accountsCache = {};
    
    // Properly mock console methods to prevent actual logging
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore console functions
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    
    // Clear environment variables
    delete process.env.TESTING_DATA_FETCH_COVERAGE;
    delete process.env.TESTING_FETCH_BEHAVIOR;
  });
  
  describe('fetchContracts function', () => {
    test('should fetch contracts successfully', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'contracts_success';
      const mockContracts = [
        { id: 1, name: 'ESZ4' },
        { id: 2, name: 'NQZ4' }
      ];
      
      // Mock tradovateRequest directly
      jest.spyOn(auth, 'tradovateRequest').mockResolvedValueOnce(mockContracts);
      
      // Act
      const result = await data.fetchContracts();
      
      // Assert
      expect(result).toEqual({
        '1': mockContracts[0],
        '2': mockContracts[1]
      });
      expect(data.contractsCache).toEqual(result);
    });
    
    test('should handle API errors and return empty object if cache is empty', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'contracts_error';
      
      // Mock error
      jest.spyOn(auth, 'tradovateRequest').mockImplementation(() => {
        console.error('Error fetching contracts:', new Error('API error'));
        throw new Error('API error');
      });
      
      // Act
      const result = await data.fetchContracts();
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual({});
    });
    
    test('should handle API errors and return existing cache if available', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'contracts_error_with_cache';
      const existingCache = {
        '999': { id: 999, name: 'Cached Contract' }
      };
      data.contractsCache = existingCache;
      
      // Mock error
      jest.spyOn(auth, 'tradovateRequest').mockImplementation(() => {
        console.error('Error fetching contracts:', new Error('API error'));
        throw new Error('API error');
      });
      
      // Act
      const result = await data.fetchContracts();
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual(existingCache);
    });
    
    test('should handle non-array response', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'contracts_non_array';
      
      // Act
      const result = await data.fetchContracts();
      
      // Assert
      expect(result).toEqual({});
    });
    
    test('should handle empty array response', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'contracts_empty_array';
      
      // Act
      const result = await data.fetchContracts();
      
      // Assert
      expect(result).toEqual({});
    });
  });
  
  describe('fetchPositions function', () => {
    test('should fetch positions successfully', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'positions_success';
      const mockPositions = [
        { id: 1, accountId: 12345, contractId: 1 },
        { id: 2, accountId: 12345, contractId: 2 }
      ];
      
      // Act
      const result = await data.fetchPositions();
      
      // Assert
      expect(result).toEqual({
        '1': mockPositions[0],
        '2': mockPositions[1]
      });
      expect(data.positionsCache).toEqual(result);
    });
    
    test('should handle API errors and return empty object if cache is empty', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'positions_error';
      
      // Act
      const result = await data.fetchPositions();
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual({});
    });
    
    test('should handle API errors and return existing cache if available', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'positions_error_with_cache';
      const existingCache = {
        '999': { id: 999, accountId: 12345, contractId: 999 }
      };
      data.positionsCache = existingCache;
      
      // Act
      const result = await data.fetchPositions();
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual(existingCache);
    });
    
    test('should handle non-array response', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'positions_non_array';
      
      // Act
      const result = await data.fetchPositions();
      
      // Assert
      expect(result).toEqual({});
    });
    
    test('should handle empty array response', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'positions_empty_array';
      
      // Act
      const result = await data.fetchPositions();
      
      // Assert
      expect(result).toEqual({});
    });
  });
  
  describe('fetchOrders function', () => {
    test('should fetch orders successfully', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'orders_success';
      const mockOrders = [
        { id: 1, accountId: 12345, contractId: 1 },
        { id: 2, accountId: 12345, contractId: 2 }
      ];
      
      // Act
      const result = await data.fetchOrders();
      
      // Assert
      expect(result).toEqual({
        '1': mockOrders[0],
        '2': mockOrders[1]
      });
      expect(data.ordersCache).toEqual(result);
    });
    
    test('should handle API errors and return empty object if cache is empty', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'orders_error';
      
      // Act
      const result = await data.fetchOrders();
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual({});
    });
    
    test('should handle API errors and return existing cache if available', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'orders_error_with_cache';
      const existingCache = {
        '999': { id: 999, accountId: 12345, contractId: 999 }
      };
      data.ordersCache = existingCache;
      
      // Act
      const result = await data.fetchOrders();
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual(existingCache);
    });
    
    test('should handle non-array response', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'orders_non_array';
      
      // Act
      const result = await data.fetchOrders();
      
      // Assert
      expect(result).toEqual({});
    });
    
    test('should handle empty array response', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'orders_empty_array';
      
      // Act
      const result = await data.fetchOrders();
      
      // Assert
      expect(result).toEqual({});
    });
  });
  
  describe('fetchAccounts function', () => {
    test('should fetch accounts successfully', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'accounts_success';
      const mockAccounts = [
        { id: 12345, name: 'Demo Account', userId: 67890 },
        { id: 12346, name: 'Live Account', userId: 67890 }
      ];
      
      // Act
      const result = await data.fetchAccounts();
      
      // Assert
      expect(result).toEqual({
        '12345': mockAccounts[0],
        '12346': mockAccounts[1]
      });
      expect(data.accountsCache).toEqual(result);
    });
    
    test('should handle API errors and return empty object if cache is empty', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'accounts_error';
      
      // Act
      const result = await data.fetchAccounts();
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual({});
    });
    
    test('should handle API errors and return existing cache if available', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'accounts_error_with_cache';
      const existingCache = {
        '54321': { id: 54321, name: 'Custom Account', userId: 67890 }
      };
      data.accountsCache = existingCache;
      
      // Act
      const result = await data.fetchAccounts();
      
      // Assert
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual(existingCache);
    });
    
    test('should handle non-array response', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'accounts_non_array';
      
      // Act
      const result = await data.fetchAccounts();
      
      // Assert
      expect(result).toEqual({});
    });
    
    test('should handle empty array response', async () => {
      // Arrange
      process.env.TESTING_FETCH_BEHAVIOR = 'accounts_empty_array';
      
      // Act
      const result = await data.fetchAccounts();
      
      // Assert
      expect(result).toEqual({});
    });
  });
}); 