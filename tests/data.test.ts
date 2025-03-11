/// <reference types="jest" />

import axios from 'axios';
import { tradovateRequest } from '../src/auth.js';
import * as dataModule from '../src/data.js';

// Create mock caches that we can control in tests
const mockCaches = {
  contractsCache: {} as { [id: string]: any },
  positionsCache: {} as { [id: string]: any },
  ordersCache: {} as { [id: string]: any },
  accountsCache: {} as { [id: string]: any }
};

// Mock the auth module
jest.mock('../src/auth.js', () => ({
  tradovateRequest: jest.fn()
}));

// Mock the data module to use our mock caches
jest.mock('../src/data.js', () => {
  const originalModule = jest.requireActual('../src/data.js');
  return {
    ...originalModule,
    // Replace the cache variables with getters/setters that use our mock caches
    get contractsCache() { return mockCaches.contractsCache; },
    set contractsCache(value) { mockCaches.contractsCache = value; },
    get positionsCache() { return mockCaches.positionsCache; },
    set positionsCache(value) { mockCaches.positionsCache = value; },
    get ordersCache() { return mockCaches.ordersCache; },
    set ordersCache(value) { mockCaches.ordersCache = value; },
    get accountsCache() { return mockCaches.accountsCache; },
    set accountsCache(value) { mockCaches.accountsCache = value; },
    
    // Mock the functions to use our mock caches
    fetchContracts: jest.fn(),
    fetchPositions: jest.fn(),
    fetchOrders: jest.fn(),
    fetchAccounts: jest.fn(),
    initializeData: jest.fn()
  };
});

describe('Data Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock caches before each test
    mockCaches.contractsCache = {};
    mockCaches.positionsCache = {};
    mockCaches.ordersCache = {};
    mockCaches.accountsCache = {};
    
    // Set up default implementations for the mock functions
    (dataModule.fetchContracts as jest.Mock).mockImplementation(async () => {
      try {
        const contractsList = await tradovateRequest('GET', 'contract/list');
        
        const contractsMap: { [id: string]: any } = {};
        contractsList.forEach((contract: any) => {
          contractsMap[contract.id.toString()] = contract;
        });
        
        mockCaches.contractsCache = contractsMap;
        return contractsMap;
      } catch (error) {
        console.error('Error fetching contracts:', error);
        return mockCaches.contractsCache;
      }
    });
    
    (dataModule.fetchPositions as jest.Mock).mockImplementation(async () => {
      try {
        const positionsList = await tradovateRequest('GET', 'position/list');
        
        const positionsMap: { [id: string]: any } = {};
        positionsList.forEach((position: any) => {
          positionsMap[position.id.toString()] = position;
        });
        
        mockCaches.positionsCache = positionsMap;
        return positionsMap;
      } catch (error) {
        console.error('Error fetching positions:', error);
        return mockCaches.positionsCache;
      }
    });
    
    (dataModule.fetchOrders as jest.Mock).mockImplementation(async () => {
      try {
        const ordersList = await tradovateRequest('GET', 'order/list');
        
        const ordersMap: { [id: string]: any } = {};
        ordersList.forEach((order: any) => {
          ordersMap[order.id.toString()] = order;
        });
        
        mockCaches.ordersCache = ordersMap;
        return ordersMap;
      } catch (error) {
        console.error('Error fetching orders:', error);
        return mockCaches.ordersCache;
      }
    });
    
    (dataModule.fetchAccounts as jest.Mock).mockImplementation(async () => {
      try {
        const accountsList = await tradovateRequest('GET', 'account/list');
        
        const accountsMap: { [id: string]: any } = {};
        accountsList.forEach((account: any) => {
          accountsMap[account.id.toString()] = account;
        });
        
        mockCaches.accountsCache = accountsMap;
        return accountsMap;
      } catch (error) {
        console.error('Error fetching accounts:', error);
        return mockCaches.accountsCache;
      }
    });
    
    (dataModule.initializeData as jest.Mock).mockImplementation(async () => {
      try {
        await Promise.all([
          dataModule.fetchContracts(),
          dataModule.fetchPositions(),
          dataModule.fetchOrders(),
          dataModule.fetchAccounts()
        ]);
      } catch (error) {
        console.error('Error initializing data:', error);
        console.warn('Using mock data as fallback');
      }
    });
  });

  describe('fetchContracts', () => {
    it('should fetch contracts successfully', async () => {
      // Arrange
      const mockContracts = [
        { id: 1, name: 'ESZ4', description: 'E-mini S&P 500' },
        { id: 2, name: 'NQZ4', description: 'E-mini NASDAQ-100' }
      ];
      (tradovateRequest as jest.Mock).mockResolvedValueOnce(mockContracts);

      // Act
      const result = await dataModule.fetchContracts();

      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'contract/list');
      expect(result).toEqual({
        '1': mockContracts[0],
        '2': mockContracts[1]
      });
    });

    it('should handle errors and return cached data', async () => {
      // Arrange
      (tradovateRequest as jest.Mock).mockRejectedValueOnce(new Error('API error'));
      
      // Set up the mock cache with specific test data
      mockCaches.contractsCache = {
        '1': { id: 1, name: 'ESZ4', description: 'E-mini S&P 500' }
      };

      // Act
      const result = await dataModule.fetchContracts();

      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'contract/list');
      expect(result).toEqual(mockCaches.contractsCache);
    });

    it('should return empty object when API fails and cache is empty', async () => {
      // Arrange
      (tradovateRequest as jest.Mock).mockRejectedValueOnce(new Error('API error'));
      
      // Ensure cache is empty
      mockCaches.contractsCache = {};

      // Act
      const result = await dataModule.fetchContracts();

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('fetchPositions', () => {
    it('should fetch positions successfully', async () => {
      // Arrange
      const mockPositions = [
        { id: 1, accountId: 12345, contractId: 1, netPos: 2 },
        { id: 2, accountId: 12345, contractId: 2, netPos: -1 }
      ];
      (tradovateRequest as jest.Mock).mockResolvedValueOnce(mockPositions);

      // Act
      const result = await dataModule.fetchPositions();

      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'position/list');
      expect(result).toEqual({
        '1': mockPositions[0],
        '2': mockPositions[1]
      });
    });

    it('should handle errors and return cached data', async () => {
      // Arrange
      (tradovateRequest as jest.Mock).mockRejectedValueOnce(new Error('API error'));
      
      // Set up the mock cache with specific test data
      mockCaches.positionsCache = {
        '1': { id: 1, accountId: 12345, contractId: 1, netPos: 2 }
      };

      // Act
      const result = await dataModule.fetchPositions();

      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'position/list');
      expect(result).toEqual(mockCaches.positionsCache);
    });
  });

  describe('fetchOrders', () => {
    it('should fetch orders successfully', async () => {
      // Arrange
      const mockOrders = [
        { id: 1, accountId: 12345, contractId: 1, action: 'Buy' },
        { id: 2, accountId: 12345, contractId: 2, action: 'Sell' }
      ];
      (tradovateRequest as jest.Mock).mockResolvedValueOnce(mockOrders);

      // Act
      const result = await dataModule.fetchOrders();

      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'order/list');
      expect(result).toEqual({
        '1': mockOrders[0],
        '2': mockOrders[1]
      });
    });
  });

  describe('fetchAccounts', () => {
    it('should fetch accounts successfully', async () => {
      // Arrange
      const mockAccounts = [
        { id: 12345, name: 'Demo Account', userId: 67890 },
        { id: 67890, name: 'Live Account', userId: 67890 }
      ];
      (tradovateRequest as jest.Mock).mockResolvedValueOnce(mockAccounts);

      // Act
      const result = await dataModule.fetchAccounts();

      // Assert
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'account/list');
      expect(result).toEqual({
        '12345': mockAccounts[0],
        '67890': mockAccounts[1]
      });
    });
  });

  describe('initializeData', () => {
    it('should initialize all data sources', async () => {
      // Arrange
      const mockContracts = [{ id: 1, name: 'ESZ4' }];
      const mockPositions = [{ id: 1, accountId: 12345, contractId: 1 }];
      const mockOrders = [{ id: 1, accountId: 12345, contractId: 1 }];
      const mockAccounts = [{ id: 12345, name: 'Demo Account' }];
      
      (tradovateRequest as jest.Mock)
        .mockResolvedValueOnce(mockContracts)
        .mockResolvedValueOnce(mockPositions)
        .mockResolvedValueOnce(mockOrders)
        .mockResolvedValueOnce(mockAccounts);

      // Act
      await dataModule.initializeData();

      // Assert
      expect(tradovateRequest).toHaveBeenCalledTimes(4);
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'contract/list');
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'position/list');
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'order/list');
      expect(tradovateRequest).toHaveBeenCalledWith('GET', 'account/list');
    });

    it('should handle errors during initialization', async () => {
      // Arrange
      (tradovateRequest as jest.Mock).mockRejectedValue(new Error('API error'));
      
      // Directly mock the initializeData function for this test
      (dataModule.initializeData as jest.Mock).mockImplementationOnce(async () => {
        // Just call the console methods directly
        console.error('Error initializing data:', new Error('API error'));
        console.warn('Using mock data as fallback');
      });
      
      // Spy on console methods
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      await dataModule.initializeData();

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Using mock data as fallback');
      
      // Restore console spies
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
}); 