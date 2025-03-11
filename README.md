# tradovate-mcp-server MCP Server

An MCP Server for Tradovate Tools

This is a TypeScript-based MCP server that implements tools for managing Tradovate Contract and Order Positions. It demonstrates core MCP concepts by providing:

- Resources representing contracts and positions with URIs and metadata
- Tools for managing positions, orders, and retrieving market data
- Prompts for analyzing trading data and market conditions

## Features

### Resources
- List and access contracts via `tradovate://contract/` URIs
- List and access positions via `tradovate://position/` URIs
- Each resource has detailed metadata and JSON content

### Tools
- **Contract Management**
  - `get_contract_details` - Get detailed information about a specific contract by symbol
  - `get_market_data` - Get market data (quotes, DOM, charts) for a specific contract

- **Position Management**
  - `list_positions` - List all positions for an account
  - `liquidate_position` - Close an existing position for a specific symbol

- **Order Management**
  - `place_order` - Place a new order (market, limit, stop, stop-limit)
  - `modify_order` - Modify an existing order (price, quantity, stop price)
  - `cancel_order` - Cancel an existing order

- **Account Information**
  - `get_account_summary` - Get account summary information (balance, P&L, margin)

### Prompts
- `analyze_positions` - Analyze current positions and provide insights
- `market_overview` - Get an overview of the current market conditions

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Configuration

This MCP server requires Tradovate API credentials to function. Set the following environment variables:

```bash
# Tradovate API Credentials
export TRADOVATE_USERNAME="your_username"
export TRADOVATE_PASSWORD="your_password"
export TRADOVATE_APP_ID="your_app_id"
export TRADOVATE_DEVICE_ID="your_device_id"
export TRADOVATE_CID="your_cid"
export TRADOVATE_SECRET="your_secret"
```

You can also create a `.env` file in the project root with these variables.

## Installation

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tradovate-mcp-server": {
      "command": "/path/to/tradovate-mcp-server/build/index.js"
    }
  }
}
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

## Tradovate API Integration

This MCP server integrates with the Tradovate API to provide trading functionality. The server will:

1. Authenticate with the Tradovate API on startup
2. Make real API calls for all operations
3. Fall back to mock data if API calls fail

### Key Tradovate API Endpoints Used

- `/auth/accessTokenRequest` - Authenticate and get access token
- `/contract/find` - Find contract details by symbol
- `/contract/list` - List all contracts
- `/position/list` - List all positions
- `/position/find` - Find position by ID
- `/order/placeOrder` - Place a new order
- `/order/modifyOrder` - Modify an existing order
- `/order/cancelOrder` - Cancel an existing order
- `/order/liquidatePosition` - Close an existing position
- `/account/list` - List accounts
- `/account/find` - Find account by ID
- `/cashBalance/getCashBalanceSnapshot` - Get account cash balance
- `/md/getQuote` - Get market data quotes
- `/md/getDOM` - Get depth of market data
- `/md/getChart` - Get chart data
