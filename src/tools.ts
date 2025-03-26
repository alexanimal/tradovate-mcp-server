import * as logger from "./logger.js";
import { tradovateRequest } from './auth.js';
import { contractsCache, positionsCache, ordersCache, accountsCache, fetchPositions } from './data.js';
import { query } from './connect.js';
import { TradovateSocket } from './socket.js';

/**
 * Handle get_contract_details tool
 */
export async function handleGetContractDetails(request: any) {
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

    return {
      content: [{
        type: "text",
        text: `Contract details for ${symbol}:\n${JSON.stringify(contract, null, 2)}`
      }]
    };
  } catch (error) {
    logger.error(`Error getting contract details for ${symbol}:`, error);
    
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

/**
 * Handle list_positions tool
 */
export async function handleListPositions(request: any) {
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

    return {
      content: [{
        type: "text",
        text: `Positions${accountId ? ` for account ${accountId}` : ''}:\n${JSON.stringify(positions, null, 2)}`
      }]
    };
  } catch (error) {
    // Log error but attempt to retry once more before giving up
    logger.error("Error listing positions, retrying:", error);
    
    try {
      // Retry API call
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

      return {
        content: [{
          type: "text",
          text: `Positions${accountId ? ` for account ${accountId}` : ''}:\n${JSON.stringify(positions, null, 2)}`
        }]
      };
    } catch (retryError) {
      logger.error("Error listing positions after retry:", retryError);
      
      return {
        content: [{
          type: "text",
          text: `Error fetching positions: ${retryError instanceof Error ? retryError.message : String(retryError)}`
        }]
      };
    }
  }
}

/**
 * Handle place_order tool
 */
export async function handlePlaceOrder(request: any) {
  const symbol = String(request.params.arguments?.symbol);
  const action = String(request.params.arguments?.action);
  const orderType = String(request.params.arguments?.orderType);
  const quantity = Number(request.params.arguments?.quantity);
  const price = request.params.arguments?.price ? Number(request.params.arguments.price) : undefined;
  const stopPrice = request.params.arguments?.stopPrice ? Number(request.params.arguments.stopPrice) : undefined;
  logger.info(`Placing order for ${symbol} with action ${action}, orderType ${orderType}, quantity ${quantity}, price ${price}, stopPrice ${stopPrice}`);
  if (!symbol || !action || !orderType || !quantity) {
    throw new Error("Symbol, action, orderType, and quantity are required");
  }

  // Validate order type and required parameters - moved up before any API calls
  if ((orderType === "Limit" || orderType === "StopLimit") && price === undefined) {
    throw new Error("Price is required for Limit and StopLimit orders");
  }

  if ((orderType === "Stop" || orderType === "StopLimit") && stopPrice === undefined) {
    throw new Error("Stop price is required for Stop and StopLimit orders");
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

    // Get account ID
    const accounts = await tradovateRequest('GET', 'account/list');
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found");
    }
    
    const accountId = accounts[0].id; // Use the first account

    // Prepare order data
    const orderData = {
      accountSpec: process.env.TRADOVATE_USERNAME,
      accountId: accountId,
      action,
      symbol,
      orderQty: quantity,
      orderType,
      price,
      stopPrice,
      isAutomated: true
    };

    // Place order via API
    const newOrder = await tradovateRequest('POST', 'order/placeorder', orderData);

    // Update orders cache
    ordersCache[newOrder.id.toString()] = newOrder;

    return {
      content: [{
        type: "text",
        text: `Order placed successfully:\n${JSON.stringify(newOrder, null, 2)}`
      }]
    };
  } catch (error) {
    logger.error("Error placing order:", error);
    
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
      const simulatedOrder = {
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
      logger.error("Error in fallback order placement:", fallbackError);
      return {
        content: [{
          type: "text",
          text: `Failed to place order: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
}

/**
 * Handle modify_order tool
 */
export async function handleModifyOrder(request: any) {
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
    logger.error(`Error modifying order ${orderId}:`, error);
    
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

/**
 * Handle cancel_order tool
 */
export async function handleCancelOrder(request: any) {
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
    /**
     {
        "orderId": 0,
        "clOrdId": "string",
        "activationTime": "2019-08-24T14:15:22Z",
        "customTag50": "string",
        "isAutomated": true
      }
     */
    const body = {
      orderId: parseInt(orderId),
      clOrdId: orderId,
      isAutomated: true
    }

    // Cancel order via API
    const canceledOrder = await tradovateRequest('POST', 'order/cancelorder', body);

    // Update orders cache
    ordersCache[orderId] = canceledOrder;

    return {
      content: [{
        type: "text",
        text: `Order canceled successfully:\n${JSON.stringify(canceledOrder, null, 2)}`
      }]
    };
  } catch (error) {
    logger.error(`Error canceling order ${orderId}:`, error);
    
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

/**
 * Handle liquidate_position tool
 */
export async function handleLiquidatePosition(request: any) {
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
    const position = positions.find((p: any) => p.contractId === contract.id);
    
    if (!position) {
      return {
        content: [{
          type: "text",
          text: `No position found for symbol: ${symbol}`
        }]
      };
    }
    /*
      {
        "accountId": 0,
        "contractId": 0,
        "admin": true,
        "customTag50": "string"
      }
          
    */
    // Liquidate position via API
    const liquidationResult = await tradovateRequest('POST', 'order/liquidateposition', { 
      accountId: position.accountId,
      contractId: position.contractId,
      admin: false,
      customTag50: "MCPserver"
    });

    return {
      content: [{
        type: "text",
        text: `Position liquidated successfully:\n${JSON.stringify(liquidationResult, null, 2)}`
      }]
    };
  } catch (error) {
    logger.error(`Error liquidating position for ${symbol}, retrying:`, error);
    
    // Retry once before giving up
    try {
      // Find contract by symbol (retry)
      const contract = await tradovateRequest('GET', `contract/find?name=${symbol}`);
      
      if (!contract) {
        return {
          content: [{
            type: "text",
            text: `Contract not found for symbol: ${symbol}`
          }]
        };
      }

      // Find position by contract ID (retry)
      const positions = await tradovateRequest('GET', 'position/list');
      const position = positions.find((p: any) => p.contractId === contract.id);
      
      if (!position) {
        return {
          content: [{
            type: "text",
            text: `No position found for symbol: ${symbol}`
          }]
        };
      }

      // Liquidate position via API (retry)
      const liquidationResult = await tradovateRequest('POST', 'order/liquidateposition', { 
        accountId: position.accountId,
        contractId: position.contractId,
        admin: false,
        customTag50: "MCPserver"
      });

      return {
        content: [{
          type: "text",
          text: `Position liquidated successfully:\n${JSON.stringify(liquidationResult, null, 2)}`
        }]
      };
    } catch (retryError) {
      logger.error(`Error liquidating position for ${symbol} after retry:`, retryError);
      
      return {
        content: [{
          type: "text", 
          text: `Failed to liquidate position for ${symbol}: ${retryError instanceof Error ? retryError.message : String(retryError)}`
        }]
      };
    }
  }
}

/**
 * Handle get_account_summary tool
 */
export async function handleGetAccountSummary(request: any) {
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
    const totalRealizedPnl = positions.reduce((sum: number, pos: any) => sum + pos.realizedPnl, 0);
    const totalOpenPnl = positions.reduce((sum: number, pos: any) => sum + pos.openPnl, 0);
    
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
    logger.error("Error getting account summary, retrying:", error);
    
    // Retry the API call once before giving up
    try {
      // Get accounts (retry)
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
  
      // Get cash balance (retry)
      const cashBalance = await tradovateRequest('POST', 'cashBalance/getCashBalanceSnapshot', { accountId: actualAccountId });
      
      // Get positions (retry)
      const positions = await tradovateRequest('GET', `position/list?accountId=${actualAccountId}`);
      
      // Calculate summary
      const totalRealizedPnl = positions.reduce((sum: number, pos: any) => sum + pos.realizedPnl, 0);
      const totalOpenPnl = positions.reduce((sum: number, pos: any) => sum + pos.openPnl, 0);
      
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
    } catch (retryError) {
      logger.error("Error getting account summary after retry:", retryError);
      
      return {
        content: [{
          type: "text",
          text: `Error getting account summary: ${retryError instanceof Error ? retryError.message : String(retryError)}`
        }]
      };
    }
  }
}

/**
 * Handle get_market_data tool
 */
export async function handleGetMarketData(request: any) {
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
    let dataSource = "real-time"; // default source type
    
    // Check if we have the new socket connections available
    if (global.marketDataSocket && global.marketDataSocket.isConnected()) {
      logger.info(`Using market data socket for ${dataType} data on ${symbol}`);
      
      try {
        switch (dataType) {
          case "Quote":
            // Create a promise that will resolve when we get the quote data
            marketData = await new Promise((resolve, reject) => {
              let timeoutId: NodeJS.Timeout;
              
              // Set a timeout to prevent hanging if we don't get a response
              timeoutId = setTimeout(() => {
                reject(new Error('Quote data request timed out'));
              }, 10000);
              
              // Subscribe to quote data
              global.marketDataSocket.subscribe({
                url: 'md/subscribequote',
                body: { symbol },
                subscription: (data) => {
                  clearTimeout(timeoutId);
                  resolve(data);
                  // Note: This would normally keep receiving updates, but we just want the first one
                }
              }).catch(error => {
                clearTimeout(timeoutId);
                reject(error);
              });
            });
            break;
            
          case "DOM":
            // Create a promise that will resolve when we get the DOM data
            marketData = await new Promise((resolve, reject) => {
              let timeoutId: NodeJS.Timeout;
              
              // Set a timeout to prevent hanging if we don't get a response
              timeoutId = setTimeout(() => {
                reject(new Error('DOM data request timed out'));
              }, 10000);
              
              // Subscribe to DOM data
              global.marketDataSocket.subscribe({
                url: 'md/subscribedom',
                body: { symbol },
                subscription: (data) => {
                  clearTimeout(timeoutId);
                  resolve(data);
                  // Note: This would normally keep receiving updates, but we just want the first one
                }
              }).catch(error => {
                clearTimeout(timeoutId);
                reject(error);
              });
            });
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
            
            // Create a promise that will resolve when we get the chart data
            marketData = await new Promise((resolve, reject) => {
              let timeoutId: NodeJS.Timeout;
              
              // Set a timeout to prevent hanging if we don't get a response
              timeoutId = setTimeout(() => {
                reject(new Error('Chart data request timed out'));
              }, 10000);
              
              // Get chart data using the chart subscription
              global.marketDataSocket.subscribe({
                url: 'md/getchart',
                body: { 
                  symbol,
                  chartDescription: `${chartLength}${chartUnits}`,
                  timeRange: 3600 // 1 hour of data
                },
                subscription: (data) => {
                  clearTimeout(timeoutId);
                  resolve(data);
                }
              }).catch(error => {
                clearTimeout(timeoutId);
                reject(error);
              });
            });
            break;
          
          default:
            throw new Error(`Unsupported data type: ${dataType}`);
        }
      } catch (socketError) {
        logger.error(`Error using market data socket for ${dataType} data on ${symbol}:`, socketError);
        logger.info(`Falling back to legacy approach for ${dataType} data on ${symbol}`);
        // Just return the legacy result directly instead of trying to parse it
        return await handleGetMarketDataLegacy(request);
      }
      
      // If we successfully got market data using the socket, return it
      return {
        content: [{
          type: "text",
          text: `Market data for ${symbol} (${dataType}) [${dataSource}]:\n${JSON.stringify(marketData, null, 2)}`
        }]
      };
    } else {
      // Fallback to legacy approach
      logger.warn(`Market data socket not available, using legacy approach for ${dataType} data on ${symbol}`);
      // Just return the legacy result directly
      return await handleGetMarketDataLegacy(request);
    }
  } catch (error) {
    logger.error(`Error getting market data for ${symbol}:`, error);
    return await handleGetMarketDataLegacy(request);
  }
}

/**
 * Legacy implementation of market data handling
 */
async function handleGetMarketDataLegacy(request: any) {
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
        try {
          if (global.tradovateWs && global.tradovateWs.readyState === WebSocket.OPEN) {
            const endpoint = `md/getQuote?contractId=${contract.id}`;
            marketData = await query(global.tradovateWs, endpoint);
            logger.info(`Market Data: ${JSON.stringify(marketData)}`);
          } else {
            throw new Error('Legacy WebSocket not connected');
          }
        } catch (wsError) {
          logger.error(`WebSocket query failed: ${wsError}`);
          logger.info('Falling back to mock data for Quote');
          // Fallback to mock data
          marketData = {
            symbol,
            bid: 5275.25,
            ask: 5275.50,
            last: 5275.25,
            volume: 1250000,
            timestamp: new Date().toISOString()
          };
        }
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
    logger.error(`Error getting market data for ${symbol}:`, error);
    
    // Fallback to mock data
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

/**
 * Handle list_orders tool
 */
export async function handleListOrders(request: any) {
  const accountId = String(request.params.arguments?.accountId || "");
  
  try {
    // Get orders from API
    let endpoint = 'order/list';
    if (accountId) {
      endpoint += `?accountId=${accountId}`;
    }
    
    const orders = await tradovateRequest('GET', endpoint);
    
    if (!orders || orders.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No orders found${accountId ? ` for account ${accountId}` : ''}`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Orders${accountId ? ` for account ${accountId}` : ''}:\n${JSON.stringify(orders, null, 2)}`
      }]
    };
  } catch (error) {
    // Log error but attempt to retry once more before giving up
    logger.error("Error listing orders, retrying:", error);
    
    try {
      // Retry API call
      let endpoint = 'order/list';
      if (accountId) {
        endpoint += `?accountId=${accountId}`;
      }
      
      const orders = await tradovateRequest('GET', endpoint);
      
      if (!orders || orders.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No orders found${accountId ? ` for account ${accountId}` : ''}`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: `Orders${accountId ? ` for account ${accountId}` : ''}:\n${JSON.stringify(orders, null, 2)}`
        }]
      };
    } catch (retryError) {
      logger.error("Error listing orders after retry:", retryError);
      
      // Fallback to cached data
      const cachedOrders = Object.values(ordersCache);
      const filteredOrders = accountId 
        ? cachedOrders.filter(order => order.accountId === parseInt(accountId))
        : cachedOrders;
      
      if (filteredOrders.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No orders found${accountId ? ` for account ${accountId}` : ''} (cached)`
          }]
        };
      }
      
      return {
        content: [{
          type: "text",
          text: `Orders${accountId ? ` for account ${accountId}` : ''} (cached):\n${JSON.stringify(filteredOrders, null, 2)}`
        }]
      };
    }
  }
}

/**
 * Handle list_products tool
 */
export async function handleListProducts(request: any) {
  const contractId = request.params.arguments?.contractId;
  
  try {
    // Fetch products from API
    const productList = await tradovateRequest('GET', 'product/list');
    
    if (!productList || !Array.isArray(productList) || productList.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No products found"
        }]
      };
    }

    // If contractId is provided, filter the list
    if (contractId) {
      const product = productList.find(p => p.id === Number(contractId));
      
      if (!product) {
        return {
          content: [{
            type: "text",
            text: `Product not found with contractId: ${contractId}`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: `Product for contractId ${contractId}:\n${JSON.stringify(product, null, 2)}`
        }]
      };
    }

    // Return the full list
    return {
      content: [{
        type: "text",
        text: `Available products:\n${JSON.stringify(productList, null, 2)}`
      }]
    };
  } catch (error) {
    logger.error("Error fetching products:", error);
    
    return {
      content: [{
        type: "text",
        text: `Error fetching products: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * Handle list_exchanges tool
 */
export async function handleListExchanges(request: any) {
  
  try {
    // Fetch exchanges from API
    const exchangeList = await tradovateRequest('GET', 'exchange/list');
    
    if (!exchangeList || !Array.isArray(exchangeList) || exchangeList.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No exchanges found"
        }]
      };
    }

    // Return the full list
    return {
      content: [{
        type: "text",
        text: `Available exchanges:\n${JSON.stringify(exchangeList, null, 2)}`
      }]
    };
  } catch (error) {
    logger.error("Error fetching exchanges:", error);
    
    return {
      content: [{
        type: "text",
        text: `Error fetching exchanges: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * Handle find_product tool
 */
export async function handleFindProduct(request: any) {
  const name = String(request.params.arguments?.name);
  
  if (!name) {
    throw new Error("Product name is required");
  }
  
  try {
    // Find product by name
    const product = await tradovateRequest('GET', `product/find?name=${name}`);
    
    if (!product) {
      return {
        content: [{
          type: "text",
          text: `Product not found with name: ${name}`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: `Product details for ${name}:\n${JSON.stringify(product, null, 2)}`
      }]
    };
  } catch (error) {
    logger.error(`Error finding product with name ${name}:`, error);
    
    return {
      content: [{
        type: "text",
        text: `Error finding product: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
} 