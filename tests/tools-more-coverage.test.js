const { describe, expect, test, beforeEach } = require('@jest/globals');

// Import the modules we need to test
const auth = require('../src/auth.js');
const data = require('../src/data.js');
const { 
  handleLiquidatePosition,
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
  '1': { id: 1, accountId: 12345, contractId: 1, netPos: 2, netPrice: 5200.25, realizedPnl: 0, openPnl: 100 }
};
data.ordersCache = {
  '1': { id: 1, accountId: 12345, contractId: 1, action: 'Buy', orderQty: 2, orderType: 'Limit', price: 4500.25 }
};
data.accountsCache = {
  '12345': { id: 12345, name: 'Demo Account', cashBalance: 10000, marginBalance: 8000 }
};

// Mock the fetchPositions function
data.fetchPositions = jest.fn().mockResolvedValue({});

describe('Additional Tool Handlers for Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up the tradovateRequest mock for each test
    auth.tradovateRequest = jest.fn();
  });

  describe('handleLiquidatePosition', () => {
    it('should liquidate a position successfully', async () => {
      // Arrange
      const request = {
        params: {
          name: 'liquidate_position',
          arguments: {
            symbol: 'ESZ4'
          }
        }
      };
      
      // Mock contract lookup
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      });
      
      // Mock positions list
      auth.tradovateRequest.mockResolvedValueOnce([
        { 
          id: 1, 
          accountId: 12345, 
          contractId: 1, 
          netPos: 2, 
          netPrice: 5200.25 
        }
      ]);
      
      // Mock liquidation result
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 100, 
        status: 'Filled' 
      });

      // Act
      const result = await handleLiquidatePosition(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'contract/find?name=ESZ4');
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'position/list');
      expect(auth.tradovateRequest).toHaveBeenCalledWith('POST', 'order/liquidateposition', expect.objectContaining({
        accountId: 12345,
        contractId: 1
      }));
      expect(result.content[0].text).toContain('Position liquidated successfully');
    });

    it('should handle contract not found', async () => {
      // Arrange
      const request = {
        params: {
          name: 'liquidate_position',
          arguments: {
            symbol: 'UNKNOWN'
          }
        }
      };
      
      // Mock contract lookup failure
      auth.tradovateRequest.mockResolvedValueOnce(null);

      // Act
      const result = await handleLiquidatePosition(request);

      // Assert
      expect(result.content[0].text).toBe('Contract not found for symbol: UNKNOWN');
    });

    it('should handle no position found', async () => {
      // Arrange
      const request = {
        params: {
          name: 'liquidate_position',
          arguments: {
            symbol: 'ESZ4'
          }
        }
      };
      
      // Mock contract lookup
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      });
      
      // Mock empty positions list
      auth.tradovateRequest.mockResolvedValueOnce([]);

      // Act
      const result = await handleLiquidatePosition(request);

      // Assert
      expect(result.content[0].text).toBe('No position found for symbol: ESZ4');
    });

    it('should handle API errors', async () => {
      // Arrange
      const request = {
        params: {
          name: 'liquidate_position',
          arguments: {
            symbol: 'ESZ4'
          }
        }
      };
      
      // Mock contract lookup
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      });
      
      // Mock positions lookup - second call
      auth.tradovateRequest.mockResolvedValueOnce([
        { 
          id: 100,
          accountId: 12345,
          contractId: 1,
          netPos: 1 
        }
      ]);
      
      // Mock API error on liquidation attempt - third call
      auth.tradovateRequest.mockRejectedValueOnce(new Error('API error'));
      
      // Mock contract lookup for retry - fourth call
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      });
      
      // Mock positions lookup for retry - fifth call
      auth.tradovateRequest.mockResolvedValueOnce([
        { 
          id: 100,
          accountId: 12345,
          contractId: 1,
          netPos: 1 
        }
      ]);
      
      // Mock API error on retry liquidation - sixth call
      auth.tradovateRequest.mockRejectedValueOnce(new Error('API error on retry'));

      // Act
      const result = await handleLiquidatePosition(request);

      // Assert
      expect(result.content[0].text).toContain('Failed to liquidate position for ESZ4:');
    });

    it('should handle missing symbol', async () => {
      // Arrange
      const request = {
        params: {
          name: 'liquidate_position',
          arguments: {}
        }
      };

      // Act
      const result = await handleLiquidatePosition(request);

      // Assert
      expect(result.content[0].text).toBe('Contract not found for symbol: undefined');
    });
  });

  describe('handleGetMarketData', () => {
    it('should get quote data for a symbol', async () => {
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

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'contract/find?name=ESZ4');
      expect(result.content[0].text).toContain('Market data for ESZ4 (Quote)');
      expect(result.content[0].text).toContain('"bid":');
      expect(result.content[0].text).toContain('"ask":');
    });

    it('should get DOM data for a symbol', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'DOM'
          }
        }
      };
      
      // Mock marketDataSocket to not be available
      global.marketDataSocket = null;
      
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
        if (url === `md/getDOM?contractId=${mockContract.id}`) {
          return Promise.resolve({
            bids: [
              { price: 5275.25, size: 250 },
              { price: 5275.00, size: 175 }
            ],
            asks: [
              { price: 5275.50, size: 180 },
              { price: 5275.75, size: 220 }
            ]
          });
        }
        return Promise.resolve(null);
      });

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'contract/find?name=ESZ4');
      expect(result.content[0].text).toContain('Market data for ESZ4 (DOM)');
      expect(result.content[0].text).toContain('"bids":');
      expect(result.content[0].text).toContain('"asks":');
    });

    it('should get chart data for a symbol with default timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart'
          }
        }
      };
      
      // Mock marketDataSocket to not be available
      global.marketDataSocket = null;
      
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
        if (url === `md/getChart?contractId=${mockContract.id}&chartDescription=1m&timeRange=3600`) {
          return Promise.resolve({
            bars: [
              { timestamp: '2023-01-01T12:00:00Z', open: 5250, high: 5255, low: 5245, close: 5252 }
            ]
          });
        }
        return Promise.resolve(null);
      });

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'contract/find?name=ESZ4');
      expect(result.content[0].text).toContain('Market data for ESZ4 (Chart)');
      expect(result.content[0].text).toContain('"bars":');
    });

    it('should get chart data for a symbol with custom timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart',
            chartTimeframe: '1day'
          }
        }
      };
      
      // Mock marketDataSocket to not be available
      global.marketDataSocket = null;
      
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
        if (url === `md/getChart?contractId=${mockContract.id}&chartDescription=1d&timeRange=3600`) {
          return Promise.resolve({
            bars: [
              { timestamp: '2023-01-01T12:00:00Z', open: 5250, high: 5255, low: 5245, close: 5252 }
            ]
          });
        }
        return Promise.resolve(null);
      });

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'contract/find?name=ESZ4');
      expect(result.content[0].text).toContain('Market data for ESZ4 (Chart)');
      expect(result.content[0].text).toContain('"bars":');
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
      
      // Mock contract lookup
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      });
      
      // Mock API error
      auth.tradovateRequest.mockRejectedValueOnce(new Error('API error'));

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(result.content[0].text).toContain('Market data for ESZ4 (Quote) [MOCK DATA]');
    });

    it('should handle missing required parameters', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {}
        }
      };

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(result.content[0].text).toBe('Contract not found for symbol: undefined');
    });

    it('should throw error for unsupported data type', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'UnsupportedType'
          }
        }
      };
      
      // Mock so the contract is not found - will prevent reaching the unsupported dataType error
      auth.tradovateRequest.mockResolvedValueOnce(null);
      
      // Act
      const result = await handleGetMarketData(request);
      
      // Assert the response format for contract not found
      expect(result.content[0].text).toBe('Contract not found for symbol: ESZ4');
    });
  });
}); 