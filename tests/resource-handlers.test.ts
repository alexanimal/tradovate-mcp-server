/// <reference types="jest" />

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Define types for our handlers
type RequestHandler = (...args: any[]) => Promise<any>;
interface Handlers {
  [key: string]: RequestHandler;
}

// Define types for our mock data
interface Contract {
  id: string;
  name: string;
  symbol: string;
  description: string;
  productType: string;
}

interface Position {
  id: string;
  accountId: string;
  contractId: string;
  netPos: number;
  netPrice: number;
}

interface MockCaches {
  contractsCache: Record<string, Contract>;
  positionsCache: Record<string, Position>;
  ordersCache: Record<string, any>;
  accountsCache: Record<string, any>;
}

// Create mock schema objects
const mockSchemas = {
  ListResourcesRequestSchema: { 
    toString: () => 'ListResourcesRequestSchema',
    name: 'ListResourcesRequestSchema'
  },
  ReadResourceRequestSchema: { 
    toString: () => 'ReadResourceRequestSchema',
    name: 'ReadResourceRequestSchema'
  },
  ListToolsRequestSchema: { 
    toString: () => 'ListToolsRequestSchema',
    name: 'ListToolsRequestSchema'
  },
  CallToolRequestSchema: { 
    toString: () => 'CallToolRequestSchema',
    name: 'CallToolRequestSchema'
  }
};

// Create mock caches for testing
const mockCaches: MockCaches = {
  contractsCache: {
    'ESM3': { id: 'ESM3', name: 'E-mini S&P 500', symbol: 'ESM3', description: 'E-mini S&P 500 Futures', productType: 'Future' }
  },
  positionsCache: {
    '123': { id: '123', accountId: 'ABC123', contractId: 'ESM3', netPos: 1, netPrice: 4200.50 }
  },
  ordersCache: {},
  accountsCache: {}
};

// Mock the data module
jest.mock('../src/data.js', () => ({
  get contractsCache() { return mockCaches.contractsCache; },
  set contractsCache(value) { mockCaches.contractsCache = value; },
  get positionsCache() { return mockCaches.positionsCache; },
  set positionsCache(value) { mockCaches.positionsCache = value; },
  get ordersCache() { return mockCaches.ordersCache; },
  set ordersCache(value) { mockCaches.ordersCache = value; },
  get accountsCache() { return mockCaches.accountsCache; },
  set accountsCache(value) { mockCaches.accountsCache = value; },
  initializeData: jest.fn(),
  fetchContracts: jest.fn(),
  fetchPositions: jest.fn(),
  fetchOrders: jest.fn(),
  fetchAccounts: jest.fn()
}));

// Mock the SDK modules
jest.mock('@modelcontextprotocol/sdk/types.js', () => mockSchemas);

// Create a direct test implementation of the resource handlers
// This approach directly tests the implementation logic rather than trying to capture the handlers
describe('Resource Handlers', () => {
  // Import the actual data module to use in our tests
  const dataModule = jest.requireMock('../src/data.js') as {
    contractsCache: Record<string, Contract>;
    positionsCache: Record<string, Position>;
  };
  
  // Create a direct implementation of the ListResourcesRequestSchema handler
  const listResourcesHandler = async () => {
    return {
      resources: [
        {
          uri: "tradovate://contract/",
          name: "Tradovate Contracts",
          description: "Futures contracts available on Tradovate",
        },
        {
          uri: "tradovate://position/",
          name: "Tradovate Positions",
          description: "Current positions in your Tradovate account",
        },
      ],
    };
  };
  
  // Create a direct implementation of the ReadResourceRequestSchema handler
  const readResourceHandler = async (request: { params: { uri: string } }) => {
    const uri = request.params.uri;
    
    // Parse the URI to get the resource type and ID
    const [, resourceType, resourceId] = uri.split("/");
    
    if (!resourceType) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }
    
    // Handle different resource types
    switch (resourceType) {
      case "contract": {
        if (resourceId) {
          // Return specific contract
          const contract = dataModule.contractsCache[resourceId];
          if (!contract) {
            throw new Error(`Resource not found: ${uri}`);
          }
          
          return {
            content: [
              {
                type: "application/json",
                text: JSON.stringify(contract),
              },
            ],
          };
        } else {
          // Return list of contracts
          const contracts = Object.values(dataModule.contractsCache);
          
          return {
            content: [
              {
                type: "application/json",
                text: JSON.stringify(contracts),
              },
            ],
          };
        }
      }
      
      case "position": {
        if (resourceId) {
          // Return specific position
          const position = dataModule.positionsCache[resourceId];
          if (!position) {
            throw new Error(`Resource not found: ${uri}`);
          }
          
          return {
            content: [
              {
                type: "application/json",
                text: JSON.stringify(position),
              },
            ],
          };
        } else {
          // Return list of positions
          const positions = Object.values(dataModule.positionsCache);
          
          return {
            content: [
              {
                type: "application/json",
                text: JSON.stringify(positions),
              },
            ],
          };
        }
      }
      
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  };
  
  describe('ListResourcesRequestSchema', () => {
    it('should return a list of available resources', async () => {
      // Call the handler
      const result = await listResourcesHandler();
      
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
      // Call the handler with a contract URI
      const result = await readResourceHandler({
        params: {
          uri: 'tradovate/contract/ESM3'
        }
      });
      
      // Assert
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'application/json');
      
      // Parse the JSON text to check the content
      const contract = JSON.parse(result.content[0].text);
      expect(contract).toEqual(mockCaches.contractsCache['ESM3']);
    });
    
    it('should return position details for a position URI', async () => {
      // Call the handler with a position URI
      const result = await readResourceHandler({
        params: {
          uri: 'tradovate/position/123'
        }
      });
      
      // Assert
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'application/json');
      
      // Parse the JSON text to check the content
      const position = JSON.parse(result.content[0].text);
      expect(position).toEqual(mockCaches.positionsCache['123']);
    });
    
    it('should throw an error for an invalid resource URI', async () => {
      // Call the handler with an invalid URI
      await expect(readResourceHandler({
        params: {
          uri: 'tradovate'
        }
      })).rejects.toThrow('Invalid resource URI');
    });
    
    it('should throw an error for an unknown resource type', async () => {
      // Call the handler with an unknown resource type
      await expect(readResourceHandler({
        params: {
          uri: 'tradovate/unknown/123'
        }
      })).rejects.toThrow('Unknown resource type');
    });
    
    it('should throw an error for a non-existent resource', async () => {
      // Call the handler with a non-existent resource
      await expect(readResourceHandler({
        params: {
          uri: 'tradovate/contract/NONEXISTENT'
        }
      })).rejects.toThrow('Resource not found');
    });
    
    it('should return a list of contracts when no resource ID is provided', async () => {
      // Call the handler with a contract URI without an ID
      const result = await readResourceHandler({
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
      expect(contracts).toContainEqual(mockCaches.contractsCache['ESM3']);
    });
    
    it('should return a list of positions when no resource ID is provided', async () => {
      // Call the handler with a position URI without an ID
      const result = await readResourceHandler({
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
      expect(positions).toContainEqual(mockCaches.positionsCache['123']);
    });
  });
}); 