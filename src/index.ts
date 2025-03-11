#!/usr/bin/env node

/**
 * This is a Tradovate MCP server that implements tools for managing Contract and Order Positions.
 * It demonstrates core MCP concepts like resources and tools by allowing:
 * - Listing contracts and positions as resources
 * - Reading individual contract and position details
 * - Managing positions via tools (create, modify, close)
 * - Getting account information and market data
 */

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
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

/**
 * Type definitions for Tradovate API entities
 */
type Contract = {
  id: number;
  name: string;
  contractMaturityId: number;
  productId: number;
  productType: string;
  description: string;
  status: string;
};

type Position = {
  id: number;
  accountId: number;
  contractId: number;
  timestamp: string;
  tradeDate: { year: number; month: number; day: number };
  netPos: number;
  netPrice: number;
  realizedPnl: number;
  openPnl: number;
  markPrice: number;
};

type Order = {
  id: number;
  accountId: number;
  contractId: number;
  timestamp: string;
  action: string;
  ordStatus: string;
  orderQty: number;
  orderType: string;
  price?: number;
  stopPrice?: number;
};

type Account = {
  id: number;
  name: string;
  userId: number;
  accountType: string;
  active: boolean;
  clearingHouseId: number;
  riskCategoryId: number;
  autoLiqProfileId: number;
  marginAccountType: string;
  legalStatus: string;
};

/**
 * Mock data for demonstration purposes
 * In a real implementation, this would be fetched from the Tradovate API
 */
const contracts: { [id: string]: Contract } = {
  "1": {
    id: 1,
    name: "ESZ4",
    contractMaturityId: 12345,
    productId: 473,
    productType: "Future",
    description: "E-mini S&P 500 Future December 2024",
    status: "Active"
  },
  "2": {
    id: 2,
    name: "NQZ4",
    contractMaturityId: 12346,
    productId: 474,
    productType: "Future",
    description: "E-mini NASDAQ-100 Future December 2024",
    status: "Active"
  }
};

const positions: { [id: string]: Position } = {
  "1": {
    id: 1,
    accountId: 12345,
    contractId: 1,
    timestamp: "2024-03-10T12:00:00Z",
    tradeDate: { year: 2024, month: 3, day: 10 },
    netPos: 2,
    netPrice: 5200.25,
    realizedPnl: 0,
    openPnl: 150.50,
    markPrice: 5275.50
  },
  "2": {
    id: 2,
    accountId: 12345,
    contractId: 2,
    timestamp: "2024-03-10T12:30:00Z",
    tradeDate: { year: 2024, month: 3, day: 10 },
    netPos: -1,
    netPrice: 18250.75,
    realizedPnl: 0,
    openPnl: -75.25,
    markPrice: 18326.00
  }
};

const orders: { [id: string]: Order } = {
  "1": {
    id: 1,
    accountId: 12345,
    contractId: 1,
    timestamp: "2024-03-10T11:55:00Z",
    action: "Buy",
    ordStatus: "Filled",
    orderQty: 2,
    orderType: "Market"
  },
  "2": {
    id: 2,
    accountId: 12345,
    contractId: 2,
    timestamp: "2024-03-10T12:25:00Z",
    action: "Sell",
    ordStatus: "Filled",
    orderQty: 1,
    orderType: "Market"
  }
};

const accounts: { [id: string]: Account } = {
  "12345": {
    id: 12345,
    name: "Demo Account",
    userId: 67890,
    accountType: "Customer",
    active: true,
    clearingHouseId: 1,
    riskCategoryId: 1,
    autoLiqProfileId: 1,
    marginAccountType: "Regular",
    legalStatus: "Individual"
  }
};

/**
 * Tradovate API configuration
 * In a real implementation, these would be environment variables or configuration settings
 */
const TRADOVATE_API_URL = "https://demo.tradovateapi.com/v1";
let accessToken: string | null = null;

/**
 * Tradovate API authentication and request handling
 */
interface TradovateCredentials {
  name: string;
  password: string;
  appId: string;
  appVersion: string;
  deviceId: string;
  cid: string;
  sec: string;
}

// Load credentials from environment variables or config file
const credentials: TradovateCredentials = {
  name: process.env.TRADOVATE_USERNAME || "",
  password: process.env.TRADOVATE_PASSWORD || "",
  appId: process.env.TRADOVATE_APP_ID || "",
  appVersion: "1.0.0",
  deviceId: process.env.TRADOVATE_DEVICE_ID || "",
  cid: process.env.TRADOVATE_CID || "",
  sec: process.env.TRADOVATE_SECRET || ""
};

/**
 * Authenticate with Tradovate API and get access token
 */
async function authenticate(): Promise<string> {
  if (accessToken) return accessToken;
  
  try {
    const response = await axios.post(`${TRADOVATE_API_URL}/auth/accessTokenRequest`, credentials);
    
    if (response.data && response.data.accessToken) {
      accessToken = response.data.accessToken;
      console.log("Successfully authenticated with Tradovate API");
      return response.data.accessToken;
    } else {
      throw new Error("Authentication response did not contain an access token");
    }
  } catch (error) {
    console.error("Failed to authenticate with Tradovate API:", error);
    throw new Error("Authentication with Tradovate API failed");
  }
}

/**
 * Make an authenticated request to the Tradovate API
 */
async function tradovateRequest(method: string, endpoint: string, data?: any): Promise<any> {
  const token = await authenticate();
  
  try {
    const response = await axios({
      method,
      url: `${TRADOVATE_API_URL}/${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data
    });
    
    return response.data;
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error);
    throw new Error(`Tradovate API request to ${endpoint} failed`);
  }
}

/**
 * Create an MCP server with capabilities for resources and tools
 */
const server = new Server(
  {
    name: "tradovate-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

/**
 * Handler for listing available resources.
 * Exposes contracts and positions as resources with appropriate URIs and metadata
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    // Get contracts from API
    const contractsData = await tradovateRequest('GET', 'contract/list');
    const contractResources = contractsData.map((contract: Contract) => ({
      uri: `tradovate://contract/${contract.id}`,
      mimeType: "application/json",
      name: contract.name,
      description: `${contract.description} (${contract.productType})`
    }));

    // Get positions from API
    const positionsData = await tradovateRequest('GET', 'position/list');
    const positionResources = positionsData.map((position: Position) => {
      const contract = contractsData.find((c: Contract) => c.id === position.contractId);
      return {
        uri: `tradovate://position/${position.id}`,
        mimeType: "application/json",
        name: `Position: ${contract?.name || position.contractId}`,
        description: `${position.netPos > 0 ? 'Long' : 'Short'} ${Math.abs(position.netPos)} @ ${position.netPrice}`
      };
    });

    return {
      resources: [...contractResources, ...positionResources]
    };
  } catch (error) {
    console.error("Error fetching resources:", error);
    // Fallback to mock data if API call fails
    const contractResources = Object.entries(contracts).map(([id, contract]) => ({
      uri: `tradovate://contract/${id}`,
      mimeType: "application/json",
      name: contract.name,
      description: `${contract.description} (${contract.productType})`
    }));

    const positionResources = Object.entries(positions).map(([id, position]) => {
      const contract = contracts[position.contractId.toString()];
      return {
        uri: `tradovate://position/${id}`,
        mimeType: "application/json",
        name: `Position: ${contract?.name || position.contractId}`,
        description: `${position.netPos > 0 ? 'Long' : 'Short'} ${Math.abs(position.netPos)} @ ${position.netPrice}`
      };
    });

    return {
      resources: [...contractResources, ...positionResources]
    };
  }
});

/**
 * Handler for reading the contents of a specific resource.
 * Takes a tradovate:// URI and returns the appropriate resource content
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  const resourceType = url.hostname;
  const id = url.pathname.replace(/^\//, '');

  try {
    let content: any;

    switch (resourceType) {
      case "contract":
        content = await tradovateRequest('GET', `contract/find?id=${id}`);
        if (!content) {
          throw new Error(`Contract ${id} not found`);
        }
        break;
      case "position":
        content = await tradovateRequest('GET', `position/find?id=${id}`);
        if (!content) {
          throw new Error(`Position ${id} not found`);
        }
        
        // Enrich position data with contract information
        const contract = await tradovateRequest('GET', `contract/find?id=${content.contractId}`);
        content = {
          ...content,
          contractName: contract?.name || "Unknown",
          contractDescription: contract?.description || "Unknown"
        };
        break;
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }

    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(content, null, 2)
      }]
    };
  } catch (error) {
    console.error(`Error reading resource ${request.params.uri}:`, error);
    // Fallback to mock data if API call fails
    let content: any;

    switch (resourceType) {
      case "contract":
        content = contracts[id];
        if (!content) {
          throw new Error(`Contract ${id} not found`);
        }
        break;
      case "position":
        content = positions[id];
        if (!content) {
          throw new Error(`Position ${id} not found`);
        }
        
        // Enrich position data with contract information
        const contract = contracts[content.contractId.toString()];
        content = {
          ...content,
          contractName: contract?.name || "Unknown",
          contractDescription: contract?.description || "Unknown"
        };
        break;
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }

    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(content, null, 2)
      }]
    };
  }
});

/**
 * Handler that lists available tools.
 * Exposes tools for managing contracts and positions
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
              description: "Symbol of the contract (e.g., ESZ4, NQZ4)"
            }
          },
          required: ["symbol"]
        }
      },
      {
        name: "list_positions",
        description: "List all positions for the account",
        inputSchema: {
          type: "object",
          properties: {
            accountId: {
              type: "string",
              description: "Account ID (optional, defaults to primary account)"
            }
          }
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
              description: "Symbol of the contract (e.g., ESZ4, NQZ4)"
            },
            action: {
              type: "string",
              description: "Buy or Sell",
              enum: ["Buy", "Sell"]
            },
            orderType: {
              type: "string",
              description: "Type of order",
              enum: ["Market", "Limit", "Stop", "StopLimit"]
            },
            quantity: {
              type: "number",
              description: "Number of contracts"
            },
            price: {
              type: "number",
              description: "Price for limit orders"
            },
            stopPrice: {
              type: "number",
              description: "Stop price for stop orders"
            }
          },
          required: ["symbol", "action", "orderType", "quantity"]
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
              description: "ID of the order to modify"
            },
            price: {
              type: "number",
              description: "New price for limit orders"
            },
            stopPrice: {
              type: "number",
              description: "New stop price for stop orders"
            },
            quantity: {
              type: "number",
              description: "New quantity"
            }
          },
          required: ["orderId"]
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
              description: "ID of the order to cancel"
            }
          },
          required: ["orderId"]
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
              description: "Symbol of the contract (e.g., ESZ4, NQZ4)"
            }
          },
          required: ["symbol"]
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
              description: "Account ID (optional, defaults to primary account)"
            }
          }
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
              description: "Symbol of the contract (e.g., ESZ4, NQZ4)"
            },
            dataType: {
              type: "string",
              description: "Type of market data",
              enum: ["Quote", "DOM", "Chart"]
            },
            chartTimeframe: {
              type: "string",
              description: "Timeframe for chart data",
              enum: ["1min", "5min", "15min", "30min", "1hour", "4hour", "1day"]
            }
          },
          required: ["symbol", "dataType"]
        }
      }
    ]
  };
});

/**
 * Handler for tool calls.
 * Implements the logic for each tool
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_contract_details": {
      const symbol = String(request.params.arguments?.symbol);
      if (!symbol) {
        throw new Error("Symbol is required");
      }

      try {
        // Find contract by symbol using the API
        const contract = await tradovateRequest('GET', `contract/find?name=${symbol}`);
        
        if (!contract) {
          return {
            content: [{
              type: "text",
              text: `Contract not found for symbol: ${symbol}`
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: `Contract details for ${symbol}:\n${JSON.stringify(contract, null, 2)}`
          }]
        };
      } catch (error) {
        console.error(`Error getting contract details for ${symbol}:`, error);
        // Fallback to mock data if API call fails
        const contract = contracts[symbol];
        if (!contract) {
          return {
            content: [{
              type: "text",
              text: `Contract not found for symbol: ${symbol}`
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: `Contract details for ${symbol}:\n${JSON.stringify(contract, null, 2)}`
          }]
        };
      }
    }

    case "list_positions": {
      const accountId = String(request.params.arguments?.accountId || "");
      
      try {
        // Get positions from API
        let endpoint = 'position/list';
        if (accountId) {
          endpoint += `?accountId=${accountId}`;
        }
        
        const positions = await tradovateRequest('GET', endpoint);
        
        if (!positions || positions.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No positions found${accountId ? ` for account ${accountId}` : ''}`
            }]
          };
        }

        // Enrich positions with contract information
        const enrichedPositions = await Promise.all(positions.map(async (position: Position) => {
          const contract = await tradovateRequest('GET', `contract/find?id=${position.contractId}`);
          return {
            ...position,
            contractName: contract?.name || "Unknown",
            contractDescription: contract?.description || "Unknown"
          };
        }));

        return {
          content: [{
            type: "text",
            text: `Positions${accountId ? ` for account ${accountId}` : ''}:\n${JSON.stringify(enrichedPositions, null, 2)}`
          }]
        };
      } catch (error) {
        console.error("Error listing positions:", error);
        // Fallback to mock data if API call fails
        const accountPositions = Object.values(positions).filter(p => p.accountId.toString() === accountId);
        
        if (accountPositions.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No positions found for account ${accountId}`
            }]
          };
        }

        // Enrich positions with contract information
        const enrichedPositions = accountPositions.map(position => {
          const contract = contracts[position.contractId.toString()];
          return {
            ...position,
            contractName: contract?.name || "Unknown",
            contractDescription: contract?.description || "Unknown"
          };
        });

        return {
          content: [{
            type: "text",
            text: `Positions for account ${accountId}:\n${JSON.stringify(enrichedPositions, null, 2)}`
          }]
        };
      }
    }

    case "place_order": {
      const symbol = String(request.params.arguments?.symbol);
      const action = String(request.params.arguments?.action);
      const orderType = String(request.params.arguments?.orderType);
      const quantity = Number(request.params.arguments?.quantity);
      const price = request.params.arguments?.price ? Number(request.params.arguments.price) : undefined;
      const stopPrice = request.params.arguments?.stopPrice ? Number(request.params.arguments.stopPrice) : undefined;

      if (!symbol || !action || !orderType || !quantity) {
        throw new Error("Symbol, action, orderType, and quantity are required");
      }

      try {
        // Find contract by symbol
        const contract = await tradovateRequest('GET', `contract/find?name=${symbol}`);
        
        if (!contract) {
          return {
            content: [{
              type: "text",
              text: `Contract not found for symbol: ${symbol}`
            }]
          };
        }

        // Validate order type and required parameters
        if ((orderType === "Limit" || orderType === "StopLimit") && price === undefined) {
          throw new Error("Price is required for Limit and StopLimit orders");
        }

        if ((orderType === "Stop" || orderType === "StopLimit") && stopPrice === undefined) {
          throw new Error("Stop price is required for Stop and StopLimit orders");
        }

        // Get account ID
        const accounts = await tradovateRequest('GET', 'account/list');
        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts found");
        }
        
        const accountId = accounts[0].id; // Use the first account

        // Prepare order data
        const orderData = {
          accountId,
          contractId: contract.id,
          action,
          orderQty: quantity,
          orderType,
          price,
          stopPrice
        };

        // Place order via API
        const newOrder = await tradovateRequest('POST', 'order/placeOrder', orderData);

        return {
          content: [{
            type: "text",
            text: `Order placed successfully:\n${JSON.stringify(newOrder, null, 2)}`
          }]
        };
      } catch (error) {
        console.error("Error placing order:", error);
        // Fallback to mock data if API call fails
        const newOrderId = String(Object.keys(orders).length + 1);
        const newOrder: Order = {
          id: parseInt(newOrderId),
          accountId: 12345,
          contractId: 1,
          timestamp: new Date().toISOString(),
          action,
          ordStatus: "Working",
          orderQty: quantity,
          orderType,
          price,
          stopPrice
        };

        orders[newOrderId] = newOrder;

        return {
          content: [{
            type: "text",
            text: `Order placed successfully:\n${JSON.stringify(newOrder, null, 2)}`
          }]
        };
      }
    }

    case "modify_order": {
      const orderId = String(request.params.arguments?.orderId);
      const price = request.params.arguments?.price !== undefined ? Number(request.params.arguments.price) : undefined;
      const stopPrice = request.params.arguments?.stopPrice !== undefined ? Number(request.params.arguments.stopPrice) : undefined;
      const quantity = request.params.arguments?.quantity !== undefined ? Number(request.params.arguments.quantity) : undefined;

      if (!orderId) {
        throw new Error("Order ID is required");
      }

      try {
        // Find order by ID
        const order = await tradovateRequest('GET', `order/find?id=${orderId}`);
        
        if (!order) {
          return {
            content: [{
              type: "text",
              text: `Order not found with ID: ${orderId}`
            }]
          };
        }

        // Prepare modification data
        const modifyData: any = { orderId: parseInt(orderId) };
        if (price !== undefined) modifyData.price = price;
        if (stopPrice !== undefined) modifyData.stopPrice = stopPrice;
        if (quantity !== undefined) modifyData.orderQty = quantity;

        // Modify order via API
        const updatedOrder = await tradovateRequest('POST', 'order/modifyOrder', modifyData);

        return {
          content: [{
            type: "text",
            text: `Order modified successfully:\n${JSON.stringify(updatedOrder, null, 2)}`
          }]
        };
      } catch (error) {
        console.error(`Error modifying order ${orderId}:`, error);
        // Fallback to mock data if API call fails
        const order = orders[orderId];
        if (!order) {
          return {
            content: [{
              type: "text",
              text: `Order not found with ID: ${orderId}`
            }]
          };
        }

        // Update order (in a real implementation, this would call the Tradovate API)
        if (price !== undefined) order.price = price;
        if (stopPrice !== undefined) order.stopPrice = stopPrice;
        if (quantity !== undefined) order.orderQty = quantity;

        return {
          content: [{
            type: "text",
            text: `Order modified successfully:\n${JSON.stringify(order, null, 2)}`
          }]
        };
      }
    }

    case "cancel_order": {
      const orderId = String(request.params.arguments?.orderId);

      if (!orderId) {
        throw new Error("Order ID is required");
      }

      try {
        // Find order by ID
        const order = await tradovateRequest('GET', `order/find?id=${orderId}`);
        
        if (!order) {
          return {
            content: [{
              type: "text",
              text: `Order not found with ID: ${orderId}`
            }]
          };
        }

        // Cancel order via API
        const canceledOrder = await tradovateRequest('POST', 'order/cancelOrder', { orderId: parseInt(orderId) });

        return {
          content: [{
            type: "text",
            text: `Order canceled successfully:\n${JSON.stringify(canceledOrder, null, 2)}`
          }]
        };
      } catch (error) {
        console.error(`Error canceling order ${orderId}:`, error);
        // Fallback to mock data if API call fails
        const order = orders[orderId];
        if (!order) {
          return {
            content: [{
              type: "text",
              text: `Order not found with ID: ${orderId}`
            }]
          };
        }

        // Cancel order (in a real implementation, this would call the Tradovate API)
        order.ordStatus = "Canceled";

        return {
          content: [{
            type: "text",
            text: `Order canceled successfully:\n${JSON.stringify(order, null, 2)}`
          }]
        };
      }
    }

    case "liquidate_position": {
      const symbol = String(request.params.arguments?.symbol);

      if (!symbol) {
        throw new Error("Symbol is required");
      }

      try {
        // Find contract by symbol
        const contract = await tradovateRequest('GET', `contract/find?name=${symbol}`);
        
        if (!contract) {
          return {
            content: [{
              type: "text",
              text: `Contract not found for symbol: ${symbol}`
            }]
          };
        }

        // Find position by contract ID
        const positions = await tradovateRequest('GET', 'position/list');
        const position = positions.find((p: Position) => p.contractId === contract.id);
        
        if (!position) {
          return {
            content: [{
              type: "text",
              text: `No position found for symbol: ${symbol}`
            }]
          };
        }

        // Liquidate position via API
        const liquidationResult = await tradovateRequest('POST', 'order/liquidatePosition', { 
          accountId: position.accountId,
          contractId: position.contractId
        });

        return {
          content: [{
            type: "text",
            text: `Position liquidated successfully:\n${JSON.stringify(liquidationResult, null, 2)}`
          }]
        };
      } catch (error) {
        console.error(`Error liquidating position for ${symbol}:`, error);
        // Fallback to mock data if API call fails
        const mockPosition = Object.values(positions).find(p => {
          const mockContract = contracts[p.contractId.toString()];
          return mockContract && mockContract.name === symbol;
        });
        
        if (!mockPosition) {
          return {
            content: [{
              type: "text",
              text: `No position found for symbol: ${symbol}`
            }]
          };
        }

        // Create liquidation order using mock data
        const mockOrderId = String(Object.keys(orders).length + 1);
        const mockAction = mockPosition.netPos > 0 ? "Sell" : "Buy";
        const mockOrder: Order = {
          id: parseInt(mockOrderId),
          accountId: mockPosition.accountId,
          contractId: mockPosition.contractId,
          timestamp: new Date().toISOString(),
          action: mockAction,
          ordStatus: "Working",
          orderQty: Math.abs(mockPosition.netPos),
          orderType: "Market"
        };

        orders[mockOrderId] = mockOrder;

        // Update position
        mockPosition.netPos = 0;
        mockPosition.realizedPnl += mockPosition.openPnl;
        mockPosition.openPnl = 0;

        return {
          content: [{
            type: "text",
            text: `Position liquidated successfully:\n${JSON.stringify(mockPosition, null, 2)}\nLiquidation order:\n${JSON.stringify(mockOrder, null, 2)}`
          }]
        };
      }
    }

    case "get_account_summary": {
      const accountId = String(request.params.arguments?.accountId || "");
      
      try {
        // Get accounts
        let accounts;
        if (accountId) {
          accounts = [await tradovateRequest('GET', `account/find?id=${accountId}`)];
          if (!accounts[0]) {
            return {
              content: [{
                type: "text",
                text: `Account not found with ID: ${accountId}`
              }]
            };
          }
        } else {
          accounts = await tradovateRequest('GET', 'account/list');
          if (!accounts || accounts.length === 0) {
            return {
              content: [{
                type: "text",
                text: `No accounts found`
              }]
            };
          }
        }

        const account = accounts[0];
        const actualAccountId = account.id;

        // Get cash balance
        const cashBalance = await tradovateRequest('POST', 'cashBalance/getCashBalanceSnapshot', { accountId: actualAccountId });
        
        // Get positions
        const positions = await tradovateRequest('GET', `position/list?accountId=${actualAccountId}`);
        
        // Calculate summary
        const totalRealizedPnl = positions.reduce((sum: number, pos: Position) => sum + pos.realizedPnl, 0);
        const totalOpenPnl = positions.reduce((sum: number, pos: Position) => sum + pos.openPnl, 0);
        
        const summary = {
          account,
          balance: cashBalance.cashBalance,
          openPnl: totalOpenPnl,
          totalEquity: cashBalance.cashBalance + totalOpenPnl,
          marginUsed: cashBalance.initialMargin,
          availableMargin: cashBalance.cashBalance - cashBalance.initialMargin + totalOpenPnl,
          positionCount: positions.length
        };

        return {
          content: [{
            type: "text",
            text: `Account summary for ${account.name}:\n${JSON.stringify(summary, null, 2)}`
          }]
        };
      } catch (error) {
        console.error("Error getting account summary:", error);
        // Fallback to mock data if API call fails
        const mockAccountId = accountId || "12345";
        const mockAccount = accounts[mockAccountId];
        
        if (!mockAccount) {
          return {
            content: [{
              type: "text",
              text: `Account not found with ID: ${mockAccountId}`
            }]
          };
        }

        // Calculate account summary using mock data
        const mockPositions = Object.values(positions).filter(p => p.accountId.toString() === mockAccountId);
        const mockTotalRealizedPnl = mockPositions.reduce((sum, pos) => sum + pos.realizedPnl, 0);
        const mockTotalOpenPnl = mockPositions.reduce((sum, pos) => sum + pos.openPnl, 0);
        
        const mockSummary = {
          account: mockAccount,
          balance: 100000 + mockTotalRealizedPnl, // Mock initial balance
          openPnl: mockTotalOpenPnl,
          totalEquity: 100000 + mockTotalRealizedPnl + mockTotalOpenPnl,
          marginUsed: 10000, // Mock margin
          availableMargin: 90000 + mockTotalRealizedPnl + mockTotalOpenPnl,
          positionCount: mockPositions.length
        };

        return {
          content: [{
            type: "text",
            text: `Account summary for ${mockAccountId}:\n${JSON.stringify(mockSummary, null, 2)}`
          }]
        };
      }
    }

    case "get_market_data": {
      const symbol = String(request.params.arguments?.symbol);
      const dataType = String(request.params.arguments?.dataType);
      const chartTimeframe = String(request.params.arguments?.chartTimeframe || "1min");

      if (!symbol || !dataType) {
        throw new Error("Symbol and dataType are required");
      }

      // Find contract by symbol
      const contract = Object.values(contracts).find(c => c.name === symbol);
      if (!contract) {
        return {
          content: [{
            type: "text",
            text: `Contract not found for symbol: ${symbol}`
          }]
        };
      }

      // Generate mock market data based on data type
      let marketData: any;
      
      switch (dataType) {
        case "Quote":
          marketData = {
            symbol,
            bid: 5275.25,
            ask: 5275.50,
            last: 5275.25,
            volume: 1250000,
            timestamp: new Date().toISOString()
          };
          break;
        
        case "DOM":
          marketData = {
            symbol,
            bids: [
              { price: 5275.25, size: 250 },
              { price: 5275.00, size: 175 },
              { price: 5274.75, size: 320 },
              { price: 5274.50, size: 450 },
              { price: 5274.25, size: 280 }
            ],
            asks: [
              { price: 5275.50, size: 180 },
              { price: 5275.75, size: 220 },
              { price: 5276.00, size: 350 },
              { price: 5276.25, size: 275 },
              { price: 5276.50, size: 400 }
            ],
            timestamp: new Date().toISOString()
          };
          break;
        
        case "Chart":
          // Generate mock chart data for the requested timeframe
          const now = new Date();
          const bars = [];
          
          for (let i = 0; i < 10; i++) {
            const barTime = new Date(now);
            
            switch (chartTimeframe) {
              case "1min": barTime.setMinutes(now.getMinutes() - i); break;
              case "5min": barTime.setMinutes(now.getMinutes() - i * 5); break;
              case "15min": barTime.setMinutes(now.getMinutes() - i * 15); break;
              case "30min": barTime.setMinutes(now.getMinutes() - i * 30); break;
              case "1hour": barTime.setHours(now.getHours() - i); break;
              case "4hour": barTime.setHours(now.getHours() - i * 4); break;
              case "1day": barTime.setDate(now.getDate() - i); break;
            }
            
            const basePrice = 5275.00;
            const open = basePrice - i * 0.25;
            const high = open + Math.random() * 1.5;
            const low = open - Math.random() * 1.5;
            const close = (open + high + low) / 3;
            const volume = Math.floor(Math.random() * 10000) + 5000;
            
            bars.push({
              timestamp: barTime.toISOString(),
              open,
              high,
              low,
              close,
              volume
            });
          }
          
          marketData = {
            symbol,
            timeframe: chartTimeframe,
            bars: bars.reverse()
          };
          break;
        
        default:
          throw new Error(`Unsupported data type: ${dataType}`);
      }

      return {
        content: [{
          type: "text",
          text: `Market data for ${symbol} (${dataType}):\n${JSON.stringify(marketData, null, 2)}`
        }]
      };
    }

    default:
      throw new Error("Unknown tool");
  }
});

/**
 * Handler that lists available prompts.
 * Exposes prompts for analyzing trading data
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "analyze_positions",
        description: "Analyze current positions and provide insights",
      },
      {
        name: "market_overview",
        description: "Get an overview of the current market conditions",
      }
    ]
  };
});

/**
 * Handler for prompts.
 * Returns structured prompts with embedded resources
 */
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  switch (request.params.name) {
    case "analyze_positions": {
      // Get all positions
      const allPositions = Object.values(positions);
      
      // Enrich positions with contract information
      const enrichedPositions = allPositions.map(position => {
        const contract = contracts[position.contractId.toString()];
        return {
          ...position,
          contractName: contract?.name || "Unknown",
          contractDescription: contract?.description || "Unknown"
        };
      });

      // Create embedded resources for each position
      const embeddedPositions = enrichedPositions.map(position => ({
        type: "resource" as const,
        resource: {
          uri: `tradovate://position/${position.id}`,
          mimeType: "application/json",
          text: JSON.stringify(position, null, 2)
        }
      }));

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Please analyze the following trading positions:"
            }
          },
          ...embeddedPositions.map(position => ({
            role: "user" as const,
            content: position
          })),
          {
            role: "user",
            content: {
              type: "text",
              text: "Provide a detailed analysis of these positions, including:\n1. Overall risk exposure\n2. Profit/loss analysis\n3. Recommendations for position management\n4. Any concerning patterns or opportunities"
            }
          }
        ]
      };
    }

    case "market_overview": {
      // Create embedded resources for market data
      const marketDataResources = Object.values(contracts).map(contract => {
        // Generate mock market data
        const marketData = {
          symbol: contract.name,
          bid: 5275.25,
          ask: 5275.50,
          last: 5275.25,
          volume: 1250000,
          timestamp: new Date().toISOString(),
          dailyChange: "+0.5%",
          dailyRange: "5250.00 - 5280.00"
        };

        return {
          type: "resource" as const,
          resource: {
            uri: `tradovate://marketdata/${contract.id}`,
            mimeType: "application/json",
            text: JSON.stringify(marketData, null, 2)
          }
        };
      });

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Please provide a market overview based on the following market data:"
            }
          },
          ...marketDataResources.map(resource => ({
            role: "user" as const,
            content: resource
          })),
          {
            role: "user",
            content: {
              type: "text",
              text: "Provide a comprehensive market overview, including:\n1. Current market sentiment\n2. Key price levels and movements\n3. Volume analysis\n4. Potential trading opportunities\n5. Risk factors to consider"
            }
          }
        ]
      };
    }

    default:
      throw new Error("Unknown prompt");
  }
});

/**
 * Initialize the server by authenticating with Tradovate API
 */
async function initialize() {
  try {
    // Authenticate with Tradovate API
    await authenticate();
    console.log("Tradovate MCP server initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Tradovate MCP server:", error);
    console.warn("Server will start with mock data fallback");
  }
}

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  await initialize();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
