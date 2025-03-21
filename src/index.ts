#!/usr/bin/env node

/**
 * This is a Tradovate MCP server that implements tools for managing Contract and Order Positions.
 * It demonstrates core MCP concepts like resources and tools by allowing:
 * - Listing contracts and positions as resources
 * - Reading individual contract and position details
 * - Managing positions via tools (create, modify, close)
 * - Getting account information and market data
 */

// First, load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

import * as logger from "./logger.js";

// Then import other dependencies
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { fileURLToPath } from "url";

// Import from abstracted modules
import { authenticate, tradovateRequest } from "./auth.js";
import { 
  contractsCache, 
  positionsCache, 
  ordersCache, 
  accountsCache, 
  initializeData 
} from "./data.js";
import {
  handleGetContractDetails,
  handleListPositions,
  handlePlaceOrder,
  handleModifyOrder,
  handleCancelOrder,
  handleLiquidatePosition,
  handleGetAccountSummary,
  handleGetMarketData
} from "./tools.js";

/**
 * Create the MCP server
 */
export const server = new Server(
  { name: "tradovate-mcp-server", version: "0.1.0" },
  {
    capabilities: {
      resources: {
        "tradovate://contract/": {
          name: "Tradovate Contracts",
          description: "Futures contracts available on Tradovate",
        },
        "tradovate://position/": {
          name: "Tradovate Positions",
          description: "Current positions in your Tradovate account",
        },
      },
      prompts: {},
      tools: {
        get_contract_details: {
          description: "Get detailed information about a specific contract by symbol",
          parameters: {
            type: "object",
            properties: {
              symbol: {
                type: "string",
                description: "The contract symbol (e.g., ESZ4, NQZ4)",
              },
            },
            required: ["symbol"],
          },
        },
        list_positions: {
          description: "List all positions for an account",
          parameters: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "The account ID (optional, will use default if not provided)",
              },
            },
          },
        },
        place_order: {
          description: "Place a new order",
          parameters: {
            type: "object",
            properties: {
              symbol: {
                type: "string",
                description: "The contract symbol (e.g., ESZ4, NQZ4)",
              },
              action: {
                type: "string",
                description: "Buy or Sell",
                enum: ["Buy", "Sell"],
              },
              orderType: {
                type: "string",
                description: "Type of order",
                enum: ["Market", "Limit", "Stop", "StopLimit"],
              },
              quantity: {
                type: "number",
                description: "Number of contracts",
              },
              price: {
                type: "number",
                description: "Price for Limit and StopLimit orders",
              },
              stopPrice: {
                type: "number",
                description: "Stop price for Stop and StopLimit orders",
              },
            },
            required: ["symbol", "action", "orderType", "quantity"],
          },
        },
        modify_order: {
          description: "Modify an existing order",
          parameters: {
            type: "object",
            properties: {
              orderId: {
                type: "string",
                description: "The order ID to modify",
              },
              price: {
                type: "number",
                description: "New price for Limit and StopLimit orders",
              },
              stopPrice: {
                type: "number",
                description: "New stop price for Stop and StopLimit orders",
              },
              quantity: {
                type: "number",
                description: "New quantity",
              },
            },
            required: ["orderId"],
          },
        },
        cancel_order: {
          description: "Cancel an existing order",
          parameters: {
            type: "object",
            properties: {
              orderId: {
                type: "string",
                description: "The order ID to cancel",
              },
            },
            required: ["orderId"],
          },
        },
        liquidate_position: {
          description: "Close an existing position",
          parameters: {
            type: "object",
            properties: {
              symbol: {
                type: "string",
                description: "The contract symbol (e.g., ESZ4, NQZ4)",
              },
            },
            required: ["symbol"],
          },
        },
        get_account_summary: {
          description: "Get account summary information",
          parameters: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "The account ID (optional, will use default if not provided)",
              },
            },
          },
        },
        get_market_data: {
          description: "Get market data for a specific contract",
          parameters: {
            type: "object",
            properties: {
              symbol: {
                type: "string",
                description: "The contract symbol (e.g., ESZ4, NQZ4)",
              },
              dataType: {
                type: "string",
                description: "Type of market data to retrieve",
                enum: ["Quote", "DOM", "Chart"],
              },
              chartTimeframe: {
                type: "string",
                description: "Timeframe for chart data",
                enum: ["1min", "5min", "15min", "30min", "1hour", "4hour", "1day"],
              },
            },
            required: ["symbol", "dataType"],
          },
        },
      },
    },
  }
);

/**
 * Resource handlers for the MCP server
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  // Return list of available resources
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
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  
  // Parse the URI to get the resource type and ID
  // Handle both tradovate:// protocol scheme and simple tradovate/ format
  const match = uri.match(/^(?:tradovate:\/\/|tradovate\/)([^\/]+)(?:\/(.*))?$/);
  
  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }
  
  const resourceType = match[1];
  const resourceId = match[2] || '';
  
  if (!resourceType) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }
  
  // Handle different resource types
  switch (resourceType) {
    case "contract": {
      if (resourceId) {
        // Return specific contract
        const contract = contractsCache[resourceId];
        if (!contract) {
          throw new Error(`Resource not found: ${uri}`);
        }
        
        return {
          contents: [
            {
              type: "application/json",
              text: JSON.stringify(contract),
              uri: `tradovate://contract/${resourceId}`
            },
          ],
        };
      } else {
        // Return list of contracts
        const contracts = Object.values(contractsCache);
        
        return {
          contents: [
            {
              type: "application/json",
              text: JSON.stringify(contracts),
              uri: "tradovate://contract/"
            },
          ],
        };
      }
    }
    
    case "position": {
      if (resourceId) {
        // Return specific position - fetch directly from API
        try {
          const position = await tradovateRequest('GET', `position/find?id=${resourceId}`);
          if (!position) {
            throw new Error(`Resource not found: ${uri}`);
          }
          
          return {
            contents: [
              {
                type: "application/json",
                text: JSON.stringify(position),
                uri: `tradovate://position/${resourceId}`
              },
            ],
          };
        } catch (error) {
          logger.error(`Error fetching position ${resourceId}:`, error);
          throw new Error(`Resource not found: ${uri}`);
        }
      } else {
        // Return list of positions - fetch directly from API
        try {
          const positions = await tradovateRequest('GET', 'position/list');
          
          return {
            contents: [
              {
                type: "application/json",
                text: JSON.stringify(positions),
                uri: "tradovate://position/"
              },
            ],
          };
        } catch (error) {
          logger.error('Error fetching positions:', error);
          throw new Error(`Error fetching positions: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    
    default:
      throw new Error(`Unknown resource type: ${resourceType}`);
  }
});

/**
 * Tool handlers for the MCP server
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_contract_details",
        description: "Get detailed information about a specific contract by symbol",
        inputSchema: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              description: "The contract symbol (e.g., ESZ4, NQZ4)",
            },
          },
          required: ["symbol"],
        },
      },
      {
        name: "list_positions",
        description: "List all positions for an account",
        inputSchema: {
          type: "object",
          properties: {
            accountId: {
              type: "string",
              description: "The account ID (optional, will use default if not provided)",
            },
          },
        },
      },
      {
        name: "place_order",
        description: "Place a new order",
        inputSchema: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              description: "The contract symbol (e.g., ESZ4, NQZ4)",
            },
            action: {
              type: "string",
              description: "Buy or Sell",
              enum: ["Buy", "Sell"],
            },
            orderType: {
              type: "string",
              description: "Type of order",
              enum: ["Market", "Limit", "Stop", "StopLimit"],
            },
            quantity: {
              type: "number",
              description: "Number of contracts",
            },
            price: {
              type: "number",
              description: "Price for Limit and StopLimit orders",
            },
            stopPrice: {
              type: "number",
              description: "Stop price for Stop and StopLimit orders",
            },
          },
          required: ["symbol", "action", "orderType", "quantity"],
        },
      },
      {
        name: "modify_order",
        description: "Modify an existing order",
        inputSchema: {
          type: "object",
          properties: {
            orderId: {
              type: "string",
              description: "The order ID to modify",
            },
            price: {
              type: "number",
              description: "New price for Limit and StopLimit orders",
            },
            stopPrice: {
              type: "number",
              description: "New stop price for Stop and StopLimit orders",
            },
            quantity: {
              type: "number",
              description: "New quantity",
            },
          },
          required: ["orderId"],
        },
      },
      {
        name: "cancel_order",
        description: "Cancel an existing order",
        inputSchema: {
          type: "object",
          properties: {
            orderId: {
              type: "string",
              description: "The order ID to cancel",
            },
          },
          required: ["orderId"],
        },
      },
      {
        name: "liquidate_position",
        description: "Close an existing position",
        inputSchema: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              description: "The contract symbol (e.g., ESZ4, NQZ4)",
            },
          },
          required: ["symbol"],
        },
      },
      {
        name: "get_account_summary",
        description: "Get account summary information",
        inputSchema: {
          type: "object",
          properties: {
            accountId: {
              type: "string",
              description: "The account ID (optional, will use default if not provided)",
            },
          },
        },
      },
      {
        name: "get_market_data",
        description: "Get market data for a specific contract",
        inputSchema: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              description: "The contract symbol (e.g., ESZ4, NQZ4)",
            },
            dataType: {
              type: "string",
              description: "Type of market data to retrieve",
              enum: ["Quote", "DOM", "Chart"],
            },
            chartTimeframe: {
              type: "string",
              description: "Timeframe for chart data",
              enum: ["1min", "5min", "15min", "30min", "1hour", "4hour", "1day"],
            },
          },
          required: ["symbol", "dataType"],
        },
      },
    ],
  };
});

/**
 * Handler for tool calls.
 * Implements the logic for each tool
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_contract_details":
      return await handleGetContractDetails(request);
    
    case "list_positions":
      return await handleListPositions(request);
    
    case "place_order":
      return await handlePlaceOrder(request);
    
    case "modify_order":
      return await handleModifyOrder(request);
    
    case "cancel_order":
      return await handleCancelOrder(request);
    
    case "liquidate_position":
      return await handleLiquidatePosition(request);
    
    case "get_account_summary":
      return await handleGetAccountSummary(request);
    
    case "get_market_data":
      return await handleGetMarketData(request);
    
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

/**
 * Prompt/template handlers for the MCP server
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [] // No templates/prompts available in this server
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  throw new Error(`Prompt not found: ${request.params.id}`);
});

/**
 * Initialize the server by authenticating with Tradovate API
 */
export async function initialize() {
  try {
    // Authenticate with Tradovate API
    await authenticate();
    logger.info("Tradovate MCP server initialized successfully");
    
    // Initialize data
    await initializeData();
    
    // Set up periodic data refresh (every 5 minutes)
    setInterval(async () => {
      try {
        await initializeData();
      } catch (error) {
        logger.error("Error refreshing data:", error);
      }
    }, 5 * 60 * 1000);
  } catch (error) {
    logger.error("Failed to initialize Tradovate MCP server:", error);
    logger.warn("Server will start with mock data fallback");
  }
}

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
export async function main() {
  await initialize();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only run main if this file is executed directly
// Check if we're in a test environment
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

// Skip the main execution in test environment
if (!isTestEnvironment) {
  // Simple check to see if this file is being run directly
  const isMainModule = process.argv.length > 1 && process.argv[1].includes('index');
  if (isMainModule) {
    main().catch((error) => {
      logger.error("Server error:", error);
      process.exit(1);
    });
  }
}
