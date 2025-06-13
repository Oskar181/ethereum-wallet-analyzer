/**
 * API Routes for Ethereum Wallet Analyzer
 * Handles all blockchain analysis requests
 */

const express = require('express');
const router = express.Router();

const etherscanService = require('../services/etherscan');
const { validateAddresses, parseAddressInput, validateRequestLimits } = require('../utils/helpers');
const { logInfo, logError, PerformanceTimer } = require('../utils/debugger');
const { API_CONFIG, VALIDATION } = require('../config/constants');

/**
 * Middleware for request validation
 */
const validateRequest = (req, res, next) => {
  const { wallets, tokens } = req.body;
  
  if (!wallets || !tokens) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Both wallets and tokens arrays are required'
    });
  }
  
  const validation = validateRequestLimits(wallets, tokens);
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Validation failed',
      message: validation.errors.join(', ')
    });
  }
  
  next();
};

/**
 * POST /api/analyze
 * Main endpoint for analyzing wallets
 */
router.post('/analyze', validateRequest, async (req, res) => {
  const timer = new PerformanceTimer('Full Wallet Analysis');
  const requestId = req.requestId || 'unknown';
  
  try {
    const { wallets: walletInput, tokens: tokenInput } = req.body;
    
    logInfo(`Starting wallet analysis`, { 
      requestId,
      walletCount: walletInput.length,
      tokenCount: tokenInput.length
    });
    
    // Parse and validate addresses
    const walletValidation = validateAddresses(walletInput);
    const tokenValidation = validateAddresses(tokenInput);
    
    if (walletValidation.invalid.length > 0 || tokenValidation.invalid.length > 0) {
      return res.status(400).json({
        error: 'Invalid addresses found',
        invalidWallets: walletValidation.invalid,
        invalidTokens: tokenValidation.invalid
      });
    }
    
    const wallets = walletValidation.valid;
    const tokens = tokenValidation.valid;
    
    logInfo(`Validated addresses`, {
      requestId,
      validWallets: wallets.length,
      validTokens: tokens.length
    });
    
    // Perform analysis
    const results = await analyzeWalletsForTokens(wallets, tokens, requestId);
    
    const { duration } = timer.end();
    
    // Send response
    res.json({
      success: true,
      requestId,
      analysis: {
        walletCount: wallets.length,
        tokenCount: tokens.length,
        duration: `${duration.toFixed(2)}ms`
      },
      results
    });
    
  } catch (error) {
    timer.end();
    logError('Analysis failed', error, { requestId });
    
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      requestId
    });
  }
});

/**
 * POST /api/validate-addresses
 * Validate Ethereum addresses
 */
router.post('/validate-addresses', (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Addresses must be an array'
      });
    }
    
    const validation = validateAddresses(addresses);
    
    res.json({
      success: true,
      valid: validation.valid,
      invalid: validation.invalid,
      summary: {
        total: addresses.length,
        validCount: validation.valid.length,
        invalidCount: validation.invalid.length
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
 * Get information about a specific token
 */
router.get('/token-info/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !VALIDATION.ETHEREUM_ADDRESS.test(address)) {
      return res.status(400).json({
        error: 'Invalid token address',
        message: 'Token address must be a valid Ethereum address'
      });
    }
    
    const tokenInfo = await etherscanService.getTokenInfo(address);
    
    res.json({
      success: true,
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
 * GET /api/health
 * Health check for API endpoints
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    api: 'Ethereum Wallet Analyzer API',
    version: '2.1.0',
    endpoints: [
      'POST /api/analyze',
      'POST /api/validate-addresses',
      'GET /api/token-info/:address',
      'GET /api/health'
    ]
  });
});

/**
 * Core analysis function
 */
async function analyzeWalletsForTokens(wallets, tokens, requestId = 'unknown') {
  const analysisTimer = new PerformanceTimer('Wallet Analysis');
  const startTime = Date.now();
  
  logInfo('Starting sequential wallet analysis', {
    requestId,
    walletCount: wallets.length,
    tokenCount: tokens.length
  });
  
  const allResults = [];
  
  // Process wallets sequentially to avoid rate limiting
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    
    logInfo(`Processing wallet ${i + 1}/${wallets.length}`, {
      requestId,
      walletAddress: wallet.substring(0, 10) + '...'
    });
    
    try {
      const result = await analyzeWallet(wallet, tokens, requestId);
      allResults.push(result);
      
      logInfo(`Wallet ${i + 1} completed`, {
        requestId,
        walletAddress: wallet.substring(0, 10) + '...',
        tokensFound: result.foundTokens.length
      });
      
    } catch (error) {
      logError(`Error processing wallet ${i + 1}`, error, { 
        requestId,
        walletAddress: wallet.substring(0, 10) + '...'
      });
      
      allResults.push({
        walletAddress: wallet,
        foundTokens: [],
        error: error.message
      });
    }
    
    // Add delay between wallets
    if (i < wallets.length - 1) {
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.RATE_LIMITS.WALLET_DELAY));
    }
  }
  
  logInfo('All wallets processed', {
    requestId,
    resultCount: allResults.length
  });
  
  // Categorize results
  const categorizedResults = categorizeResults(allResults, tokens);
  
  const { duration } = analysisTimer.end();
  
  logInfo('Analysis completed', {
    requestId,
    duration: `${duration.toFixed(2)}ms`,
    allTokens: categorizedResults.allTokens.length,
    someTokens: categorizedResults.someTokens.length,
    noTokens: categorizedResults.noTokens.length
  });
  
  return categorizedResults;
}

/**
 * Analyze individual wallet for target tokens
 */
async function analyzeWallet(walletAddress, targetTokens, requestId) {
  const walletTimer = new PerformanceTimer(`Wallet Analysis: ${walletAddress.substring(0, 10)}`);
  
  try {
    logInfo('Starting wallet analysis', {
      requestId,
      walletAddress: walletAddress.substring(0, 20) + '...',
      tokenCount: targetTokens.length
    });
    
    const balanceResults = await etherscanService.getMultipleTokenBalances(walletAddress, targetTokens);
    
    const foundTokens = [];
    
    for (const balanceData of balanceResults) {
      if (balanceData.hasBalance && !balanceData.error) {
        try {
          const tokenInfo = await etherscanService.getTokenInfo(balanceData.tokenAddress);
          
          foundTokens.push({
            address: balanceData.tokenAddress,
            balance: balanceData.balance,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            decimals: tokenInfo.decimals || balanceData.decimals
          });
          
        } catch (error) {
          logError('Failed to get token info', error, {
            requestId,
            tokenAddress: balanceData.tokenAddress.substring(0, 10) + '...'
          });
          
          // Add token with basic info even if we can't get details
          foundTokens.push({
            address: balanceData.tokenAddress,
            balance: balanceData.balance,
            symbol: balanceData.tokenAddress.substring(0, 6) + '...',
            name: 'Unknown Token',
            decimals: balanceData.decimals || 18
          });
        }
      }
    }
    
    walletTimer.end();
    
    const result = {
      walletAddress,
      foundTokens
    };
    
    logInfo('Wallet analysis completed', {
      requestId,
      walletAddress: walletAddress.substring(0, 10) + '...',
      tokensChecked: targetTokens.length,
      tokensFound: foundTokens.length,
      foundSymbols: foundTokens.map(t => t.symbol).join(', ')
    });
    
    return result;
    
  } catch (error) {
    walletTimer.end();
    logError('Wallet analysis failed', error, {
      requestId,
      walletAddress: walletAddress.substring(0, 10) + '...'
    });
    
    return {
      walletAddress,
      foundTokens: [],
      error: error.message
    };
  }
}

/**
 * Categorize wallet results into ALL/SOME/NO tokens
 */
function categorizeResults(allResults, targetTokens) {
  logInfo('Starting result categorization', {
    resultCount: allResults.length,
    targetTokenCount: targetTokens.length
  });
  
  const categorizedResults = {
    allTokens: [],
    someTokens: [],
    noTokens: []
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
  
  logInfo('Categorization completed', {
    allTokens: categorizedResults.allTokens.length,
    someTokens: categorizedResults.someTokens.length,
    noTokens: categorizedResults.noTokens.length
  });
  
  return categorizedResults;
}

module.exports = router;
