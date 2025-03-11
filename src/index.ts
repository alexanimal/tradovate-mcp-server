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
 * Data storage for caching API responses
 * This helps reduce API calls and provides fallback when API is unavailable
 */
let contractsCache: { [id: string]: Contract } = {};
let positionsCache: { [id: string]: Position } = {};
let ordersCache: { [id: string]: Order } = {};
let accountsCache: { [id: string]: Account } = {};

/**
 * Fetch contracts from Tradovate API
 */
async function fetchContracts(): Promise<{ [id: string]: Contract }> {
  try {
    // Get all contracts
    const contractsList = await tradovateRequest('GET', 'contract/list');
    
    // Convert array to object with id as key
    const contractsMap: { [id: string]: Contract } = {};
    contractsList.forEach((contract: Contract) => {
      contractsMap[contract.id.toString()] = contract;
    });
    
    // Update cache
    contractsCache = contractsMap;
    return contractsMap;
  } catch (error) {
    console.error('Error fetching contracts:', error);
    // Return cache if available, otherwise empty object
    return contractsCache || {};
  }
}

/**
 * Fetch positions from Tradovate API
 */
async function fetchPositions(): Promise<{ [id: string]: Position }> {
  try {
    // Get all positions
    const positionsList = await tradovateRequest('GET', 'position/list');
    
    // Convert array to object with id as key
    const positionsMap: { [id: string]: Position } = {};
    positionsList.forEach((position: Position) => {
      positionsMap[position.id.toString()] = position;
    });
    
    // Update cache
    positionsCache = positionsMap;
    return positionsMap;
  } catch (error) {
    console.error('Error fetching positions:', error);
    // Return cache if available, otherwise empty object
    return positionsCache || {};
  }
}

/**
 * Fetch orders from Tradovate API
 */
async function fetchOrders(): Promise<{ [id: string]: Order }> {
  try {
    // Get all orders
    const ordersList = await tradovateRequest('GET', 'order/list');
    
    // Convert array to object with id as key
    const ordersMap: { [id: string]: Order } = {};
    ordersList.forEach((order: Order) => {
      ordersMap[order.id.toString()] = order;
    });
    
    // Update cache
    ordersCache = ordersMap;
    return ordersMap;
  } catch (error) {
    console.error('Error fetching orders:', error);
    // Return cache if available, otherwise empty object
    return ordersCache || {};
  }
}

/**
 * Fetch accounts from Tradovate API
 */
async function fetchAccounts(): Promise<{ [id: string]: Account }> {
  try {
    // Get all accounts
    const accountsList = await tradovateRequest('GET', 'account/list');
    
    // Convert array to object with id as key
    const accountsMap: { [id: string]: Account } = {};
    accountsList.forEach((account: Account) => {
      accountsMap[account.id.toString()] = account;
    });
    
    // Update cache
    accountsCache = accountsMap;
    return accountsMap;
  } catch (error) {
    console.error('Error fetching accounts:', error);
    // Return cache if available, otherwise empty object
    return accountsCache || {};
  }
}

/**
 * Initialize data by fetching from API
 */
async function initializeData() {
  try {
    console.log('Initializing data from Tradovate API...');
    
    // Fetch all data in parallel
    await Promise.all([
      fetchContracts(),
      fetchPositions(),
      fetchOrders(),
      fetchAccounts()
    ]);
    
    console.log('Data initialization complete');
  } catch (error) {
    console.error('Error initializing data:', error);
    console.warn('Using mock data as fallback');
    
    // Use mock data as fallback
    if (Object.keys(contractsCache).length === 0) {
      contractsCache = {
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
    }
    
    if (Object.keys(positionsCache).length === 0) {
      positionsCache = {
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
    }
    
    if (Object.keys(ordersCache).length === 0) {
      ordersCache = {
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
    }
    
    if (Object.keys(accountsCache).length === 0) {
      accountsCache = {
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
    }
  }
}

/**
 * Tradovate API configuration
 * Uses environment variables for all configuration settings
 */
const API_ENVIRONMENT = process.env.TRADOVATE_API_ENVIRONMENT || 'demo';
const API_URLS = {
  demo: 'https://demo.tradovateapi.com/v1',
  live: 'https://live.tradovateapi.com/v1',
  md_demo: 'https://md-demo.tradovateapi.com/v1',
  md_live: 'https://md-live.tradovateapi.com/v1'
};

const TRADOVATE_API_URL = API_URLS[API_ENVIRONMENT as keyof typeof API_URLS] || API_URLS.demo;
const TRADOVATE_MD_API_URL = API_ENVIRONMENT.includes('live') ? API_URLS.md_live : API_URLS.md_demo;

// Authentication state
let accessToken: string | null = null;
let accessTokenExpiry: number | null = null;
let refreshToken: string | null = null;

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

// Load credentials from environment variables
const credentials: TradovateCredentials = {
  name: process.env.TRADOVATE_USERNAME || '',
  password: process.env.TRADOVATE_PASSWORD || '',
  appId: process.env.TRADOVATE_APP_ID || '',
  appVersion: process.env.TRADOVATE_APP_VERSION || '1.0.0',
  deviceId: process.env.TRADOVATE_DEVICE_ID || '',
  cid: process.env.TRADOVATE_CID || '',
  sec: process.env.TRADOVATE_SECRET || ''
};

/**
 * Check if the current access token is valid
 */
function isAccessTokenValid(): boolean {
  if (!accessToken || !accessTokenExpiry) return false;
  
  // Consider token expired 5 minutes before actual expiry
  const currentTime = Date.now();
  const expiryWithBuffer = accessTokenExpiry - (5 * 60 * 1000);
  
  return currentTime < expiryWithBuffer;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(): Promise<string> {
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  try {
    const response = await axios.post(`${TRADOVATE_API_URL}/auth/renewAccessToken`, { 
      name: credentials.name,
      refreshToken 
    });
    
    if (response.data && response.data.accessToken) {
      accessToken = response.data.accessToken;
      
      // Set expiry time (default to 24 hours if not provided)
      if (response.data.expirationTime) {
        accessTokenExpiry = response.data.expirationTime;
      } else {
        accessTokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
      }
      
      console.log('Successfully refreshed access token');
      return response.data.accessToken;
    } else {
      throw new Error('Token refresh response did not contain an access token');
    }
  } catch (error) {
    console.error('Failed to refresh access token:', error);
    // Clear tokens to force a full re-authentication
    accessToken = null;
    accessTokenExpiry = null;
    refreshToken = null;
    throw new Error('Failed to refresh access token');
  }
}

/**
 * Authenticate with Tradovate API and get access token
 */
async function authenticate(): Promise<string> {
  // If we have a valid token, return it
  if (isAccessTokenValid() && accessToken) {
    return accessToken;
  }
  
  // If we have a refresh token, try to use it
  if (refreshToken) {
    try {
      return await refreshAccessToken();
    } catch (error) {
      console.warn('Failed to refresh token, will attempt full authentication');
      // Continue with full authentication
    }
  }
  
  // Perform full authentication
  try {
    // Validate required credentials
    if (!credentials.name || !credentials.password || !credentials.appId || 
        !credentials.deviceId || !credentials.cid || !credentials.sec) {
      throw new Error('Missing required Tradovate API credentials');
    }
    
    const response = await axios.post(`${TRADOVATE_API_URL}/auth/accessTokenRequest`, credentials);
    
    if (response.data && response.data.accessToken) {
      accessToken = response.data.accessToken;
      
      // Store refresh token if provided
      if (response.data.refreshToken) {
        refreshToken = response.data.refreshToken;
      }
      
      // Set expiry time (default to 24 hours if not provided)
      if (response.data.expirationTime) {
        accessTokenExpiry = response.data.expirationTime;
      } else {
        accessTokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
      }
      
      console.log('Successfully authenticated with Tradovate API');
      return response.data.accessToken;
    } else {
      throw new Error('Authentication response did not contain an access token');
    }
  } catch (error) {
    console.error('Failed to authenticate with Tradovate API:', error);
    throw new Error('Authentication with Tradovate API failed');
  }
}

/**
 * Make an authenticated request to the Tradovate API
 */
async function tradovateRequest(method: string, endpoint: string, data?: any, isMarketData: boolean = false): Promise<any> {
  const token = await authenticate();
  const baseUrl = isMarketData ? TRADOVATE_MD_API_URL : TRADOVATE_API_URL;
  
  try {
    const response = await axios({
      method,
      url: `${baseUrl}/${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data
    });
    
    return response.data;
  } catch (error: any) {
    // Handle specific API errors
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      // Handle authentication errors
      if (status === 401) {
        // Clear tokens to force re-authentication on next request
        accessToken = null;
        accessTokenExpiry = null;
        
        throw new Error('Authentication failed: ' + (errorData.errorText || 'Unauthorized'));
      }
      
      // Handle rate limiting
      if (status === 429) {
        console.warn('Rate limit exceeded, retrying after delay');
        // Wait for 2 seconds and retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        return tradovateRequest(method, endpoint, data, isMarketData);
      }
      
      // Handle other API errors
      throw new Error(`Tradovate API error (${status}): ${errorData.errorText || 'Unknown error'}`);
    }
    
    // Handle network errors
    console.error(`Error making request to ${endpoint}:`, error);
    throw new Error(`Tradovate API request to ${endpoint} failed: ${error.message}`);
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
    // Get contracts and positions from cache or API
    const contracts = await fetchContracts();
    const positions = await fetchPositions();
    
    // Create resources for contracts
    const contractResources = Object.entries(contracts).map(([id, contract]) => ({
      uri: `tradovate://contract/${id}`,
      mimeType: "application/json",
      name: contract.name,
      description: `${contract.description} (${contract.productType})`
    }));

    // Create resources for positions
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
  } catch (error) {
    console.error("Error fetching resources:", error);
    // Fallback to cached data
    const contractResources = Object.entries(contractsCache).map(([id, contract]) => ({
      uri: `tradovate://contract/${id}`,
      mimeType: "application/json",
      name: contract.name,
      description: `${contract.description} (${contract.productType})`
    }));

    const positionResources = Object.entries(positionsCache).map(([id, position]) => {
      const contract = contractsCache[position.contractId.toString()];
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
        // Get contract by ID
        content = await tradovateRequest('GET', `contract/find?id=${id}`);
        if (!content) {
          throw new Error(`Contract ${id} not found`);
        }
        break;
        
      case "position":
        // Get position by ID
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
    
    // Fallback to cached data
    let cachedContent: any;
    
    switch (resourceType) {
      case "contract":
        cachedContent = contractsCache[id];
        if (!cachedContent) {
          throw new Error(`Contract ${id} not found`);
        }
        break;
        
      case "position":
        cachedContent = positionsCache[id];
        if (!cachedContent) {
          throw new Error(`Position ${id} not found`);
        }
        
        // Enrich position data with contract information
        const cachedContract = contractsCache[cachedContent.contractId.toString()];
        cachedContent = {
          ...cachedContent,
          contractName: cachedContract?.name || "Unknown",
          contractDescription: cachedContract?.description || "Unknown"
        };
        break;
        
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
    
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(cachedContent, null, 2)
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
        
        // Fallback to cached data
        const cachedContract = Object.values(contractsCache).find(c => c.name === symbol);
        
        if (!cachedContract) {
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
            text: `Contract details for ${symbol} (cached):\n${JSON.stringify(cachedContract, null, 2)}`
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
        
        // Fallback to cached data
        let cachedPositions = Object.values(positionsCache);
        
        // Filter by account ID if provided
        if (accountId) {
          cachedPositions = cachedPositions.filter(p => p.accountId.toString() === accountId);
        }
        
        if (cachedPositions.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No positions found${accountId ? ` for account ${accountId}` : ''} (cached)`
            }]
          };
        }

        // Enrich positions with contract information
        const enrichedPositions = cachedPositions.map(position => {
          const contract = contractsCache[position.contractId.toString()];
          return {
            ...position,
            contractName: contract?.name || "Unknown",
            contractDescription: contract?.description || "Unknown"
          };
        });

        return {
          content: [{
            type: "text",
            text: `Positions${accountId ? ` for account ${accountId}` : ''} (cached):\n${JSON.stringify(enrichedPositions, null, 2)}`
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

        // Update orders cache
        ordersCache[newOrder.id.toString()] = newOrder;

        return {
          content: [{
            type: "text",
            text: `Order placed successfully:\n${JSON.stringify(newOrder, null, 2)}`
          }]
        };
      } catch (error) {
        console.error("Error placing order:", error);
        
        // Fallback to cached data for simulation
        try {
          // Find contract by symbol
          const cachedContract = Object.values(contractsCache).find(c => c.name === symbol);
          
          if (!cachedContract) {
            return {
              content: [{
                type: "text",
                text: `Contract not found for symbol: ${symbol}`
              }]
            };
          }

          // Get first account from cache
          const cachedAccount = Object.values(accountsCache)[0];
          if (!cachedAccount) {
            return {
              content: [{
                type: "text",
                text: `No accounts found in cache`
              }]
            };
          }

          // Create simulated order
          const newOrderId = String(Object.keys(ordersCache).length + 1);
          const simulatedOrder: Order = {
            id: parseInt(newOrderId),
            accountId: cachedAccount.id,
            contractId: cachedContract.id,
            timestamp: new Date().toISOString(),
            action,
            ordStatus: "Working",
            orderQty: quantity,
            orderType,
            price,
            stopPrice
          };

          // Add to cache
          ordersCache[newOrderId] = simulatedOrder;

          return {
            content: [{
              type: "text",
              text: `Order placed successfully (simulated):\n${JSON.stringify(simulatedOrder, null, 2)}`
            }]
          };
        } catch (fallbackError) {
          console.error("Error in fallback order placement:", fallbackError);
          return {
            content: [{
              type: "text",
              text: `Failed to place order: ${error instanceof Error ? error.message : String(error)}`
            }]
          };
        }
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

        // Update orders cache
        ordersCache[orderId] = updatedOrder;

        return {
          content: [{
            type: "text",
            text: `Order modified successfully:\n${JSON.stringify(updatedOrder, null, 2)}`
          }]
        };
      } catch (error) {
        console.error(`Error modifying order ${orderId}:`, error);
        
        // Fallback to cached data for simulation
        const cachedOrder = ordersCache[orderId];
        
        if (!cachedOrder) {
          return {
            content: [{
              type: "text",
              text: `Order not found with ID: ${orderId}`
            }]
          };
        }

        // Update order in cache
        if (price !== undefined) cachedOrder.price = price;
        if (stopPrice !== undefined) cachedOrder.stopPrice = stopPrice;
        if (quantity !== undefined) cachedOrder.orderQty = quantity;

        return {
          content: [{
            type: "text",
            text: `Order modified successfully (simulated):\n${JSON.stringify(cachedOrder, null, 2)}`
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

        // Update orders cache
        ordersCache[orderId] = canceledOrder;

        return {
          content: [{
            type: "text",
            text: `Order canceled successfully:\n${JSON.stringify(canceledOrder, null, 2)}`
          }]
        };
      } catch (error) {
        console.error(`Error canceling order ${orderId}:`, error);
        
        // Fallback to cached data for simulation
        const cachedOrder = ordersCache[orderId];
        
        if (!cachedOrder) {
          return {
            content: [{
              type: "text",
              text: `Order not found with ID: ${orderId}`
            }]
          };
        }

        // Update order status in cache
        cachedOrder.ordStatus = "Canceled";

        return {
          content: [{
            type: "text",
            text: `Order canceled successfully (simulated):\n${JSON.stringify(cachedOrder, null, 2)}`
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

        // Refresh positions cache
        await fetchPositions();

        return {
          content: [{
            type: "text",
            text: `Position liquidated successfully:\n${JSON.stringify(liquidationResult, null, 2)}`
          }]
        };
      } catch (error) {
        console.error(`Error liquidating position for ${symbol}:`, error);
        
        // Fallback to cached data for simulation
        const cachedContract = Object.values(contractsCache).find(c => c.name === symbol);
        
        if (!cachedContract) {
          return {
            content: [{
              type: "text",
              text: `Contract not found for symbol: ${symbol}`
            }]
          };
        }

        // Find position by contract ID
        const cachedPosition = Object.values(positionsCache).find(p => p.contractId === cachedContract.id);
        
        if (!cachedPosition) {
          return {
            content: [{
              type: "text",
              text: `No position found for symbol: ${symbol}`
            }]
          };
        }

        // Create simulated liquidation order
        const newOrderId = String(Object.keys(ordersCache).length + 1);
        const action = cachedPosition.netPos > 0 ? "Sell" : "Buy";
        const simulatedOrder: Order = {
          id: parseInt(newOrderId),
          accountId: cachedPosition.accountId,
          contractId: cachedPosition.contractId,
          timestamp: new Date().toISOString(),
          action,
          ordStatus: "Working",
          orderQty: Math.abs(cachedPosition.netPos),
          orderType: "Market"
        };

        // Add to orders cache
        ordersCache[newOrderId] = simulatedOrder;

        // Update position in cache
        const realizedPnl = cachedPosition.openPnl;
        cachedPosition.netPos = 0;
        cachedPosition.realizedPnl += realizedPnl;
        cachedPosition.openPnl = 0;

        return {
          content: [{
            type: "text",
            text: `Position liquidated successfully (simulated):\n${JSON.stringify(cachedPosition, null, 2)}\nLiquidation order:\n${JSON.stringify(simulatedOrder, null, 2)}`
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
        
        // Fallback to cached data for simulation
        let cachedAccount;
        
        if (accountId) {
          cachedAccount = accountsCache[accountId];
          if (!cachedAccount) {
            return {
              content: [{
                type: "text",
                text: `Account not found with ID: ${accountId}`
              }]
            };
          }
        } else {
          const cachedAccounts = Object.values(accountsCache);
          if (cachedAccounts.length === 0) {
            return {
              content: [{
                type: "text",
                text: `No accounts found in cache`
              }]
            };
          }
          cachedAccount = cachedAccounts[0];
        }

        // Calculate account summary using cached data
        const cachedPositions = Object.values(positionsCache).filter(p => p.accountId === cachedAccount.id);
        const totalRealizedPnl = cachedPositions.reduce((sum, pos) => sum + pos.realizedPnl, 0);
        const totalOpenPnl = cachedPositions.reduce((sum, pos) => sum + pos.openPnl, 0);
        
        // Create simulated cash balance
        const simulatedBalance = 100000 + totalRealizedPnl; // Mock initial balance
        const simulatedMargin = 10000; // Mock margin
        
        const summary = {
          account: cachedAccount,
          balance: simulatedBalance,
          openPnl: totalOpenPnl,
          totalEquity: simulatedBalance + totalOpenPnl,
          marginUsed: simulatedMargin,
          availableMargin: simulatedBalance - simulatedMargin + totalOpenPnl,
          positionCount: cachedPositions.length
        };

        return {
          content: [{
            type: "text",
            text: `Account summary for ${cachedAccount.name} (simulated):\n${JSON.stringify(summary, null, 2)}`
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

        let marketData: any;
        
        switch (dataType) {
          case "Quote":
            // Get quote data using market data API
            marketData = await tradovateRequest('GET', `md/getQuote?contractId=${contract.id}`, undefined, true);
            break;
          
          case "DOM":
            // Get DOM data using market data API
            marketData = await tradovateRequest('GET', `md/getDOM?contractId=${contract.id}`, undefined, true);
            break;
          
          case "Chart":
            // Convert timeframe to chart parameters
            let chartUnits;
            let chartLength;
            
            switch (chartTimeframe) {
              case "1min": chartUnits = "m"; chartLength = 1; break;
              case "5min": chartUnits = "m"; chartLength = 5; break;
              case "15min": chartUnits = "m"; chartLength = 15; break;
              case "30min": chartUnits = "m"; chartLength = 30; break;
              case "1hour": chartUnits = "h"; chartLength = 1; break;
              case "4hour": chartUnits = "h"; chartLength = 4; break;
              case "1day": chartUnits = "d"; chartLength = 1; break;
              default: chartUnits = "m"; chartLength = 1;
            }
            
            // Get chart data using market data API
            marketData = await tradovateRequest(
              'GET', 
              `md/getChart?contractId=${contract.id}&chartDescription=${chartLength}${chartUnits}&timeRange=3600`, 
              undefined, 
              true
            );
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
      } catch (error) {
        console.error(`Error getting market data for ${symbol}:`, error);
        // Fallback to mock data if API call fails
        const mockContract = Object.values(contractsCache).find(c => c.name === symbol);
        
        if (!mockContract) {
          return {
            content: [{
              type: "text",
              text: `Contract not found for symbol: ${symbol}`
            }]
          };
        }

        let mockMarketData: any;
        
        switch (dataType) {
          case "Quote":
            mockMarketData = {
              symbol,
              bid: 5275.25,
              ask: 5275.50,
              last: 5275.25,
              volume: 1250000,
              timestamp: new Date().toISOString()
            };
            break;
          
          case "DOM":
            mockMarketData = {
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
            
            mockMarketData = {
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
            text: `Market data for ${symbol} (${dataType}) [MOCK DATA]:\n${JSON.stringify(mockMarketData, null, 2)}`
          }]
        };
      }
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
      const allPositions = Object.values(positionsCache);
      
      // Enrich positions with contract information
      const enrichedPositions = allPositions.map(position => {
        const contract = contractsCache[position.contractId.toString()];
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
      const marketDataResources = Object.values(contractsCache).map(contract => {
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
    
    // Initialize data
    await initializeData();
    
    // Set up periodic data refresh (every 5 minutes)
    setInterval(async () => {
      try {
        await initializeData();
      } catch (error) {
        console.error("Error refreshing data:", error);
      }
    }, 5 * 60 * 1000);
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
