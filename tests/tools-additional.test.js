const { describe, expect, test, beforeEach } = require('@jest/globals');

// Import the modules we need to test
const auth = require('../src/auth.js');
const data = require('../src/data.js');
const { 
  handleModifyOrder,
  handleCancelOrder,
  handleGetAccountSummary,
  handleGetMarketData
} = require('../src/tools.js');

// Mock the modules
jest.mock('../src/auth.js');
jest.mock('../src/data.js');

// Set up mock data
data.contractsCache = {
  '1': { id: 1, name: 'ESZ4', description: 'E-mini S&P 500', productType: 'Future' }
};
data.positionsCache = {
  '1': { id: 1, accountId: 12345, contractId: 1, netPos: 2, netPrice: 5200.25 }
};
data.ordersCache = {
  '1': { id: 1, accountId: 12345, contractId: 1, action: 'Buy', orderQty: 2, orderType: 'Limit', price: 4500.25 }
};
data.accountsCache = {
  '12345': { id: 12345, name: 'Demo Account', cashBalance: 10000, marginBalance: 8000 }
};

describe('Additional Tool Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up the tradovateRequest mock for each test
    auth.tradovateRequest = jest.fn();
  });

  describe('handleModifyOrder', () => {
    it('should modify an existing order', async () => {
      // Arrange
      const request = {
        params: {
          name: 'modify_order',
          arguments: {
            orderId: '1',
            price: 4600.50,
            quantity: 3
          }
        }
      };
      
      // Mock order lookup
      auth.tradovateRequest.mockResolvedValueOnce({ id: 1, accountId: 12345, contractId: 1, action: 'Buy', orderQty: 2, orderType: 'Limit', price: 4500.25 });
      
      // Mock order modification
      const mockModifiedOrder = { id: 1, accountId: 12345, contractId: 1, action: 'Buy', orderQty: 3, orderType: 'Limit', price: 4600.50 };
      auth.tradovateRequest.mockResolvedValueOnce(mockModifiedOrder);

      // Act
      const result = await handleModifyOrder(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'order/find?id=1');
      expect(auth.tradovateRequest).toHaveBeenCalledWith('POST', 'order/modifyOrder', expect.objectContaining({
        orderId: 1,
        orderQty: 3,
        price: 4600.50
      }));
      expect(result.content[0].text).toContain('Order modified successfully');
    });

    it('should handle order not found', async () => {
      // Arrange
      const request = {
        params: {
          name: 'modify_order',
          arguments: {
            orderId: '999',
            price: 4600.50
          }
        }
      };
      
      // Mock order lookup failure
      auth.tradovateRequest.mockResolvedValueOnce(null);

      // Act
      const result = await handleModifyOrder(request);

      // Assert
      expect(result.content[0].text).toBe('Order not found with ID: 999');
    });

    it('should handle API errors', async () => {
      // Arrange
      const request = {
        params: {
          name: 'modify_order',
          arguments: {
            orderId: '1',
            price: 4600.50
          }
        }
      };
      
      // Mock order lookup
      auth.tradovateRequest.mockResolvedValueOnce({ id: 1, accountId: 12345, contractId: 1, action: 'Buy', orderQty: 2, orderType: 'Limit', price: 4500.25 });
      
      // Mock API error
      auth.tradovateRequest.mockRejectedValueOnce(new Error('API error'));

      // Act
      const result = await handleModifyOrder(request);

      // Assert
      expect(result.content[0].text).toContain('Order modified successfully (simulated)');
    });
  });

  describe('handleCancelOrder', () => {
    it('should cancel an existing order', async () => {
      // Arrange
      const request = {
        params: {
          name: 'cancel_order',
          arguments: {
            orderId: '1'
          }
        }
      };
      
      // Mock order lookup
      auth.tradovateRequest.mockResolvedValueOnce({ id: 1, accountId: 12345, contractId: 1, action: 'Buy', orderQty: 2 });
      
      // Mock order cancellation
      const mockCancelledOrder = { id: 1, status: 'Cancelled' };
      auth.tradovateRequest.mockResolvedValueOnce(mockCancelledOrder);

      // Act
      const result = await handleCancelOrder(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'order/find?id=1');
      expect(auth.tradovateRequest).toHaveBeenCalledWith('POST', 'order/cancelOrder', expect.objectContaining({
        orderId: 1
      }));
      expect(result.content[0].text).toContain('Order canceled successfully');
    });

    it('should handle order not found', async () => {
      // Arrange
      const request = {
        params: {
          name: 'cancel_order',
          arguments: {
            orderId: '999'
          }
        }
      };
      
      // Mock order lookup failure
      auth.tradovateRequest.mockResolvedValueOnce(null);

      // Act
      const result = await handleCancelOrder(request);

      // Assert
      expect(result.content[0].text).toBe('Order not found with ID: 999');
    });

    it('should handle API errors', async () => {
      // Arrange
      const request = {
        params: {
          name: 'cancel_order',
          arguments: {
            orderId: '1'
          }
        }
      };
      
      // Mock order lookup
      auth.tradovateRequest.mockResolvedValueOnce({ id: 1, accountId: 12345, contractId: 1, action: 'Buy', orderQty: 2 });
      
      // Mock API error
      auth.tradovateRequest.mockRejectedValueOnce(new Error('API error'));

      // Act
      const result = await handleCancelOrder(request);

      // Assert
      expect(result.content[0].text).toContain('Order canceled successfully (simulated)');
    });
  });

  describe('handleGetAccountSummary', () => {
    it('should get account summary', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_account_summary',
          arguments: {
            accountId: '12345'
          }
        }
      };
      
      // Mock account lookup
      const mockAccount = { 
        id: 12345, 
        name: 'Demo Account', 
        cashBalance: 10000, 
        marginBalance: 8000,
        initialMargin: 2000,
        maintenanceMargin: 1500
      };
      auth.tradovateRequest.mockResolvedValueOnce(mockAccount);
      
      // Mock cash balance snapshot
      auth.tradovateRequest.mockResolvedValueOnce({
        cashBalance: 10000,
        openOrderMargin: 2000,
        totalMargin: 3500
      });
      
      // Mock positions lookup
      const mockPositions = [
        { id: 1, accountId: 12345, contractId: 1, netPos: 2, netPrice: 5200.25 }
      ];
      auth.tradovateRequest.mockResolvedValueOnce(mockPositions);

      // Act
      const result = await handleGetAccountSummary(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'account/find?id=12345');
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'position/list?accountId=12345');
      expect(result.content[0].text).toContain('Account summary for Demo Account');
    });

    it('should handle account not found', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_account_summary',
          arguments: {
            accountId: '999'
          }
        }
      };
      
      // Mock account lookup failure
      auth.tradovateRequest.mockResolvedValueOnce(null);

      // Act
      const result = await handleGetAccountSummary(request);

      // Assert
      expect(result.content[0].text).toBe('Account not found with ID: 999');
    });
  });

  describe('handleGetMarketData', () => {
    it('should get market data for a symbol', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Quote'
          }
        }
      };
      
      // Mock contract lookup
      auth.tradovateRequest.mockResolvedValueOnce({ id: 1, name: 'ESZ4' });
      
      // Mock market data lookup - note the additional parameters
      auth.tradovateRequest.mockImplementation((method, url, data, isMarketData) => {
        if (url === 'md/getQuote?contractId=1') {
          return Promise.resolve({ 
            contractId: 1,
            last: 5200.25,
            bid: 5200.00,
            ask: 5200.50,
            volume: 1500000
          });
        }
        return Promise.resolve({ id: 1, name: 'ESZ4' });
      });

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'contract/find?name=ESZ4');
      expect(result.content[0].text).toContain('Market data for ESZ4 (Quote)');
    });

    it('should handle contract not found', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'UNKNOWN',
            dataType: 'Quote'
          }
        }
      };
      
      // Mock contract lookup failure
      auth.tradovateRequest.mockResolvedValueOnce(null);

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(result.content[0].text).toBe('Contract not found for symbol: UNKNOWN');
    });

    it('should handle API errors and use mock data', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Quote'
          }
        }
      };
      
      // Mock marketDataSocket to not be available
      global.marketDataSocket = null;
      global.tradovateWs = null;
      
      // Mock contract lookup
      const mockContract = { 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      };
      
      // Mock contract in cache for the fallback mock data
      jest.spyOn(Object, 'values').mockReturnValueOnce([mockContract]);
      
      // First call to find the contract - mock returns successfully
      auth.tradovateRequest.mockImplementation((method, url) => {
        if (url === 'contract/find?name=ESZ4') {
          return Promise.resolve(mockContract);
        }
        return Promise.resolve(null);
      });

      // Act
      const result = await handleGetMarketData(request);

      // Assert - check for the quote data format, not the [MOCK DATA] label
      expect(result.content[0].text).toContain('Market data for ESZ4 (Quote)');
      expect(result.content[0].text).toContain('"bid":');
      expect(result.content[0].text).toContain('"ask":');
      expect(result.content[0].text).toContain('"last":');
    });
  });
}); 