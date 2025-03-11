const { describe, expect, test, beforeEach } = require('@jest/globals');

// Import the modules we need to test
const auth = require('../src/auth.js');
const data = require('../src/data.js');
const { 
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
  '1': { id: 1, accountId: 12345, contractId: 1, netPos: 2, netPrice: 5200.25, realizedPnl: 500, openPnl: 100 },
  '2': { id: 2, accountId: 12345, contractId: 2, netPos: -1, netPrice: 4800.50, realizedPnl: -200, openPnl: -50 }
};
data.ordersCache = {
  '1': { id: 1, accountId: 12345, contractId: 1, action: 'Buy', orderQty: 2, orderType: 'Limit', price: 4500.25 }
};
data.accountsCache = {
  '12345': { id: 12345, name: 'Demo Account', cashBalance: 10000, marginBalance: 8000 }
};

describe('Complete Coverage Tool Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up the tradovateRequest mock for each test
    auth.tradovateRequest = jest.fn();
  });

  describe('handleGetAccountSummary', () => {
    it('should get account summary with multiple positions', async () => {
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
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 12345, 
        name: 'Demo Account', 
        cashBalance: 10000 
      });
      
      // Mock cash balance
      auth.tradovateRequest.mockResolvedValueOnce({ 
        cashBalance: 10000,
        initialMargin: 2000,
        totalMargin: 3500
      });
      
      // Mock positions
      auth.tradovateRequest.mockResolvedValueOnce([
        { 
          id: 1, 
          accountId: 12345, 
          contractId: 1, 
          netPos: 2, 
          netPrice: 5200.25,
          realizedPnl: 500,
          openPnl: 100
        },
        { 
          id: 2, 
          accountId: 12345, 
          contractId: 2, 
          netPos: -1, 
          netPrice: 4800.50,
          realizedPnl: -200,
          openPnl: -50
        }
      ]);

      // Act
      const result = await handleGetAccountSummary(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'account/find?id=12345');
      expect(auth.tradovateRequest).toHaveBeenCalledWith('POST', 'cashBalance/getCashBalanceSnapshot', { accountId: 12345 });
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'position/list?accountId=12345');
      expect(result.content[0].text).toContain('Account summary for Demo Account:');
      expect(result.content[0].text).toContain('"openPnl": 50');
      expect(result.content[0].text).toContain('"positionCount": 2');
    });

    it('should get account summary with no positions', async () => {
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
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 12345, 
        name: 'Demo Account', 
        cashBalance: 10000 
      });
      
      // Mock cash balance
      auth.tradovateRequest.mockResolvedValueOnce({ 
        cashBalance: 10000,
        initialMargin: 0,
        totalMargin: 0
      });
      
      // Mock empty positions
      auth.tradovateRequest.mockResolvedValueOnce([]);

      // Act
      const result = await handleGetAccountSummary(request);

      // Assert
      expect(result.content[0].text).toContain('Account summary for Demo Account:');
      expect(result.content[0].text).toContain('"openPnl": 0');
      expect(result.content[0].text).toContain('"positionCount": 0');
    });

    it('should get account summary without specifying accountId', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_account_summary',
          arguments: {}
        }
      };
      
      // Mock accounts list
      auth.tradovateRequest.mockResolvedValueOnce([
        { 
          id: 12345, 
          name: 'Demo Account', 
          cashBalance: 10000 
        }
      ]);
      
      // Mock cash balance
      auth.tradovateRequest.mockResolvedValueOnce({ 
        cashBalance: 10000,
        initialMargin: 2000,
        totalMargin: 3500
      });
      
      // Mock positions
      auth.tradovateRequest.mockResolvedValueOnce([
        { 
          id: 1, 
          accountId: 12345, 
          contractId: 1, 
          netPos: 2, 
          netPrice: 5200.25,
          realizedPnl: 500,
          openPnl: 100
        }
      ]);

      // Act
      const result = await handleGetAccountSummary(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'account/list');
      expect(result.content[0].text).toContain('Account summary for Demo Account:');
    });

    it('should handle no accounts found', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_account_summary',
          arguments: {}
        }
      };
      
      // Mock empty accounts list
      auth.tradovateRequest.mockResolvedValueOnce([]);

      // Act
      const result = await handleGetAccountSummary(request);

      // Assert
      expect(result.content[0].text).toBe('No accounts found');
    });

    it('should handle API error with cached account', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_account_summary',
          arguments: {
            accountId: '12345'
          }
        }
      };
      
      // Mock API error
      auth.tradovateRequest.mockRejectedValueOnce(new Error('API error'));

      // Act
      const result = await handleGetAccountSummary(request);

      // Assert
      expect(result.content[0].text).toContain('Account summary for Demo Account (simulated):');
      expect(result.content[0].text).toContain('"balance":');
      expect(result.content[0].text).toContain('"openPnl":');
    });

    it('should handle API error with no cached account', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_account_summary',
          arguments: {
            accountId: '999'
          }
        }
      };
      
      // Mock API error
      auth.tradovateRequest.mockRejectedValueOnce(new Error('API error'));
      
      // Empty the cache for this test
      const originalCache = {...data.accountsCache};
      data.accountsCache = {};

      // Act
      const result = await handleGetAccountSummary(request);

      // Assert
      expect(result.content[0].text).toBe('Account not found with ID: 999');
      
      // Restore the cache
      data.accountsCache = originalCache;
    });

    it('should handle API error with no cached accounts', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_account_summary',
          arguments: {}
        }
      };
      
      // Mock API error
      auth.tradovateRequest.mockRejectedValueOnce(new Error('API error'));
      
      // Empty the cache for this test
      const originalCache = {...data.accountsCache};
      data.accountsCache = {};

      // Act
      const result = await handleGetAccountSummary(request);

      // Assert
      expect(result.content[0].text).toBe('No accounts found in cache');
      
      // Restore the cache
      data.accountsCache = originalCache;
    });
  });

  describe('handleGetMarketData', () => {
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
      
      // Mock contract lookup
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      });
      
      // Mock DOM data
      const mockDOM = { 
        bids: [
          { price: 5275.25, size: 250 },
          { price: 5275.00, size: 175 }
        ],
        asks: [
          { price: 5275.50, size: 180 },
          { price: 5275.75, size: 220 }
        ]
      };
      auth.tradovateRequest.mockResolvedValueOnce(mockDOM);

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'contract/find?name=ESZ4');
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'md/getDOM?contractId=1', undefined, true);
      expect(result.content[0].text).toContain('Market data for ESZ4 (DOM)');
      expect(result.content[0].text).toContain('"bids":');
      expect(result.content[0].text).toContain('"asks":');
    });

    it('should get chart data with 5min timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart',
            chartTimeframe: '5min'
          }
        }
      };
      
      // Mock contract lookup
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      });
      
      // Mock chart data
      const mockChart = { 
        bars: [
          { timestamp: '2023-01-01T12:00:00Z', open: 5250, high: 5255, low: 5245, close: 5252 }
        ]
      };
      auth.tradovateRequest.mockResolvedValueOnce(mockChart);

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'contract/find?name=ESZ4');
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'md/getChart?contractId=1&chartDescription=5m&timeRange=3600', undefined, true);
      expect(result.content[0].text).toContain('Market data for ESZ4 (Chart)');
    });

    it('should get chart data with 15min timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart',
            chartTimeframe: '15min'
          }
        }
      };
      
      // Mock contract lookup
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      });
      
      // Mock chart data
      const mockChart = { 
        bars: [
          { timestamp: '2023-01-01T12:00:00Z', open: 5250, high: 5255, low: 5245, close: 5252 }
        ]
      };
      auth.tradovateRequest.mockResolvedValueOnce(mockChart);

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'md/getChart?contractId=1&chartDescription=15m&timeRange=3600', undefined, true);
    });

    it('should get chart data with 30min timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart',
            chartTimeframe: '30min'
          }
        }
      };
      
      // Mock contract lookup
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      });
      
      // Mock chart data
      const mockChart = { 
        bars: [
          { timestamp: '2023-01-01T12:00:00Z', open: 5250, high: 5255, low: 5245, close: 5252 }
        ]
      };
      auth.tradovateRequest.mockResolvedValueOnce(mockChart);

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'md/getChart?contractId=1&chartDescription=30m&timeRange=3600', undefined, true);
    });

    it('should get chart data with 4hour timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart',
            chartTimeframe: '4hour'
          }
        }
      };
      
      // Mock contract lookup
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      });
      
      // Mock chart data
      const mockChart = { 
        bars: [
          { timestamp: '2023-01-01T12:00:00Z', open: 5250, high: 5255, low: 5245, close: 5252 }
        ]
      };
      auth.tradovateRequest.mockResolvedValueOnce(mockChart);

      // Act
      const result = await handleGetMarketData(request);

      // Assert
      expect(auth.tradovateRequest).toHaveBeenCalledWith('GET', 'md/getChart?contractId=1&chartDescription=4h&timeRange=3600', undefined, true);
    });

    it('should handle API error and generate mock DOM data', async () => {
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
      expect(result.content[0].text).toContain('Market data for ESZ4 (DOM) [MOCK DATA]:');
      expect(result.content[0].text).toContain('"bids":');
      expect(result.content[0].text).toContain('"asks":');
    });

    it('should handle API error and generate mock chart data with 1min timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart',
            chartTimeframe: '1min'
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
      expect(result.content[0].text).toContain('Market data for ESZ4 (Chart) [MOCK DATA]:');
      expect(result.content[0].text).toContain('"timeframe": "1min"');
      expect(result.content[0].text).toContain('"bars":');
    });

    it('should handle API error and generate mock chart data with 5min timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart',
            chartTimeframe: '5min'
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
      expect(result.content[0].text).toContain('Market data for ESZ4 (Chart) [MOCK DATA]:');
      expect(result.content[0].text).toContain('"timeframe": "5min"');
    });

    it('should handle API error and generate mock chart data with 15min timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart',
            chartTimeframe: '15min'
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
      expect(result.content[0].text).toContain('Market data for ESZ4 (Chart) [MOCK DATA]:');
      expect(result.content[0].text).toContain('"timeframe": "15min"');
    });

    it('should handle API error and generate mock chart data with 30min timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart',
            chartTimeframe: '30min'
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
      expect(result.content[0].text).toContain('Market data for ESZ4 (Chart) [MOCK DATA]:');
      expect(result.content[0].text).toContain('"timeframe": "30min"');
    });

    it('should handle API error and generate mock chart data with 1hour timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart',
            chartTimeframe: '1hour'
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
      expect(result.content[0].text).toContain('Market data for ESZ4 (Chart) [MOCK DATA]:');
      expect(result.content[0].text).toContain('"timeframe": "1hour"');
    });

    it('should handle API error and generate mock chart data with 4hour timeframe', async () => {
      // Arrange
      const request = {
        params: {
          name: 'get_market_data',
          arguments: {
            symbol: 'ESZ4',
            dataType: 'Chart',
            chartTimeframe: '4hour'
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
      expect(result.content[0].text).toContain('Market data for ESZ4 (Chart) [MOCK DATA]:');
      expect(result.content[0].text).toContain('"timeframe": "4hour"');
    });

    it('should handle API error and generate mock chart data with 1day timeframe', async () => {
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
      expect(result.content[0].text).toContain('Market data for ESZ4 (Chart) [MOCK DATA]:');
      expect(result.content[0].text).toContain('"timeframe": "1day"');
    });

    it('should handle API error with unsupported data type', async () => {
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
      
      // Mock contract lookup
      auth.tradovateRequest.mockResolvedValueOnce({ 
        id: 1, 
        name: 'ESZ4', 
        description: 'E-mini S&P 500' 
      });

      // Act & Assert
      await expect(handleGetMarketData(request)).rejects.toThrow('Unsupported data type: UnsupportedType');
    });
  });
}); 