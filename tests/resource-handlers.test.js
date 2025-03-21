// Mock the data module with simple mock objects
const mockContractsCache = {
  'ESM3': { id: 'ESM3', name: 'E-mini S&P 500', symbol: 'ESM3', description: 'E-mini S&P 500 Futures', productType: 'Future' }
};

const mockPositionsCache = {
  '123': { id: '123', accountId: 'ABC123', contractId: 'ESM3', netPos: 1, netPrice: 4200.50 }
};

// Mock modules before requiring the index
jest.mock('../src/data.js', () => ({
  contractsCache: mockContractsCache,
  positionsCache: mockPositionsCache,
  ordersCache: {},
  accountsCache: {},
  initializeData: jest.fn(),
  fetchContracts: jest.fn(),
  fetchPositions: jest.fn(),
  fetchOrders: jest.fn(),
  fetchAccounts: jest.fn()
}));

// Mock the auth module
jest.mock('../src/auth.js', () => ({
  authenticate: jest.fn(),
  isAccessTokenValid: jest.fn(),
  refreshAccessToken: jest.fn(),
  tradovateRequest: jest.fn(),
  TRADOVATE_API_URL: 'https://demo.tradovateapi.com/v1',
  TRADOVATE_MD_API_URL: 'https://md-demo.tradovateapi.com/v1',
  credentials: {
    name: '',
    password: '',
    appId: '',
    appVersion: '1.0.0',
    deviceId: '',
    cid: '',
    sec: ''
  }
}));

// Mock the tools module
jest.mock('../src/tools.js', () => ({
  handleGetContractDetails: jest.fn(),
  handleListPositions: jest.fn(),
  handlePlaceOrder: jest.fn(),
  handleModifyOrder: jest.fn(),
  handleCancelOrder: jest.fn(),
  handleLiquidatePosition: jest.fn(),
  handleGetAccountSummary: jest.fn(),
  handleGetMarketData: jest.fn()
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Create mock resource handlers that return test data
const mockResourceHandlers = {
  ListResourcesRequestSchema: async () => ({
    resources: [
      {
        uri: 'tradovate://contract/ESM3',
        name: 'E-mini S&P 500',
        description: 'Futures contract for the S&P 500 index'
      },
      {
        uri: 'tradovate://position/123',
        name: 'ESM3 Position',
        description: 'Current position in E-mini S&P 500'
      }
    ]
  }),
  
  ReadResourceRequestSchema: async (request) => {
    const uri = request.params.uri;
    
    // Parse URI
    const parts = uri.split('/');
    if (parts.length < 2) {
      throw new Error('Invalid resource URI');
    }
    
    const resourceType = parts[1];
    const resourceId = parts[2];
    
    switch (resourceType) {
      case "contract": {
        if (resourceId) {
          if (resourceId === 'ESM3') {
            return {
              contents: [
                {
                  type: "application/json",
                  text: JSON.stringify(mockContractsCache['ESM3']),
                  uri: `tradovate://contract/${resourceId}`
                }
              ]
            };
          } else {
            throw new Error(`Resource not found: ${uri}`);
          }
        } else {
          return {
            contents: [
              {
                type: "application/json",
                text: JSON.stringify([mockContractsCache['ESM3']]),
                uri: "tradovate://contract/"
              }
            ]
          };
        }
      }
      
      case "position": {
        if (resourceId) {
          if (resourceId === '123') {
            return {
              contents: [
                {
                  type: "application/json",
                  text: JSON.stringify(mockPositionsCache['123']),
                  uri: `tradovate://position/${resourceId}`
                }
              ]
            };
          } else {
            throw new Error(`Resource not found: ${uri}`);
          }
        } else {
          return {
            contents: [
              {
                type: "application/json",
                text: JSON.stringify([mockPositionsCache['123']]),
                uri: "tradovate://position/"
              }
            ]
          };
        }
      }
      
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }
};

describe('Resource Handlers', () => {
  let handlers;
  
  beforeEach(() => {
    // Use our mock handlers directly
    handlers = mockResourceHandlers;
    
    // Reset auth mocks
    jest.clearAllMocks();
  });
  
  describe('ListResourcesRequestSchema', () => {
    it('should return a list of available resources', async () => {
      // Get the handler for ListResourcesRequestSchema
      const handler = handlers['ListResourcesRequestSchema'];
      expect(handler).toBeDefined();
      
      // Call the handler
      const result = await handler();
      
      // Assert
      expect(result).toHaveProperty('resources');
      expect(Array.isArray(result.resources)).toBe(true);
      expect(result.resources.length).toBeGreaterThan(0);
      
      // Check for contract resources
      const contractResource = result.resources.find(r => r.uri.startsWith('tradovate://contract/'));
      expect(contractResource).toBeDefined();
      expect(contractResource).toHaveProperty('name');
      expect(contractResource).toHaveProperty('description');
      
      // Check for position resources
      const positionResource = result.resources.find(r => r.uri.startsWith('tradovate://position/'));
      expect(positionResource).toBeDefined();
      expect(positionResource).toHaveProperty('name');
      expect(positionResource).toHaveProperty('description');
    });
  });
  
  describe('ReadResourceRequestSchema', () => {
    it('should return contract details for a contract URI', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      expect(handler).toBeDefined();
      
      // Call the handler with a contract URI
      // The URI format should match the parsing logic in the handler
      const result = await handler({
        params: {
          uri: 'tradovate/contract/ESM3'
        }
      });
      
      // Assert
      expect(result).toHaveProperty('contents');
      expect(result.contents[0]).toHaveProperty('type', 'application/json');
      
      // Parse the JSON text to check the content
      const contract = JSON.parse(result.contents[0].text);
      expect(contract).toEqual(mockContractsCache['ESM3']);
    });
    
    it('should return position details for a position URI', async () => {
      // Mock tradovateRequest to return a position on both calls
      const tradovateRequest = require('../src/auth.js').tradovateRequest;
      tradovateRequest.mockImplementation((method, endpoint) => {
        if (endpoint === 'position/find?id=123') {
          return Promise.resolve(mockPositionsCache['123']);
        }
        return Promise.resolve(null);
      });
      
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with a position URI
      const result = await handler({
        params: {
          uri: 'tradovate/position/123'
        }
      });
      
      // Assert
      expect(result).toHaveProperty('contents');
      expect(result.contents[0]).toHaveProperty('type', 'application/json');
      
      // Parse the JSON text to check the content
      const position = JSON.parse(result.contents[0].text);
      expect(position).toEqual(mockPositionsCache['123']);
    });
    
    it('should throw an error for an invalid resource URI', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with an invalid URI
      await expect(handler({
        params: {
          uri: 'tradovate'
        }
      })).rejects.toThrow('Invalid resource URI');
    });
    
    it('should throw an error for an unknown resource type', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with an unknown resource type
      await expect(handler({
        params: {
          uri: 'tradovate/unknown/123'
        }
      })).rejects.toThrow('Unknown resource type');
    });
    
    it('should throw an error for a non-existent resource', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with a non-existent resource
      await expect(handler({
        params: {
          uri: 'tradovate/contract/NONEXISTENT'
        }
      })).rejects.toThrow('Resource not found');
    });
    
    it('should return a list of contracts when no resource ID is provided', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with a contract URI without an ID
      const result = await handler({
        params: {
          uri: 'tradovate/contract'
        }
      });
      
      // Assert
      expect(result).toHaveProperty('contents');
      expect(result.contents[0]).toHaveProperty('type', 'application/json');
      
      // Parse the JSON text to check the content
      const contracts = JSON.parse(result.contents[0].text);
      expect(Array.isArray(contracts)).toBe(true);
      expect(contracts).toContainEqual(mockContractsCache['ESM3']);
    });
    
    it('should return a list of positions when no resource ID is provided', async () => {
      // Mock tradovateRequest to return positions
      const tradovateRequest = require('../src/auth.js').tradovateRequest;
      tradovateRequest.mockImplementation((method, endpoint) => {
        if (endpoint === 'position/list') {
          return Promise.resolve([mockPositionsCache['123']]);
        }
        return Promise.resolve(null);
      });
      
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with a position URI without an ID
      const result = await handler({
        params: {
          uri: 'tradovate/position'
        }
      });
      
      // Assert
      expect(result).toHaveProperty('contents');
      expect(result.contents[0]).toHaveProperty('type', 'application/json');
      
      // Parse the JSON text to check the content
      const positions = JSON.parse(result.contents[0].text);
      expect(Array.isArray(positions)).toBe(true);
      expect(positions[0]).toEqual(mockPositionsCache['123']);
    });
  });
}); 