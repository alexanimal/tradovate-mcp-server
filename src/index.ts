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
  handleGetMarketData,
  handleListOrders,
  handleListProducts,
  handleListExchanges,
  handleFindProduct
} from "./tools.js";
import { connect } from "./connect.js";
import { getTradovateMdApiUrl } from "./auth.js";
import { WebSocket } from "ws";
import { TradovateSocket, createMarketDataSocket, createTradingSocket, WebSocketManager } from "./socket.js";

// Add global declaration for tradovate sockets
declare global {
  var tradovateWs: WebSocket;
  var marketDataSocket: TradovateSocket;
  var tradingSocket: TradovateSocket;
}

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
      prompts: {
        analyze_market_data: [{
          name: "analyze_market_data",
          description: "Analyze market data for a specific contract",
          arguments: {
            name: "symbol",
            description: "The contract symbol (e.g., ESZ4, NQZ4)",
            required: true,
          }
        }]
      },
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
        list_orders: {
          description: "List orders for an account",
          parameters: {
            type: "object",
            properties: {
              accountId: {
                type: "string",
                description: "The account ID (optional, will use default if not provided)",
              },
              status: {
                type: "string",
                description: "Filter orders by status (e.g., 'Working', 'Completed', 'Canceled')",
              },
            },
          },
        },
        list_products: {
          description: "List available products or get a specific product by contractId",
          parameters: {
            type: "object",
            properties: {
              contractId: {
                type: "string",
                description: "The contract ID to filter by (optional, will return all products if not provided)",
              },
            },
          },
        },
        list_exchanges: {
          description: "List available exchanges from Tradovate",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        find_product: {
          description: "Find a specific product by name",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "The product name to search for",
              },
            },
            required: ["name"],
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
        }
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
        }
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
        }
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
        }
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
        }
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
        }
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
        }
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
      {
        name: "list_orders",
        description: "List orders for an account",
        inputSchema: {
          type: "object",
          properties: {
            accountId: {
              type: "string",
              description: "The account ID (optional, will use default if not provided)",
            },
            status: {
              type: "string",
              description: "Filter orders by status (e.g., 'Working', 'Completed', 'Canceled')",
            },
          },
        },
      },
      {
        name: "list_products",
        description: "List available products or get a specific product by contractId",
        inputSchema: {
          type: "object",
          properties: {
            contractId: {
              type: "string",
              description: "The contract ID to filter by (optional, will return all products if not provided)",
            },
          },
        },
      },
      {
        name: "list_exchanges",
        description: "List available exchanges from Tradovate",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "find_product",
        description: "Find a specific product by name",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The product name to search for",
            },
          },
          required: ["name"],
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
    
    case "list_orders":
      return await handleListOrders(request);
    
    case "list_products":
      return await handleListProducts(request);
    
    case "list_exchanges":
      return await handleListExchanges(request);
    
    case "find_product":
      return await handleFindProduct(request);
    
    default:
      throw new Error(`Tool not found: ${request.params.name}`);
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
 * Prompt/template handlers for the MCP server
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [{
      name: "analyze_market_data",
      id: "analyze_market_data",
      description: "Analyze market data for a specific contract",
      arguments: {
        name: "symbol",
        description: "The contract symbol (e.g., ESZ4, NQZ4)",
        required: true,
      }
    }] // No templates/prompts available in this server
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
    }, 60 * 60 * 1000);
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
  try {
    logger.info("Initializing Tradovate MCP server...");
    
    // Initialize authentication first to ensure we have valid tokens
    await authenticate();
    logger.info("Authentication successful");
    
    // Initialize data - this doesn't rely on WebSockets
    await initialize();
    
    // Start MCP server - do this early to ensure server is responsive
    logger.info("Starting MCP server...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("MCP Server started successfully");
    
    // Initialize WebSockets in the background - non-blocking
    // This ensures the server is responsive even while connections are being established
    initializeWebSockets();
    
    // Register signal handlers for graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT (Ctrl+C). Gracefully shutting down...');
      try {
        // Close WebSocket connections
        closeAllWebSocketConnections();
        logger.info('All connections closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
    
    // Also handle SIGTERM for container environments
    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM. Gracefully shutting down...');
      try {
        // Close WebSocket connections
        closeAllWebSocketConnections();
        logger.info('All connections closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
    
    // Add unhandled error handlers to prevent crashes
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      // Don't exit on uncaught - let the process continue if possible
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection:', reason);
      // Don't exit on unhandled promise - let the process continue if possible
    });
    
  } catch (error) {
    logger.error("Failed to initialize server:", error);
    logger.warn("Will attempt to continue with partial functionality");
    
    // Try to start the server anyway
    try {
      await initialize();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info("MCP Server started in limited functionality mode");
      
      // Try to initialize WebSockets in the background
      initializeWebSockets();
    } catch (serverError) {
      logger.error("Fatal error starting server:", serverError);
      process.exit(1);
    }
  }
}

/**
 * Helper function to close all WebSocket connections
 */
function closeAllWebSocketConnections() {
  // Close WebSocket connections managed by WebSocketManager
  try { 
    WebSocketManager.getInstance().closeAll(); 
    logger.info('Closed WebSocketManager connections');
  } catch (err) { 
    logger.warn('Error closing WebSocketManager connections:', err); 
  }
  
  // Close any direct WebSocket connections
  if (global.tradovateWs) {
    try { global.tradovateWs.close(); logger.info('Closed legacy WebSocket'); } 
    catch (err) { logger.warn('Error closing legacy WebSocket:', err); }
  }
  if (global.marketDataSocket) {
    try { global.marketDataSocket.close(); logger.info('Closed Market Data WebSocket'); } 
    catch (err) { logger.warn('Error closing Market Data WebSocket:', err); }
  }
  if (global.tradingSocket) {
    try { global.tradingSocket.close(); logger.info('Closed Trading WebSocket'); } 
    catch (err) { logger.warn('Error closing Trading WebSocket:', err); }
  }
}

/**
 * Initialize WebSockets in the background
 * This function sets up WebSocket connections without blocking the MCP server
 */
function initializeWebSockets() {
  logger.info('Initializing WebSocket connections in background...');
  
  // Get the singleton instance - this starts connections in the background
  const socketManager = WebSocketManager.getInstance();
  
  // Log initial connection statuses
  logger.info(`Market Data WebSocket initial status: ${socketManager.getMarketDataStatus()}`);
  logger.info(`Trading WebSocket initial status: ${socketManager.getTradingStatus()}`);
  
  // Initialize connections happened automatically in the constructor
  logger.info('WebSocket initialization started. Connections will be established in the background.');
  
  // For compatibility with legacy code - set up global references
  // These will be initialized asynchronously without blocking
  setupGlobalWebSocketReferences();
}

/**
 * Set up global WebSocket references without blocking
 * This ensures backward compatibility with code expecting global WebSockets
 */
async function setupGlobalWebSocketReferences() {
  const socketManager = WebSocketManager.getInstance();
  
  // Set up market data socket reference
  socketManager.getMarketDataSocket()
    .then(socket => {
      global.marketDataSocket = socket;
      logger.info('Global market data socket reference established');
    })
    .catch(error => {
      logger.error('Failed to establish global market data socket reference:', error);
      logger.warn('Market data functionality will be limited');
    });
  
  // Set up trading socket reference
  const useLiveTrading = process.env.TRADOVATE_API_ENVIRONMENT === 'live';
  socketManager.getTradingSocket(useLiveTrading)
    .then(socket => {
      global.tradingSocket = socket;
      logger.info(`Global trading socket reference established (${useLiveTrading ? 'live' : 'demo'})`);
    })
    .catch(error => {
      logger.error('Failed to establish global trading socket reference:', error);
      logger.warn('Trading functionality will be limited');
    });
  
  // For legacy WebSocket compatibility
  try {
    const ws = new WebSocket(getTradovateMdApiUrl());
    connect(ws)
      .then(legacySocket => {
        global.tradovateWs = legacySocket;
        logger.info('Global legacy WebSocket reference established');
      })
      .catch(error => {
        logger.error('Failed to establish legacy WebSocket reference:', error);
        logger.warn('Legacy WebSocket functionality will be unavailable');
      });
  } catch (error) {
    logger.error('Error creating legacy WebSocket:', error);
    logger.warn('Legacy WebSocket functionality will be unavailable');
  }
  
  // Log a status update after 30 seconds
  setTimeout(() => {
    logger.info('WebSocket connection status after 30 seconds:');
    logger.info(`Market Data WebSocket: ${socketManager.getMarketDataStatus()}`);
    logger.info(`Trading WebSocket: ${socketManager.getTradingStatus()}`);
    logger.info(`Legacy WebSocket: ${global.tradovateWs ? 'Connected' : 'Not connected'}`);
  }, 30000);
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

// Initialize WebSockets in the background at startup - this is separate from main()
// to ensure it happens even if the file is imported rather than run directly
initializeWebSockets();
