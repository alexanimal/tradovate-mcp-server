# Tradovate MCP Server

[![smithery badge](https://smithery.ai/badge/@alexanimal/tradovate-mcp-server)](https://smithery.ai/server/@alexanimal/tradovate-mcp-server)

[![codecov](https://codecov.io/gh/alexanimal/tradovate-mcp-server/branch/main/graph/badge.svg)](https://codecov.io/gh/alexanimal/tradovate-mcp-server)

A Model Context Protocol (MCP) server for interacting with the Tradovate API. This server provides tools for managing contracts, positions, orders, and accounts in Tradovate.

## Features

- Authentication with Tradovate API
- Real-time data fetching with caching
- Tools for contract details, position management, order placement, and more
- Fallback to simulated data when API is unavailable

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with your Tradovate credentials:

```bash
TRADOVATE_API_ENVIRONMENT=demo
TRADOVATE_USERNAME=your_username
TRADOVATE_PASSWORD=your_password
TRADOVATE_APP_ID=Sample App
TRADOVATE_APP_VERSION=1.0
TRADOVATE_CID=your_cid
TRADOVATE_SEC=your_sec
```

## Usage

Start the server:

```bash
npm start
```

Or use with the MCP Inspector:

```bash
npm run inspector
```

## Development

### Project Structure

- `src/index.ts` - Main server entry point
- `src/auth.ts` - Authentication functions
- `src/data.ts` - Data fetching and caching
- `src/tools.ts` - Tool handlers for MCP
- `src/types.ts` - TypeScript type definitions
- `tests/` - Test files

### Building

```bash
npm run build
```

### Testing

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

Generate coverage badge:

```bash
npm run coverage:badge
```

## Available Tools

The server provides the following tools:

1. `get_contract_details` - Get details for a specific contract by symbol
2. `list_positions` - List positions for an account
3. `place_order` - Place a new order
4. `modify_order` - Modify an existing order
5. `cancel_order` - Cancel an existing order
6. `liquidate_position` - Liquidate a position
7. `get_account_summary` - Get account summary information
8. `get_market_data` - Get market data (quotes, DOM, charts)

## API Endpoints

The server interacts with the following Tradovate API endpoints:

### Authentication

- `/auth/accessTokenRequest` - Get access token
- `/auth/renewAccessToken` - Renew access token

### Contracts

- `/contract/list` - List all contracts
- `/contract/find` - Find a specific contract

### Positions

- `/position/list` - List all positions

### Orders

- `/order/list` - List all orders
- `/order/placeOrder` - Place a new order
- `/order/modifyOrder` - Modify an existing order
- `/order/cancelOrder` - Cancel an existing order
- `/order/liquidatePosition` - Liquidate a position

### Accounts

- `/account/list` - List all accounts
- `/account/find` - Find a specific account
- `/cashBalance/getCashBalanceSnapshot` - Get cash balance for an account

### Market Data

- `/md/getQuote` - Get quote data
- `/md/getDOM` - Get depth of market data
- `/md/getChart` - Get chart data

## License

Private
