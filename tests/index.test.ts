// Mock all the SDK imports before importing the actual module
jest.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: jest.fn().mockImplementation(() => ({
    resourceHandlers: {
      health: jest.fn(),
      schema: jest.fn(),
      execute: jest.fn()
    },
    connect: jest.fn(),
    setRequestHandler: jest.fn(),
    setToolHandler: jest.fn()
  }))
}));

jest.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({}))
}));

jest.mock("@modelcontextprotocol/sdk/types.js", () => ({
  CallToolRequestSchema: { parse: jest.fn() },
  ListResourcesRequestSchema: { parse: jest.fn() },
  ListToolsRequestSchema: { parse: jest.fn() },
  ReadResourceRequestSchema: { parse: jest.fn() },
  ListPromptsRequestSchema: { parse: jest.fn() },
  GetPromptRequestSchema: { parse: jest.fn() },
  ToolSchema: { parse: jest.fn() },
  ResourceSchema: { parse: jest.fn() },
  PromptSchema: { parse: jest.fn() }
}));

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
  contractsCache: {},
  positionsCache: {},
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

// Import dependencies after mocking
import { authenticate } from '../src/auth.js';
import { initializeData } from '../src/data.js';

// Import the module under test
// Use a dynamic import to avoid ESM issues
let initialize: () => Promise<void>;
let main: () => Promise<void>;
let server: any;

describe('MCP Server', () => {
  beforeAll(async () => {
    // Dynamically import the module under test
    const indexModule = await import('../src/index.js');
    initialize = indexModule.initialize;
    main = indexModule.main;
    server = indexModule.server;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Server Initialization', () => {
    it('should authenticate and initialize data on startup', async () => {
      // Act
      await initialize();
      
      // Assert
      expect(authenticate).toHaveBeenCalled();
      expect(initializeData).toHaveBeenCalled();
    });
    
    it('should start the server with proper configuration', async () => {
      // Act
      await main();
      
      // Assert
      expect(authenticate).toHaveBeenCalled();
      expect(initializeData).toHaveBeenCalled();
      // We can't directly check Server because it's mocked
      // but we can check that the server variable is defined
      expect(server).toBeDefined();
    });
  });
}); 