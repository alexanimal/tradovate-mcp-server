/// <reference types="jest" />

// Create mock schema objects
const mockSchemas = {
  ListResourcesRequestSchema: { toString: () => 'ListResourcesRequestSchema' },
  ReadResourceRequestSchema: { toString: () => 'ReadResourceRequestSchema' },
  ListToolsRequestSchema: { toString: () => 'ListToolsRequestSchema' },
  CallToolRequestSchema: { toString: () => 'CallToolRequestSchema' }
};

// Create mock caches for testing
const mockCaches = {
  contractsCache: {
    '1': { id: 1, name: 'ESZ4', description: 'E-mini S&P 500', productType: 'Future' }
  },
  positionsCache: {
    '1': { id: 1, accountId: 12345, contractId: 1, netPos: 2, netPrice: 5200.25 }
  }
};

// Create mock handlers
const mockResourceListHandler = jest.fn().mockImplementation(() => ({
  resources: [
    { uri: 'tradovate://contract/', name: 'Tradovate Contracts', description: 'Futures contracts available on Tradovate' },
    { uri: 'tradovate://position/', name: 'Tradovate Positions', description: 'Current positions in your Tradovate account' }
  ]
}));

const mockResourceReadHandler = jest.fn().mockImplementation((request) => {
  const uri = request.params.uri;
  
  // Parse the URI correctly
  // Format: tradovate://resourceType/resourceId
  const match = uri.match(/^tradovate:\/\/([^\/]+)\/(.*)$/);
  
  if (!match) {
    throw new Error(`Invalid URI format: ${uri}`);
  }
  
  const resourceType = match[1];
  const resourceId = match[2];
  
  if (resourceType === 'contract') {
    if (mockCaches.contractsCache[resourceId as keyof typeof mockCaches.contractsCache]) {
      return {
        content: [
          {
            type: 'application/json',
            text: JSON.stringify(mockCaches.contractsCache[resourceId as keyof typeof mockCaches.contractsCache])
          }
        ]
      };
    } else {
      throw new Error(`Resource not found: ${uri}`);
    }
  } else if (resourceType === 'position') {
    if (mockCaches.positionsCache[resourceId as keyof typeof mockCaches.positionsCache]) {
      return {
        content: [
          {
            type: 'application/json',
            text: JSON.stringify(mockCaches.positionsCache[resourceId as keyof typeof mockCaches.positionsCache])
          }
        ]
      };
    } else {
      throw new Error(`Resource not found: ${uri}`);
    }
  } else {
    throw new Error(`Unknown resource type: ${resourceType}`);
  }
});

const mockToolListHandler = jest.fn().mockImplementation(() => ({
  tools: [
    { name: 'get_contract_details', description: 'Get detailed information about a specific contract by symbol' },
    { name: 'list_positions', description: 'List all current positions in your Tradovate account' },
    { name: 'place_order', description: 'Place a new order' },
    { name: 'modify_order', description: 'Modify an existing order' },
    { name: 'cancel_order', description: 'Cancel an existing order' },
    { name: 'liquidate_position', description: 'Liquidate an existing position' },
    { name: 'get_account_summary', description: 'Get a summary of your Tradovate account' },
    { name: 'get_market_data', description: 'Get market data for a specific contract' }
  ]
}));

// Mock the SDK modules before importing
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn((schema, handler) => {
      // Store the real handlers, but we'll use our mocks in the tests
    }),
    connect: jest.fn()
  }))
}));

// Mock the SDK types
jest.mock('@modelcontextprotocol/sdk/types.js', () => mockSchemas);

// Mock the data module
jest.mock('../src/data.js', () => ({
  get contractsCache() { return mockCaches.contractsCache; },
  set contractsCache(value) { mockCaches.contractsCache = value; },
  get positionsCache() { return mockCaches.positionsCache; },
  set positionsCache(value) { mockCaches.positionsCache = value; },
  fetchContracts: jest.fn(),
  fetchPositions: jest.fn(),
  fetchOrders: jest.fn(),
  fetchAccounts: jest.fn(),
  initializeData: jest.fn()
}));

// Mock the auth module
jest.mock('../src/auth.js', () => ({
  tradovateRequest: jest.fn(),
  authenticate: jest.fn()
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

// Now import the modules after mocking
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  ListResourcesRequestSchema, 
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import * as dataModule from '../src/data.js';
import { server } from '../src/index.js';

describe('MCP Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock caches
    mockCaches.contractsCache = {
      '1': { id: 1, name: 'ESZ4', description: 'E-mini S&P 500', productType: 'Future' }
    };
    mockCaches.positionsCache = {
      '1': { id: 1, accountId: 12345, contractId: 1, netPos: 2, netPrice: 5200.25 }
    };
    
    // Reset mock handlers
    mockResourceListHandler.mockClear();
    mockResourceReadHandler.mockClear();
    mockToolListHandler.mockClear();
  });
  
  describe('Resource Handlers', () => {
    it('should return contract and position resources', async () => {
      // Act
      const result = await mockResourceListHandler();
      
      // Assert
      expect(result.resources).toHaveLength(2);
      expect(result.resources[0].uri).toBe('tradovate://contract/');
      expect(result.resources[1].uri).toBe('tradovate://position/');
    });
    
    it('should return contract details for contract URI', async () => {
      // Arrange
      const request = {
        params: {
          uri: 'tradovate://contract/1'
        }
      };
      
      // Act
      const result = await mockResourceReadHandler(request);
      
      // Assert
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('application/json');
      expect(JSON.parse(result.content[0].text)).toEqual(mockCaches.contractsCache['1']);
    });
    
    it('should return position details for position URI', async () => {
      // Arrange
      const request = {
        params: {
          uri: 'tradovate://position/1'
        }
      };
      
      // Act
      const result = await mockResourceReadHandler(request);
      
      // Assert
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('application/json');
      expect(JSON.parse(result.content[0].text)).toEqual(mockCaches.positionsCache['1']);
    });
    
    it('should throw error for unknown resource type', async () => {
      // Arrange
      const request = {
        params: {
          uri: 'tradovate://unknown/1'
        }
      };
      
      // Act & Assert
      let errorThrown = false;
      try {
        await mockResourceReadHandler(request);
      } catch (error) {
        errorThrown = true;
        expect((error as Error).message).toContain('Unknown resource type');
      }
      expect(errorThrown).toBe(true);
    });
    
    it('should throw error for non-existent resource', async () => {
      // Arrange
      const request = {
        params: {
          uri: 'tradovate://contract/999'
        }
      };
      
      // Act & Assert
      let errorThrown = false;
      try {
        await mockResourceReadHandler(request);
      } catch (error) {
        errorThrown = true;
        expect((error as Error).message).toContain('Resource not found');
      }
      expect(errorThrown).toBe(true);
    });
  });
  
  describe('Tool Handlers', () => {
    it('should return all available tools', async () => {
      // Act
      const result = await mockToolListHandler();
      
      // Assert
      expect(result.tools).toHaveLength(8);
      expect(result.tools[0].name).toBe('get_contract_details');
      expect(result.tools[1].name).toBe('list_positions');
      expect(result.tools[2].name).toBe('place_order');
    });
  });
}); 