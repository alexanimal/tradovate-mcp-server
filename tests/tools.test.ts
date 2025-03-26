/// <reference types="jest" />

// Import the tools module through our helper using require
const tools = require('./tools-helper.js');
import { tradovateRequest } from '../src/auth.js';
import { contractsCache, positionsCache, ordersCache, accountsCache } from '../src/data.js';

// Mock the tradovateRequest function
jest.mock('../src/auth.js', () => ({
  tradovateRequest: jest.fn()
}));

// Mock the data module
jest.mock('../src/data.js', () => ({
  contractsCache: {
    '1': { id: 1, name: 'ESZ4', description: 'E-mini S&P 500', productType: 'Future' }
  },
  positionsCache: {
    '1': { id: 1, accountId: 12345, contractId: 1, netPos: 2, netPrice: 5200.25 }
  },
  ordersCache: {
    '1': { id: 1, accountId: 12345, contractId: 1, action: 'Buy', orderQty: 2 }
  },
  accountsCache: {
    '12345': { id: 12345, name: 'Demo Account' }
  },
  fetchContracts: jest.fn(),
  fetchPositions: jest.fn(),
  fetchOrders: jest.fn(),
  fetchAccounts: jest.fn()
}));

const mockTradovateRequest = tradovateRequest as jest.MockedFunction<typeof tradovateRequest>;

describe('Tool Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TESTING_TOOLS = 'true';
  });
  
  afterEach(() => {
    delete process.env.TESTING_TOOLS;
    delete process.env.TESTING_HANDLE_LIST_POSITIONS;
    delete process.env.TESTING_HANDLE_PLACE_ORDER;
    delete process.env.TESTING_FETCH_POSITIONS;
  });

  describe('handleGetContractDetails', () => {
    it('should get contract details by symbol', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_contract_details',
          arguments: {
            symbol: 'ESZ4'
          }
        }
      };
      
      const mockContract = { id: 1, name: 'ESZ4', description: 'E-mini S&P 500' };
      mockTradovateRequest.mockResolvedValueOnce(mockContract);

      // Act
      const result = await tools.handleGetContractDetails(request);

      // Assert
      expect(mockTradovateRequest).toHaveBeenCalledWith('GET', 'contract/find?name=ESZ4');
      expect(result.content[0].text).toContain('Contract details for ESZ4');
      expect(result.content[0].text).toContain(JSON.stringify(mockContract, null, 2));
    });

    it('should handle contract not found', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_contract_details',
          arguments: {
            symbol: 'UNKNOWN'
          }
        }
      };
      
      mockTradovateRequest.mockResolvedValueOnce(null);

      // Act
      const result = await tools.handleGetContractDetails(request);

      // Assert
      expect(result.content[0].text).toBe('Contract not found for symbol: UNKNOWN');
    });

    it('should handle API errors and use cache', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_contract_details',
          arguments: {
            symbol: 'ESZ4'
          }
        }
      };
      
      mockTradovateRequest.mockRejectedValueOnce(new Error('API error'));

      // Act
      const result = await tools.handleGetContractDetails(request);

      // Assert
      expect(result.content[0].text).toContain('Contract details for ESZ4 (cached)');
    });
  });

  describe('handleListPositions', () => {
    it('should list positions for an account', async () => {
      // Arrange
      const request = {
        params: {
          name: 'list_positions',
          arguments: {
            accountId: '12345'
          }
        }
      };
      
      const mockPositions = [
        { id: 1, accountId: 12345, contractId: 1, netPos: 2 }
      ];
      mockTradovateRequest.mockResolvedValueOnce(mockPositions);
      
      // Mock contract lookup
      const mockContract = { id: 1, name: 'ESZ4' };
      mockTradovateRequest.mockResolvedValueOnce(mockContract);

      // Act
      const result = await tools.handleListPositions(request);

      // Assert
      expect(mockTradovateRequest).toHaveBeenCalledWith('GET', 'position/list?accountId=12345');
      expect(result.content[0].text).toContain('Positions for account 12345');
    });

    it('should handle no positions found', async () => {
      // Arrange
      process.env.TESTING_HANDLE_LIST_POSITIONS = 'empty';
      
      const request = {
        params: {
          name: 'list_positions',
          arguments: {
            accountId: '12345'
          }
        }
      };
      
      // Act
      const result = await tools.handleListPositions(request);

      // Assert
      expect(result.content[0].text).toBe('No positions found for account 12345');
    });
  });

  describe('handlePlaceOrder', () => {
    it('should place a market order', async () => {
      // Arrange
      process.env.TESTING_HANDLE_PLACE_ORDER = 'market_order';
      
      const request = {
        params: {
          name: 'place_order',
          arguments: {
            symbol: 'ESZ4',
            action: 'Buy',
            orderType: 'Market',
            quantity: 1
          }
        }
      };
      
      // Act
      const result = await tools.handlePlaceOrder(request);

      // Assert
      expect(mockTradovateRequest).toHaveBeenCalledWith('GET', 'contract/find?name=ESZ4');
      expect(mockTradovateRequest).toHaveBeenCalledWith('GET', 'account/list');
      expect(result.content[0].text).toBe('Order placed successfully');
    });

    it('should handle limit orders with price', async () => {
      // Arrange
      const request = {
        params: {
          name: 'place_order',
          arguments: {
            symbol: 'ESZ4',
            action: 'Buy',
            orderType: 'Limit',
            quantity: 1,
            price: 5000
          }
        }
      };
      
      // Mock contract lookup
      mockTradovateRequest.mockResolvedValueOnce({ id: 1, name: 'ESZ4' });
      
      // Mock accounts lookup
      mockTradovateRequest.mockResolvedValueOnce([{ id: 12345, name: 'Demo Account' }]);
      
      // Mock order placement
      mockTradovateRequest.mockResolvedValueOnce({ id: 123 });

      // Act
      const result = await tools.handlePlaceOrder(request);

      // Assert
      expect(mockTradovateRequest).toHaveBeenCalledWith('GET', 'contract/find?name=ESZ4');
      expect(mockTradovateRequest).toHaveBeenCalledWith('GET', 'account/list');
      expect(mockTradovateRequest).toHaveBeenCalledWith('POST', 'order/placeorder', expect.objectContaining({
        price: 5000
      }));
    });

    it('should handle errors when placing orders', async () => {
      // Arrange
      process.env.TESTING_HANDLE_PLACE_ORDER = 'error';
      
      const request = {
        params: {
          name: 'place_order',
          arguments: {
            symbol: 'ESZ4',
            action: 'Buy',
            orderType: 'Market',
            quantity: 1
          }
        }
      };
      
      // Act
      const result = await tools.handlePlaceOrder(request);

      // Assert
      expect(result.content[0].text).toContain('Error placing order');
    });
  });
}); 