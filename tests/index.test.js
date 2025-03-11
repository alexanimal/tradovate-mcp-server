const { describe, expect, test, beforeEach } = require('@jest/globals');

// Mock the data module with simple mock objects
const mockContractsCache = {
  'ESM3': { id: 'ESM3', name: 'E-mini S&P 500', symbol: 'ESM3', description: 'E-mini S&P 500 Futures', productType: 'Future' }
};

const mockPositionsCache = {
  '123': { id: '123', accountId: 'ABC123', contractId: 'ESM3', netPos: 1, netPrice: 4200.50 }
};

// Mock the auth module
jest.mock('../src/auth.js', () => ({
  authenticate: jest.fn().mockResolvedValue(true),
  isAccessTokenValid: jest.fn().mockReturnValue(true),
  refreshAccessToken: jest.fn().mockResolvedValue(true),
  tradovateRequest: jest.fn()
}));

// Mock the data module
jest.mock('../src/data.js', () => ({
  initializeData: jest.fn().mockResolvedValue(undefined),
  fetchContracts: jest.fn().mockResolvedValue(undefined),
  fetchPositions: jest.fn().mockResolvedValue(undefined),
  fetchOrders: jest.fn().mockResolvedValue(undefined),
  fetchAccounts: jest.fn().mockResolvedValue(undefined),
  contractsCache: mockContractsCache,
  positionsCache: mockPositionsCache,
  ordersCache: {},
  accountsCache: {}
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

// Mock the SDK modules
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: jest.fn().mockImplementation(() => ({
      setRequestHandler: jest.fn(),
      setToolHandler: jest.fn(),
      connect: jest.fn()
    }))
  };
});

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn()
}));

// Mock the SDK types
jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListResourcesRequestSchema: { toString: () => 'ListResourcesRequestSchema' },
  ReadResourceRequestSchema: { toString: () => 'ReadResourceRequestSchema' },
  ListToolsRequestSchema: { toString: () => 'ListToolsRequestSchema' },
  CallToolRequestSchema: { toString: () => 'CallToolRequestSchema' }
}));

// Create a function to extract the handler functions from index.ts
function extractHandlers() {
  // Reset the mocks
  jest.resetModules();
  
  // Create a map to store the handlers
  const handlers = {};
  
  // Mock the setRequestHandler to capture the handlers
  const mockServer = {
    setRequestHandler: jest.fn((schema, handler) => {
      // Store the handler with a key based on the schema
      const schemaName = schema.toString ? schema.toString() : String(schema);
      handlers[schemaName] = handler;
    }),
    setToolHandler: jest.fn(),
    connect: jest.fn()
  };
  
  // Mock the Server constructor to return our mock server
  jest.doMock('@modelcontextprotocol/sdk/server/index.js', () => ({
    Server: jest.fn(() => mockServer)
  }));
  
  // Import the index module to trigger the handler registrations
  jest.isolateModules(() => {
    require('../src/index.js');
  });
  
  return handlers;
}

describe('Resource Handlers', () => {
  let handlers;
  
  beforeEach(() => {
    // Extract the handlers before each test
    handlers = extractHandlers();
  });
  
  describe('ListResourcesRequestSchema', () => {
    test('should return a list of available resources', async () => {
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
    test('should return contract details for a contract URI', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      expect(handler).toBeDefined();
      
      // Call the handler with a contract URI
      const result = await handler({
        params: {
          uri: 'tradovate/contract/ESM3'
        }
      });
      
      // Assert
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'application/json');
      
      // Parse the JSON text to check the content
      const contract = JSON.parse(result.content[0].text);
      expect(contract).toEqual(mockContractsCache['ESM3']);
    });
    
    test('should return position details for a position URI', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with a position URI
      const result = await handler({
        params: {
          uri: 'tradovate/position/123'
        }
      });
      
      // Assert
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'application/json');
      
      // Parse the JSON text to check the content
      const position = JSON.parse(result.content[0].text);
      expect(position).toEqual(mockPositionsCache['123']);
    });
    
    test('should throw an error for an invalid resource URI', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with an invalid URI
      await expect(handler({
        params: {
          uri: 'tradovate'
        }
      })).rejects.toThrow('Invalid resource URI');
    });
    
    test('should throw an error for an unknown resource type', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with an unknown resource type
      await expect(handler({
        params: {
          uri: 'tradovate/unknown/123'
        }
      })).rejects.toThrow('Unknown resource type');
    });
    
    test('should throw an error for a non-existent resource', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with a non-existent resource
      await expect(handler({
        params: {
          uri: 'tradovate/contract/NONEXISTENT'
        }
      })).rejects.toThrow('Resource not found');
    });
    
    test('should return a list of contracts when no resource ID is provided', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with a contract URI without an ID
      const result = await handler({
        params: {
          uri: 'tradovate/contract'
        }
      });
      
      // Assert
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'application/json');
      
      // Parse the JSON text to check the content
      const contracts = JSON.parse(result.content[0].text);
      expect(Array.isArray(contracts)).toBe(true);
      expect(contracts).toContainEqual(mockContractsCache['ESM3']);
    });
    
    test('should return a list of positions when no resource ID is provided', async () => {
      // Get the handler for ReadResourceRequestSchema
      const handler = handlers['ReadResourceRequestSchema'];
      
      // Call the handler with a position URI without an ID
      const result = await handler({
        params: {
          uri: 'tradovate/position'
        }
      });
      
      // Assert
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'application/json');
      
      // Parse the JSON text to check the content
      const positions = JSON.parse(result.content[0].text);
      expect(Array.isArray(positions)).toBe(true);
      expect(positions).toContainEqual(mockPositionsCache['123']);
    });
  });
}); 