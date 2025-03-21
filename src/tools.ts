import * as logger from "./logger.js";
import { tradovateRequest } from './auth.js';
import { contractsCache, positionsCache, ordersCache, accountsCache, fetchPositions } from './data.js';

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