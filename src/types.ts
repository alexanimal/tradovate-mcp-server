/**
 * Type definitions for Tradovate API entities
 */

/**
 * Contract entity
 */
export interface Contract {
  id: number;
  name: string;
  contractMaturityId: number;
  productId: number;
  productType: string;
  description: string;
  status: string;
}

/**
 * Position entity
 */
export interface Position {
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
}

/**
 * Order entity
 */
export interface Order {
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
}

/**
 * Account entity
 */
export interface Account {
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
} 