/**
 * Application Configuration
 * Secure configuration management with environment variables
 * Now supports multi-chain analysis (Ethereum, Base)
 */

// Environment validation
if (!process.env.ETHERSCAN_API_KEY) {
  console.error('❌ ERROR: ETHERSCAN_API_KEY environment variable is required');
  process.exit(1);
}

// Network configurations - supports multiple blockchains
const NETWORK_CONFIG = {
  ethereum: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    apiUrl: 'https://api.etherscan.io/api',
    apiKey: process.env.ETHERSCAN_API_KEY,
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    icon: '🔷'
  },
  base: {
    name: 'Base Mainnet',
    chainId: 8453,
    apiUrl: 'https://api.basescan.org/api',
    apiKey: process.env.BASESCAN_API_KEY || process.env.ETHERSCAN_API_KEY, // Fallback to Etherscan key
    explorerUrl: 'https://basescan.org',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    icon: '🔵'
  }
};

// Legacy API configuration for backward compatibility
const API_CONFIG = {
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY,
  ETHERSCAN_API: NETWORK_CONFIG.ethereum.apiUrl,
  BASESCAN_API_KEY: process.env.BASESCAN_API_KEY || process.env.ETHERSCAN_API_KEY,
  BASESCAN_API: NETWORK_CONFIG.base.apiUrl,
  COINGECKO_API: 'https://api.coingecko.com/api/v3',
  DEXSCREENER_API: 'https://api.dexscreener.com/latest',
  
  // Rate limiting settings
  RATE_LIMITS: {
    ETHERSCAN_DELAY: parseInt(process.env.ETHERSCAN_DELAY) || 200, // ms between API calls
    TOKEN_DELAY: parseInt(process.env.TOKEN_DELAY) || 300,         // ms between token checks
    WALLET_DELAY: parseInt(process.env.WALLET_DELAY) || 800,       // ms between wallet analysis
    MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3            // max retry attempts
  }
};

// Network-specific token databases
const ETHEREUM_TOKENS = {
  // Stablecoins
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  '0xa0b86a33e6441466f4f0c9bb6eb6a5e40f3df8ab': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  '0x6b175474e89094c44da98b954eedeeac495271d0f': { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
  '0x4fabb145d64652a948d72533023f6e7a623c7c53': { symbol: 'BUSD', name: 'Binance USD', decimals: 18 },
  
  // Major tokens
  '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce': { symbol: 'SHIB', name: 'SHIBA INU', decimals: 18 },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8 },
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': { symbol: 'UNI', name: 'Uniswap', decimals: 18 },
  '0x514910771af9ca656af840dff83e8264ecf986ca': { symbol: 'LINK', name: 'Chainlink', decimals: 18 },
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': { symbol: 'MATIC', name: 'Polygon', decimals: 18 },
  
  // DeFi tokens
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': { symbol: 'AAVE', name: 'Aave Token', decimals: 18 },
  '0xc00e94cb662c3520282e6f5717214004a7f26888': { symbol: 'COMP', name: 'Compound', decimals: 18 },
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': { symbol: 'MKR', name: 'Maker', decimals: 18 }
};

const BASE_TOKENS = {
  // Base Stablecoins
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
  
  // Base native and wrapped tokens
  '0x4200000000000000000000000000000000000006': { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  
  // Popular Base tokens (these may need to be updated with actual Base token addresses)
  '0x940181a94a35a4569e4529a3cdfb74e38fd98631': { symbol: 'AERO', name: 'Aerodrome Finance', decimals: 18 },
  '0x0578292cb20a443ba1cde459c985ce14ca2bdee5': { symbol: 'SCALE', name: 'Scale', decimals: 18 }
};

// Combined token database with network separation
const TOKEN_DATABASE = {
  ethereum: ETHEREUM_TOKENS,
  base: BASE_TOKENS
};

// Legacy token database for backward compatibility
const LEGACY_TOKEN_DATABASE = ETHEREUM_TOKENS;

// Contract function selectors for ERC-20 calls (universal across networks)
const CONTRACT_FUNCTIONS = {
  NAME: '0x06fdde03',        // name() function selector
  SYMBOL: '0x95d89b41',      // symbol() function selector  
  DECIMALS: '0x313ce567',    // decimals() function selector
  BALANCE_OF: '0x70a08231'   // balanceOf(address) function selector
};

// Analysis settings
const ANALYSIS_CONFIG = {
  BATCH_SIZE: 1,                    // Process wallets sequentially for stability
  DEFAULT_DECIMALS: 18,             // Standard ERC-20 decimals
  MIN_BALANCE_THRESHOLD: 0.000001,  // Minimum balance to consider as "has token"
  MAX_CONCURRENT_REQUESTS: 1,       // Max parallel requests to avoid rate limiting
  TIMEOUT_MS: 30000,                // Request timeout in milliseconds
  
  // Network-specific timing adjustments
  NETWORK_DELAYS: {
    ethereum: 1.0,  // Base multiplier for Ethereum
    base: 0.8       // Faster for Base L2
  },
  
  // Categorization thresholds
  CATEGORIZATION: {
    ALL_TOKENS: 'all',       // Wallet has ALL target tokens
    SOME_TOKENS: 'some',     // Wallet has SOME target tokens  
    NO_TOKENS: 'none'        // Wallet has NONE of target tokens
  }
};

// Validation patterns
const VALIDATION = {
  ETHEREUM_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  MAX_WALLETS_PER_REQUEST: 50,      // Prevent abuse
  MAX_TOKENS_PER_REQUEST: 20,       // Prevent abuse
  MIN_ADDRESS_LENGTH: 42,
  MAX_ADDRESS_LENGTH: 42,
  
  // Supported networks
  SUPPORTED_NETWORKS: ['ethereum', 'base'],
  DEFAULT_NETWORK: 'ethereum'
};

/**
 * Get network configuration by network ID
 */
function getNetworkConfig(networkId) {
  const network = networkId?.toLowerCase() || VALIDATION.DEFAULT_NETWORK;
  
  if (!NETWORK_CONFIG[network]) {
    throw new Error(`Unsupported network: ${networkId}. Supported networks: ${VALIDATION.SUPPORTED_NETWORKS.join(', ')}`);
  }
  
  return NETWORK_CONFIG[network];
}

/**
 * Get token database for specific network
 */
function getTokenDatabase(networkId) {
  const network = networkId?.toLowerCase() || VALIDATION.DEFAULT_NETWORK;
  return TOKEN_DATABASE[network] || {};
}

/**
 * Check if network is supported
 */
function isNetworkSupported(networkId) {
  return VALIDATION.SUPPORTED_NETWORKS.includes(networkId?.toLowerCase());
}

/**
 * Get all supported networks
 */
function getSupportedNetworks() {
  return Object.keys(NETWORK_CONFIG).map(networkId => ({
    id: networkId,
    ...NETWORK_CONFIG[networkId]
  }));
}

// Log supported networks on startup
console.log('🌐 Supported Networks:');
getSupportedNetworks().forEach(network => {
  console.log(`   ${network.icon} ${network.name} (${network.id})`);
});

module.exports = {
  // New multi-chain exports
  NETWORK_CONFIG,
  TOKEN_DATABASE,
  getNetworkConfig,
  getTokenDatabase,
  isNetworkSupported,
  getSupportedNetworks,
  
  // Legacy exports for backward compatibility
  API_CONFIG,
  TOKEN_DATABASE: LEGACY_TOKEN_DATABASE, // Legacy: defaults to Ethereum
  CONTRACT_FUNCTIONS,
  ANALYSIS_CONFIG,
  VALIDATION
};
