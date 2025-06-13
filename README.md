# 🔍 Ethereum Wallet Analyzer

A professional-grade web application for analyzing Ethereum wallets and detecting specific ERC-20 tokens. Built with a secure backend architecture and modern frontend for comprehensive blockchain portfolio analysis.

![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🌟 Features

### 🎯 **Core Functionality**
- **Multi-Wallet Analysis**: Analyze up to 50 Ethereum wallets simultaneously
- **Token Detection**: Search for up to 20 ERC-20 tokens per analysis
- **Smart Categorization**: Automatically groups wallets into ALL/SOME/NO token categories
- **Real-time Processing**: Live progress tracking with detailed logging

### 🔍 **Advanced Token Recognition**
- **Local Database**: 50+ pre-configured popular tokens (USDT, USDC, SHIB, etc.)
- **Contract Calls**: Direct blockchain queries for token metadata
- **Multi-Source Integration**: CoinGecko and DexScreener API fallbacks
- **Automatic Decimals**: Proper token amount formatting

### 🛡️ **Security & Performance**
- **Secure Backend**: Environment-based API key management
- **Rate Limiting**: Intelligent delays to respect API limits
- **Error Handling**: Comprehensive retry logic with exponential backoff
- **Input Validation**: Client and server-side address validation

### 🎨 **Professional UI**
- **Dark Mode**: Beautiful, responsive dark theme interface
- **Real-time Feedback**: Progress bars, status indicators, and debugging console
- **Export Capabilities**: JSON export and sharing functionality
- **Mobile Responsive**: Optimized for all device sizes

## 🏗️ Architecture

```
ethereum-wallet-analyzer/
├── 📁 config/              # Configuration management
│   └── constants.js         # Centralized app configuration
├── 📁 routes/              # API route handlers
│   └── api.js              # Main API endpoints
├── 📁 services/            # External service integrations
│   └── etherscan.js        # Blockchain API service
├── 📁 utils/               # Utility functions
│   ├── helpers.js          # Common helper functions
│   └── debugger.js         # Advanced logging system
├── 📁 public/              # Frontend assets
│   ├── 📁 css/
│   │   └── styles.css      # Professional styling
│   ├── 📁 js/
│   │   ├── api.js          # Frontend API layer
│   │   ├── ui.js           # User interface management
│   │   └── main.js         # Main application logic
│   └── index.html          # Main HTML interface
├── server.js               # Express server entry point
├── package.json            # Dependencies and scripts
├── .env.example            # Environment variables template
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** ([Download](https://nodejs.org/))
- **Etherscan API Key** ([Get Free Key](https://etherscan.io/apis))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ethereum-wallet-analyzer.git
   cd ethereum-wallet-analyzer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Etherscan API key:
   ```env
   ETHERSCAN_API_KEY=B6PZNG4AR5476MWN7MDIRZC6B1JUFI9KW5
   NODE_ENV=development
   PORT=10000
   ```

4. **Start the application**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Open in browser**
   Navigate to `http://localhost:10000`

## 🎯 Usage Guide

### Basic Analysis

1. **Input Wallet Addresses** (left textarea)
   - Enter Ethereum wallet addresses, one per line
   - Format: `0x742d35Cc6634C0532925a3b8D2645Ff9b5B4b6bE`
   - Maximum: 50 wallets per analysis

2. **Input Token Addresses** (right textarea)
   - Enter ERC-20 token contract addresses, one per line
   - Format: `0xdAC17F958D2ee523a2206206994597C13D831ec7` (USDT)
   - Maximum: 20 tokens per analysis

3. **Validate (Optional)**
   - Click "Validate Addresses" to check formatting
   - Review any invalid addresses before proceeding

4. **Analyze**
   - Click "Analyze Wallets" to start blockchain analysis
   - Monitor real-time progress in the debug console
   - Analysis typically takes 1-3 minutes depending on size

### Results Interpretation

Results are automatically categorized into three groups:

- **🎯 ALL Tokens**: Wallets containing ALL specified tokens
- **⚡ SOME Tokens**: Wallets containing SOME specified tokens  
- **❌ NO Tokens**: Wallets containing NONE of the specified tokens

Each result shows:
- Wallet address with copy-to-clipboard functionality
- Token symbols, names, and balances
- Token contract addresses
- Analysis status and any errors

### Advanced Features

#### Keyboard Shortcuts
- `Ctrl/Cmd + Enter`: Start analysis
- `Ctrl/Cmd + K`: Clear all inputs
- `Ctrl/Cmd + Shift + V`: Advanced validation
- `Escape`: Cancel analysis or close modals

#### Export & Sharing
- **Export Results**: Download analysis as JSON file
- **Share Analysis**: Generate shareable link with results summary

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ETHERSCAN_API_KEY` | Etherscan API key | - | ✅ |
| `PORT` | Server port | 10000 | ❌ |
| `NODE_ENV` | Environment | development | ❌ |
| `LOG_LEVEL` | Logging level (0-4) | INFO | ❌ |
| `ETHERSCAN_DELAY` | API call delay (ms) | 200 | ❌ |
| `TOKEN_DELAY` | Token check delay (ms) | 300 | ❌ |
| `WALLET_DELAY` | Wallet analysis delay (ms) | 800 | ❌ |
| `MAX_RETRIES` | Max retry attempts | 3 | ❌ |

### Rate Limiting

The application implements intelligent rate limiting to respect Etherscan API limits:

- **Etherscan Delay**: 200ms between API calls
- **Token Delay**: 300ms between token balance checks
- **Wallet Delay**: 800ms between wallet analyses
- **Retry Logic**: Exponential backoff for failed requests

## 🌐 Deployment

### Render Deployment (Recommended)

1. **Connect GitHub Repository**
   - Fork this repository
   - Connect your Render account to GitHub

2. **Create New Web Service**
   - Select your forked repository
   - Choose "Node" environment
   - Set build command: `npm install`
   - Set start command: `npm start`

3. **Configure Environment Variables**
   ```
   ETHERSCAN_API_KEY=B6PZNG4AR5476MWN7MDIRZC6B1JUFI9KW5
   NODE_ENV=production
   CORS_ORIGINS=https://your-app.onrender.com
   ```

4. **Deploy**
   - Render will automatically build and deploy
   - Your app will be available at `https://your-app.onrender.com`

### Local Development

```bash
# Install dependencies
npm install

# Start development server (auto-reload)
npm run dev

# Start production server
npm start
```

## 🛠️ Development

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Analyze wallets for tokens |
| `POST` | `/api/validate-addresses` | Validate Ethereum addresses |
| `GET` | `/api/token-info/:address` | Get token information |
| `GET` | `/api/health` | API health check |
| `GET` | `/health` | Service health check |

### Adding New Features

1. **New API Integration**
   - Add service in `services/` directory
   - Update configuration in `config/constants.js`
   - Add error handling and logging

2. **UI Enhancements**
   - Modify `public/js/ui.js` for interface changes
   - Update `public/css/styles.css` for styling
   - Maintain responsive design principles

## 🔍 Troubleshooting

### Common Issues

**API Key Errors**
```
Error: Invalid API key
```
- Verify your Etherscan API key in `.env`
- Ensure no spaces or quotes around the key
- Check API key permissions on Etherscan

**Rate Limit Errors**
```
Error: Rate limit exceeded
```
- Default delays should prevent this
- Increase delays in environment variables if needed
- Wait 5 minutes before retrying

**Network Errors**
```
Error: Network error, please try again
```
- Check internet connection
- Verify Etherscan API is accessible
- Check firewall settings

**Invalid Address Errors**
```
Error: Invalid Ethereum address format
```
- Ensure addresses start with `0x`
- Verify addresses are exactly 42 characters
- Use the validation feature before analysis

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Etherscan**: For providing reliable blockchain API
- **CoinGecko**: For comprehensive token data
- **DexScreener**: For DeFi token information
- **Express.js**: For robust web framework
- **Node.js**: For powerful backend runtime

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/ethereum-wallet-analyzer/issues)
- **Documentation**: This README and inline code comments
- **API Reference**: Visit `/api/health` for endpoint documentation

---

**Made with ❤️ by the Ethereum Wallet Analyzer Team**

*Professional blockchain analysis made simple and accessible.*
