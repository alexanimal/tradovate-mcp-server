import * as logger from "./logger.js";
import { tradovateRequest } from './auth.js';
import { Contract, Position, Order, Account } from './types.js';

// Data storage for caching API responses
export let contractsCache: { [id: string]: Contract } = {};
export let positionsCache: { [id: string]: Position } = {};
export let ordersCache: { [id: string]: Order } = {};
export let accountsCache: { [id: string]: Account } = {};

/**
 * Fetch contracts from Tradovate API
 */
export async function fetchContracts(): Promise<{ [id: string]: Contract }> {
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
    logger.error('Error fetching contracts:', error);
    // Return cache if available, otherwise empty object
    return contractsCache || {};
  }
}

/**
 * Fetch positions from Tradovate API
 */
export async function fetchPositions(): Promise<{ [id: string]: Position }> {
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
    logger.error('Error fetching positions:', error);
    // Return cache if available, otherwise empty object
    return positionsCache || {};
  }
}

/**
 * Fetch orders from Tradovate API
 */
export async function fetchOrders(): Promise<{ [id: string]: Order }> {
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
    logger.error('Error fetching orders:', error);
    // Return cache if available, otherwise empty object
    return ordersCache || {};
  }
}

/**
 * Fetch accounts from Tradovate API
 */
export async function fetchAccounts(): Promise<{ [id: string]: Account }> {
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
    logger.error('Error fetching accounts:', error);
    // Return cache if available, otherwise empty object
    return accountsCache || {};
  }
}

/**
 * Initialize data by fetching from API
 */
export async function initializeData() {
  try {
    logger.info('Initializing data from Tradovate API...');
    
    // Fetch all data in parallel
    await Promise.all([
      fetchContracts(),
      fetchPositions(),
      fetchOrders(),
      fetchAccounts()
    ]);
    
    logger.info('Data initialization complete');
  } catch (error) {
    logger.error('Error initializing data:', error);
    logger.warn('Using mock data as fallback');
    
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