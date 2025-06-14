/**
 * API Routes for Multi-Chain Wallet Analyzer
 * Handles blockchain analysis requests for multiple networks
 * Supports Ethereum and Base networks
 */

const express = require('express');
const router = express.Router();

const blockchainService = require('../services/etherscan');
const { validateAddresses, parseAddressInput, validateRequestLimits } = require('../utils/helpers');
const { logInfo, logError, PerformanceTimer } = require('../utils/debugger');
const { 
  API_CONFIG, 
  VALIDATION, 
  isNetworkSupported, 
  getNetworkConfig, 
  getSupportedNetworks 
} = require('../config/constants');

/**
 * Middleware for request validation with network support
 */
const validateRequest = (req, res, next) => {
  const { wallets, tokens, network } = req.body;
  
  if (!wallets || !tokens) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Both wallets and tokens arrays are required'
    });
  }
  
  // Validate network if provided
  if (network && !isNetworkSupported(network)) {
    const supportedNetworks = getSupportedNetworks().map(n => n.id);
    return res.status(400).json({
      error: 'Unsupported network',
      message: `Network '${network}' is not supported. Supported networks: ${supportedNetworks.join(', ')}`,
      supportedNetworks: supportedNetworks
    });
  }
  
  const validation = validateRequestLimits(wallets, tokens);
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Validation failed',
      message: validation.errors.join(', ')
    });
  }
  
  // Set default network if not provided
  req.body.network = network || VALIDATION.DEFAULT_NETWORK;
  
  next();
};

/**
 * POST /api/analyze
 * Main endpoint for analyzing wallets with network support
 */
router.post('/analyze', validateRequest, async (req, res) => {
  const timer = new PerformanceTimer('Full Wallet Analysis');
  const requestId = req.requestId || 'unknown';
  
  try {
    const { 
      wallets: walletInput, 
      tokens: tokenInput, 
      network = VALIDATION.DEFAULT_NETWORK 
    } = req.body;
    
    const networkConfig = getNetworkConfig(network);
    
    logInfo(`Starting wallet analysis on ${networkConfig.name}`, { 
      requestId,
      walletCount: walletInput.length,
      tokenCount: tokenInput.length,
      network: network,
      networkName: networkConfig.name
    });
    
    // Parse and validate addresses
    const walletValidation = validateAddresses(walletInput);
    const tokenValidation = validateAddresses(tokenInput);
    
    if (walletValidation.invalid.length > 0 || tokenValidation.invalid.length > 0) {
      return res.status(400).json({
        error: 'Invalid addresses found',
        invalidWallets: walletValidation.invalid,
        invalidTokens: tokenValidation.invalid,
        network: network,
        networkName: networkConfig.name
      });
    }
    
    const wallets = walletValidation.valid;
    const tokens = tokenValidation.valid;
    
    logInfo(`Validated addresses for ${networkConfig.name}`, {
      requestId,
      validWallets: wallets.length,
      validTokens: tokens.length,
      network: network
    });
    
    // Perform analysis with network parameter
    const results = await analyzeWalletsForTokens(wallets, tokens, network, requestId);
    
    const { duration } = timer.end();
    
    // Send response with network information
    res.json({
      success: true,
      requestId,
      network: {
        id: network,
        name: networkConfig.name,
        chainId: networkConfig.chainId,
        icon: networkConfig.icon
      },
      analysis: {
        walletCount: wallets.length,
        tokenCount: tokens.length,
        duration: `${duration.toFixed(2)}ms`,
        networkName: networkConfig.name
      },
      results
    });
    
  } catch (error) {
    timer.end();
    const networkName = req.body.network ? getNetworkConfig(req.body.network).name : 'Unknown';
    
    logError(`Analysis failed on ${networkName}`, error, { 
      requestId,
      network: req.body.network 
    });
    
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      requestId,
      network: req.body.network || VALIDATION.DEFAULT_NETWORK,
      networkName: networkName
    });
  }
});

/**
 * POST /api/validate-addresses
 * Validate addresses with network context
 */
router.post('/validate-addresses', (req, res) => {
  try {
    const { addresses, network = VALIDATION.DEFAULT_NETWORK } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Addresses must be an array'
      });
    }
    
    // Validate network if provided
    if (network && !isNetworkSupported(network)) {
      const supportedNetworks = getSupportedNetworks().map(n => n.id);
      return res.status(400).json({
        error: 'Unsupported network',
        message: `Network '${network}' is not supported. Supported networks: ${supportedNetworks.join(', ')}`,
        supportedNetworks: supportedNetworks
      });
    }
    
    const networkConfig = getNetworkConfig(network);
    const validation = validateAddresses(addresses);
    
    res.json({
      success: true,
      network: {
        id: network,
        name: networkConfig.name,
        chainId: networkConfig.chainId,
        icon: networkConfig.icon
      },
      valid: validation.valid,
      invalid: validation.invalid,
      summary: {
        total: addresses.length,
        validCount: validation.valid.length,
        invalidCount: validation.invalid.length,
        networkName: networkConfig.name
      }
    });
    
  } catch (error) {
    logError('Address validation failed', error);
    res.status(500).json({
      error: 'Validation failed',
      message: error.message
    });
  }
});

/**
 * GET /api/token-info/:address
 * Get information about a specific token with network support
 */
router.get('/token-info/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { network = VALIDATION.DEFAULT_NETWORK } = req.query;
    
    if (!address || !VALIDATION.ETHEREUM_ADDRESS.test(address)) {
      return res.status(400).json({
        error: 'Invalid token address',
        message: 'Token address must be a valid Ethereum address'
      });
    }
    
    // Validate network
    if (!isNetworkSupported(network)) {
      const supportedNetworks = getSupportedNetworks().map(n => n.id);
      return res.status(400).json({
        error: 'Unsupported network',
        message: `Network '${network}' is not supported. Supported networks: ${supportedNetworks.join(', ')}`,
        supportedNetworks: supportedNetworks
      });
    }
    
    const networkConfig = getNetworkConfig(network);
    const tokenInfo = await blockchainService.getTokenInfo(address, network);
    
    res.json({
      success: true,
      network: {
        id: network,
        name: networkConfig.name,
        chainId: networkConfig.chainId,
        icon: networkConfig.icon
      },
      tokenInfo
    });
    
  } catch (error) {
    logError('Token info retrieval failed', error);
    res.status(500).json({
      error: 'Failed to get token info',
      message: error.message
    });
  }
});

/**
 * GET /api/networks
 * Get list of supported networks
 */
router.get('/networks', (req, res) => {
  try {
    const networks = getSupportedNetworks();
    
    res.json({
      success: true,
      networks: networks.map(network => ({
        id: network.id,
        name: network.name,
        chainId: network.chainId,
        icon: network.icon,
        explorerUrl: network.explorerUrl,
        nativeCurrency: network.nativeCurrency
      })),
      default: VALIDATION.DEFAULT_NETWORK
    });
  } catch (error) {
    logError('Failed to get supported networks', error);
    res.status(500).json({
      error: 'Failed to get networks',
      message: error.message
    });
  }
});

/**
 * GET /api/health
 * Health check for API endpoints with network information
 */
router.get('/health', (req, res) => {
  try {
    const supportedNetworks = getSupportedNetworks();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      api: 'Multi-Chain Wallet Analyzer API',
      version: '2.2.0',
      supportedNetworks: supportedNetworks.map(n => ({
        id: n.id,
        name: n.name,
        icon: n.icon
      })),
      endpoints: [
        'POST /api/analyze',
        'POST /api/validate-addresses',
        'GET /api/token-info/:address?network=<network>',
        'GET /api/networks',
        'GET /api/health'
      ]
    });
  } catch (error) {
    logError('Health check failed', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

/**
 * Core analysis function with network support
 */
async function analyzeWalletsForTokens(wallets, tokens, network, requestId = 'unknown') {
  const analysisTimer = new PerformanceTimer('Wallet Analysis');
  const networkConfig = getNetworkConfig(network);
  
  logInfo(`Starting sequential wallet analysis on ${networkConfig.name}`, {
    requestId,
    walletCount: wallets.length,
    tokenCount: tokens.length,
    network: network,
    networkName: networkConfig.name
  });
  
  const allResults = [];
  
  // Process wallets sequentially to avoid rate limiting
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    
    logInfo(`Processing wallet ${i + 1}/${wallets.length} on ${networkConfig.name}`, {
      requestId,
      walletAddress: wallet.substring(0, 10) + '...',
      network: network
    });
    
    try {
      const result = await analyzeWallet(wallet, tokens, network, requestId);
      allResults.push(result);
      
      logInfo(`Wallet ${i + 1} completed on ${networkConfig.name}`, {
        requestId,
        walletAddress: wallet.substring(0, 10) + '...',
        tokensFound: result.foundTokens.length,
        network: network
      });
      
    } catch (error) {
      logError(`Error processing wallet ${i + 1} on ${networkConfig.name}`, error, { 
        requestId,
        walletAddress: wallet.substring(0, 10) + '...',
        network: network
      });
      
      allResults.push({
        walletAddress: wallet,
        foundTokens: [],
        error: error.message,
        network: network
      });
    }
    
    // Add network-specific delay between wallets
    if (i < wallets.length - 1) {
      const networkDelay = ANALYSIS_CONFIG.NETWORK_DELAYS[network] || 1.0;
      const adjustedDelay = Math.round(API_CONFIG.RATE_LIMITS.WALLET_DELAY * networkDelay);
      await new Promise(resolve => setTimeout(resolve, adjustedDelay));
    }
  }
  
  logInfo(`All wallets processed on ${networkConfig.name}`, {
    requestId,
    resultCount: allResults.length,
    network: network
  });
  
  // Categorize results
  const categorizedResults = categorizeResults(allResults, tokens, network);
  
  const { duration } = analysisTimer.end();
  
  logInfo(`Analysis completed on ${networkConfig.name}`, {
    requestId,
    duration: `${duration.toFixed(2)}ms`,
    allTokens: categorizedResults.allTokens.length,
    someTokens: categorizedResults.someTokens.length,
    noTokens: categorizedResults.noTokens.length,
    network: network,
    networkName: networkConfig.name
  });
  
  return categorizedResults;
}

/**
 * Analyze individual wallet for target tokens on specific network
 */
async function analyzeWallet(walletAddress, targetTokens, network, requestId) {
  const networkConfig = getNetworkConfig(network);
  const walletTimer = new PerformanceTimer(`Wallet Analysis: ${walletAddress.substring(0, 10)}-${networkConfig.name}`);
  
  try {
    logInfo(`Starting wallet analysis on ${networkConfig.name}`, {
      requestId,
      walletAddress: walletAddress.substring(0, 20) + '...',
      tokenCount: targetTokens.length,
      network: network,
      networkName: networkConfig.name
    });
    
    const balanceResults = await blockchainService.getMultipleTokenBalances(
      walletAddress, 
      targetTokens, 
      network
    );
    
    const foundTokens = [];
    
    for (const balanceData of balanceResults) {
      if (balanceData.hasBalance && !balanceData.error) {
        try {
          const tokenInfo = await blockchainService.getTokenInfo(balanceData.tokenAddress, network);
          
          foundTokens.push({
            address: balanceData.tokenAddress,
            balance: balanceData.balance,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            decimals: tokenInfo.decimals || balanceData.decimals,
            network: network,
            networkName: networkConfig.name
          });
          
        } catch (error) {
          logError(`Failed to get token info on ${networkConfig.name}`, error, {
            requestId,
            tokenAddress: balanceData.tokenAddress.substring(0, 10) + '...',
            network: network
          });
          
          // Add token with basic info even if we can't get details
          foundTokens.push({
            address: balanceData.tokenAddress,
            balance: balanceData.balance,
            symbol: balanceData.tokenAddress.substring(0, 6) + '...',
            name: 'Unknown Token',
            decimals: balanceData.decimals || 18,
            network: network,
            networkName: networkConfig.name
          });
        }
      }
    }
    
    walletTimer.end();
    
    const result = {
      walletAddress,
      foundTokens,
      network: network,
      networkName: networkConfig.name
    };
    
    logInfo(`Wallet analysis completed on ${networkConfig.name}`, {
      requestId,
      walletAddress: walletAddress.substring(0, 10) + '...',
      tokensChecked: targetTokens.length,
      tokensFound: foundTokens.length,
      foundSymbols: foundTokens.map(t => t.symbol).join(', '),
      network: network,
      networkName: networkConfig.name
    });
    
    return result;
    
  } catch (error) {
    walletTimer.end();
    logError(`Wallet analysis failed on ${networkConfig.name}`, error, {
      requestId,
      walletAddress: walletAddress.substring(0, 10) + '...',
      network: network
    });
    
    return {
      walletAddress,
      foundTokens: [],
      error: error.message,
      network: network,
      networkName: networkConfig.name
    };
  }
}

/**
 * Categorize wallet results into ALL/SOME/NO tokens with network info
 */
function categorizeResults(allResults, targetTokens, network) {
  const networkConfig = getNetworkConfig(network);
  
  logInfo(`Starting result categorization for ${networkConfig.name}`, {
    resultCount: allResults.length,
    targetTokenCount: targetTokens.length,
    network: network
  });
  
  const categorizedResults = {
    allTokens: [],
    someTokens: [],
    noTokens: [],
    network: network,
    networkName: networkConfig.name
  };
  
  const targetTokensLower = targetTokens.map(t => t.toLowerCase());
  
  for (const result of allResults) {
    if (result.error) {
      categorizedResults.noTokens.push(result);
      continue;
    }
    
    const foundTokenAddresses = result.foundTokens.map(t => t.address.toLowerCase());
    const matchingTokens = targetTokensLower.filter(target => foundTokenAddresses.includes(target));
    
    if (matchingTokens.length === 0) {
      categorizedResults.noTokens.push(result);
    } else if (matchingTokens.length === targetTokensLower.length) {
      categorizedResults.allTokens.push(result);
    } else {
      categorizedResults.someTokens.push(result);
    }
  }
  
  logInfo(`Categorization completed for ${networkConfig.name}`, {
    allTokens: categorizedResults.allTokens.length,
    someTokens: categorizedResults.someTokens.length,
    noTokens: categorizedResults.noTokens.length,
    network: network
  });
  
  return categorizedResults;
}

module.exports = router;
