const { describe, expect, test, beforeEach, afterEach } = require('@jest/globals');

// Mock the auth module
jest.mock('../src/auth.js', () => ({
  tradovateRequest: jest.fn()
}));

// Import the mocked tradovateRequest
const { tradovateRequest } = require('../src/auth.js');

// Import the data module directly
const data = require('../src/data.js');

describe('Data Module Fetch Functions Coverage Tests', () => {
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
  
  describe('fetchContracts function', () => {
    test('should fetch contracts successfully', async () => {
      // Arrange
      const mockContracts = [
        { id: 1, name: 'ESZ4' },
        { id: 2, name: 'NQZ4' }
      ];
      tradovateRequest.mockResolvedValue(mockContracts);
      
      // Act
      const result = await data.fetchContracts();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'contract/list');
      expect(result).toEqual({
        '1': mockContracts[0],
        '2': mockContracts[1]
      });
      expect(data.contractsCache).toEqual(result);
    });
    
    test('should handle API errors and return empty object if cache is empty', async () => {
      // Arrange
      tradovateRequest.mockRejectedValue(new Error('API error'));
      
      // Act
      const result = await data.fetchContracts();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'contract/list');
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual({});
    });
    
    test('should handle API errors and return existing cache if available', async () => {
      // Arrange
      const existingCache = {
        '999': { id: 999, name: 'Cached Contract' }
      };
      data.contractsCache = existingCache;
      tradovateRequest.mockRejectedValue(new Error('API error'));
      
      // Act
      const result = await data.fetchContracts();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'contract/list');
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual(existingCache);
    });
    
    test('should handle non-array response', async () => {
      // Arrange
      tradovateRequest.mockResolvedValue({ data: 'not an array' });
      
      // Act
      const result = await data.fetchContracts();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'contract/list');
      expect(result).toEqual({});
    });
    
    test('should handle empty array response', async () => {
      // Arrange
      tradovateRequest.mockResolvedValue([]);
      
      // Act
      const result = await data.fetchContracts();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'contract/list');
      expect(result).toEqual({});
    });
  });
  
  describe('fetchPositions function', () => {
    test('should fetch positions successfully', async () => {
      // Arrange
      const mockPositions = [
        { id: 1, accountId: 12345, contractId: 1 },
        { id: 2, accountId: 12345, contractId: 2 }
      ];
      tradovateRequest.mockResolvedValue(mockPositions);
      
      // Act
      const result = await data.fetchPositions();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'position/list');
      expect(result).toEqual({
        '1': mockPositions[0],
        '2': mockPositions[1]
      });
      expect(data.positionsCache).toEqual(result);
    });
    
    test('should handle API errors and return empty object if cache is empty', async () => {
      // Arrange
      tradovateRequest.mockRejectedValue(new Error('API error'));
      
      // Act
      const result = await data.fetchPositions();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'position/list');
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual({});
    });
    
    test('should handle API errors and return existing cache if available', async () => {
      // Arrange
      const existingCache = {
        '999': { id: 999, accountId: 12345, contractId: 999 }
      };
      data.positionsCache = existingCache;
      tradovateRequest.mockRejectedValue(new Error('API error'));
      
      // Act
      const result = await data.fetchPositions();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'position/list');
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual(existingCache);
    });
    
    test('should handle non-array response', async () => {
      // Arrange
      tradovateRequest.mockResolvedValue({ data: 'not an array' });
      
      // Act
      const result = await data.fetchPositions();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'position/list');
      expect(result).toEqual({});
    });
    
    test('should handle empty array response', async () => {
      // Arrange
      tradovateRequest.mockResolvedValue([]);
      
      // Act
      const result = await data.fetchPositions();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'position/list');
      expect(result).toEqual({});
    });
  });
  
  describe('fetchOrders function', () => {
    test('should fetch orders successfully', async () => {
      // Arrange
      const mockOrders = [
        { id: 1, accountId: 12345, contractId: 1 },
        { id: 2, accountId: 12345, contractId: 2 }
      ];
      tradovateRequest.mockResolvedValue(mockOrders);
      
      // Act
      const result = await data.fetchOrders();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'order/list');
      expect(result).toEqual({
        '1': mockOrders[0],
        '2': mockOrders[1]
      });
      expect(data.ordersCache).toEqual(result);
    });
    
    test('should handle API errors and return empty object if cache is empty', async () => {
      // Arrange
      tradovateRequest.mockRejectedValue(new Error('API error'));
      
      // Act
      const result = await data.fetchOrders();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'order/list');
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual({});
    });
    
    test('should handle API errors and return existing cache if available', async () => {
      // Arrange
      const existingCache = {
        '999': { id: 999, accountId: 12345, contractId: 999 }
      };
      data.ordersCache = existingCache;
      tradovateRequest.mockRejectedValue(new Error('API error'));
      
      // Act
      const result = await data.fetchOrders();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'order/list');
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual(existingCache);
    });
    
    test('should handle non-array response', async () => {
      // Arrange
      tradovateRequest.mockResolvedValue({ data: 'not an array' });
      
      // Act
      const result = await data.fetchOrders();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'order/list');
      expect(result).toEqual({});
    });
    
    test('should handle empty array response', async () => {
      // Arrange
      tradovateRequest.mockResolvedValue([]);
      
      // Act
      const result = await data.fetchOrders();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'order/list');
      expect(result).toEqual({});
    });
  });
  
  describe('fetchAccounts function', () => {
    test('should fetch accounts successfully', async () => {
      // Arrange
      const mockAccounts = [
        { id: 12345, name: 'Demo Account' },
        { id: 67890, name: 'Live Account' }
      ];
      tradovateRequest.mockResolvedValue(mockAccounts);
      
      // Act
      const result = await data.fetchAccounts();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'account/list');
      expect(result).toEqual({
        '12345': mockAccounts[0],
        '67890': mockAccounts[1]
      });
      expect(data.accountsCache).toEqual(result);
    });
    
    test('should handle API errors and return empty object if cache is empty', async () => {
      // Arrange
      tradovateRequest.mockRejectedValue(new Error('API error'));
      
      // Act
      const result = await data.fetchAccounts();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'account/list');
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual({});
    });
    
    test('should handle API errors and return existing cache if available', async () => {
      // Arrange
      const existingCache = {
        '54321': { id: 54321, name: 'Cached Account' }
      };
      data.accountsCache = existingCache;
      tradovateRequest.mockRejectedValue(new Error('API error'));
      
      // Act
      const result = await data.fetchAccounts();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'account/list');
      expect(console.error).toHaveBeenCalled();
      expect(result).toEqual(existingCache);
    });
    
    test('should handle non-array response', async () => {
      // Arrange
      tradovateRequest.mockResolvedValue({ data: 'not an array' });
      
      // Act
      const result = await data.fetchAccounts();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'account/list');
      expect(result).toEqual({});
    });
    
    test('should handle empty array response', async () => {
      // Arrange
      tradovateRequest.mockResolvedValue([]);
      
      // Act
      const result = await data.fetchAccounts();
      
      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'account/list');
      expect(result).toEqual({});
    });
  });
}); 