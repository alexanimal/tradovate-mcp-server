const { describe, expect, test, beforeEach } = require('@jest/globals');

// Import the modules we need to test
const auth = require('../src/auth.js');
const data = require('../src/data.js');
const { 
  handleModifyOrder,
  handleCancelOrder
} = require('../src/tools.js');

// Mock the modules
jest.mock('../src/auth.js');
jest.mock('../src/data.js');

// Set up mock data
data.contractsCache = {
  '1': { id: 1, name: 'ESZ4', description: 'E-mini S&P 500', productType: 'Future' }
};
data.positionsCache = {
  '1': { id: 1, accountId: 12345, contractId: 1, netPos: 2, netPrice: 5200.25, realizedPnl: 0, openPnl: 100 }
};
data.ordersCache = {
  '1': { id: 1, accountId: 12345, contractId: 1, action: 'Buy', orderQty: 2, orderType: 'Limit', price: 4500.25 }
};
data.accountsCache = {
  '12345': { id: 12345, name: 'Demo Account', cashBalance: 10000, marginBalance: 8000 }
};

describe('Final Tool Handlers for Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up the tradovateRequest mock for each test
    auth.tradovateRequest = jest.fn();
  });

  describe('handleModifyOrder', () => {
    it('should modify an order with price and quantity', async () => {
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
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        accountId: 12345, 
        contractId: 1, 
        action: 'Buy', 
        orderQty: 2, 
        orderType: 'Limit', 
        price: 4500.25 
      });
      
      // Mock order modification
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        accountId: 12345, 
        contractId: 1, 
        action: 'Buy', 
        orderQty: 3, 
        orderType: 'Limit', 
        price: 4600.50 
      });

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

    it('should modify an order with only price', async () => {
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
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        accountId: 12345, 
        contractId: 1, 
        action: 'Buy', 
        orderQty: 2, 
        orderType: 'Limit', 
        price: 4500.25 
      });
      
      // Mock order modification
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        accountId: 12345, 
        contractId: 1, 
        action: 'Buy', 
        orderQty: 2, 
        orderType: 'Limit', 
        price: 4600.50 
      });

      // Act
      const result = await handleModifyOrder(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'order/find?id=1');
      expect(auth.tradovateRequest).toHaveBeenCalledWith('POST', 'order/modifyOrder', expect.objectContaining({
        orderId: 1,
        price: 4600.50
      }));
      expect(result.content[0].text).toContain('Order modified successfully');
    });

    it('should modify an order with only quantity', async () => {
      // Arrange
      const request = {
        params: {
          name: 'modify_order',
          arguments: {
            orderId: '1',
            quantity: 3
          }
        }
      };
      
      // Mock order lookup
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        accountId: 12345, 
        contractId: 1, 
        action: 'Buy', 
        orderQty: 2, 
        orderType: 'Limit', 
        price: 4500.25 
      });
      
      // Mock order modification
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        accountId: 12345, 
        contractId: 1, 
        action: 'Buy', 
        orderQty: 3, 
        orderType: 'Limit', 
        price: 4500.25 
      });

      // Act
      const result = await handleModifyOrder(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'order/find?id=1');
      expect(auth.tradovateRequest).toHaveBeenCalledWith('POST', 'order/modifyOrder', expect.objectContaining({
        orderId: 1,
        orderQty: 3
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

    it('should handle missing orderId', async () => {
      // Arrange
      const request = {
        params: {
          name: 'modify_order',
          arguments: {
            price: 4600.50
          }
        }
      };

      // Act
      const result = await handleModifyOrder(request);

      // Assert
      expect(result.content[0].text).toBe('Order not found with ID: undefined');
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
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        accountId: 12345, 
        contractId: 1, 
        action: 'Buy', 
        orderQty: 2, 
        orderType: 'Limit', 
        price: 4500.25 
      });
      
      // Mock API error
      auth.tradovateRequest.mockRejectedValueOnce(new Error('API error'));

      // Act
      const result = await handleModifyOrder(request);

      // Assert
      expect(result.content[0].text).toContain('Order modified successfully (simulated)');
    });
  });

  describe('handleCancelOrder', () => {
    it('should cancel an order', async () => {
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
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        accountId: 12345, 
        contractId: 1, 
        action: 'Buy', 
        orderQty: 2, 
        orderType: 'Limit', 
        price: 4500.25 
      });
      
      // Mock order cancellation
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        status: 'Cancelled' 
      });

      // Act
      const result = await handleCancelOrder(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'order/find?id=1');
      expect(auth.tradovateRequest).toHaveBeenCalledWith('POST', 'order/cancelorder', expect.objectContaining({
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

    it('should handle missing orderId', async () => {
      // Arrange
      const request = {
        params: {
          name: 'cancel_order',
          arguments: {}
        }
      };

      // Act
      const result = await handleCancelOrder(request);

      // Assert
      expect(result.content[0].text).toBe('Order not found with ID: undefined');
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
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        accountId: 12345, 
        contractId: 1, 
        action: 'Buy', 
        orderQty: 2, 
        orderType: 'Limit', 
        price: 4500.25 
      });
      
      // Mock API error
      auth.tradovateRequest.mockRejectedValueOnce(new Error('API error'));

      // Act
      const result = await handleCancelOrder(request);

      // Assert
      expect(result.content[0].text).toContain('Order canceled successfully (simulated)');
    });
  });
}); 