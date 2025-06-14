/**
 * API Routes for Multi-Chain Wallet Analyzer
 * Handles blockchain analysis requests for multiple networks
 * Supports Ethereum and Base networks
 * POPRAWIONA WERSJA z USD pricing fix
 */

const express = require('express');
const router = express.Router();

const blockchainService = require('../services/etherscan');
const dexScreenerService = require('../services/dexscreener');
const { validateAddresses, parseAddressInput, validateRequestLimits } = require('../utils/helpers');
const { logInfo, logError, logDebug, PerformanceTimer } = require('../utils/debugger');
const { 
  API_CONFIG, 
  VALIDATION, 
  ANALYSIS_CONFIG, // DODANE - potrzebne dla NETWORK_DELAYS
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
        'GET /api/health',
        'POST /api/test-pricing'
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
 * POST /api/test-pricing - NOWY ENDPOINT
 * Test endpoint for USD pricing functionality
 */
router.post('/test-pricing', async (req, res) => {
  const timer = new PerformanceTimer('USD Pricing Test');
  
  try {
    const { tokens = [], network = 'ethereum' } = req.body;
    
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Tokens array is required'
      });
    }
    
    if (!isNetworkSupported(network)) {
      const supportedNetworks = getSupportedNetworks().map(n => n.id);
      return res.status(400).json({
        error: 'Unsupported network',
        message: `Network '${network}' is not supported. Supported networks: ${supportedNetworks.join(', ')}`
      });
    }
    
    const networkConfig = getNetworkConfig(network);
    
    logInfo(`🧪 Starting USD pricing test on ${networkConfig.name}`, {
      tokenCount: tokens.length,
      tokens: tokens.map(t => t.substring(0, 10) + '...'),
      network: network
    });
    
    const results = [];
    
    // Test each token individually for detailed results
    for (let i = 0; i < tokens.length; i++) {
      const tokenAddress = tokens[i];
      
      try {
        logInfo(`🔄 Testing token ${i + 1}/${tokens.length}: ${tokenAddress.substring(0, 10)}...`);
        
        // Test DexScreener service directly
        const dexScreenerResult = await dexScreenerService.getTokenPrice(tokenAddress, network);
        
        // Test blockchain service with pricing
        const blockchainResult = await blockchainService.getTokenInfo(tokenAddress, network, true);
        
        // Test USD calculation
        let calculationTest = null;
        if (dexScreenerResult.priceUsd && dexScreenerResult.priceUsd > 0) {
          const testBalance = "1000.123456"; // Test with 1000 tokens
          const calculatedUsd = dexScreenerService.calculateUsdValue(testBalance, dexScreenerResult.priceUsd);
          const formattedUsd = dexScreenerService.formatUsdValue(calculatedUsd);
          
          calculationTest = {
            testBalance: testBalance,
            priceUsd: dexScreenerResult.priceUsd,
            calculatedUsd: calculatedUsd,
            formattedUsd: formattedUsd,
            success: calculatedUsd > 0 && formattedUsd !== '$0.00'
          };
        }
        
        const testResult = {
          tokenAddress: tokenAddress,
          dexScreener: {
            success: !dexScreenerResult.error && dexScreenerResult.priceUsd !== null,
            priceUsd: dexScreenerResult.priceUsd,
            priceChange24h: dexScreenerResult.priceChange24h,
            source: dexScreenerResult.source,
            error: dexScreenerResult.error || null
          },
          blockchain: {
            success: !blockchainResult.priceError && blockchainResult.priceUsd !== null,
            symbol: blockchainResult.symbol,
            name: blockchainResult.name,
            priceUsd: blockchainResult.priceUsd,
            priceSource: blockchainResult.priceSource,
            error: blockchainResult.priceError || null
          },
          calculation: calculationTest,
          overall: {
            success: (dexScreenerResult.priceUsd !== null || blockchainResult.priceUsd !== null) && 
                     (!calculationTest || calculationTest.success),
            hasPrice: dexScreenerResult.priceUsd !== null || blockchainResult.priceUsd !== null,
            canCalculateUsd: calculationTest?.success || false
          }
        };
        
        results.push(testResult);
        
        logInfo(`${testResult.overall.success ? '✅' : '❌'} Token test completed: ${testResult.blockchain.symbol || 'Unknown'}`, {
          hasPrice: testResult.overall.hasPrice,
          canCalculate: testResult.overall.canCalculateUsd,
          priceUsd: testResult.dexScreener.priceUsd || testResult.blockchain.priceUsd
        });
        
      } catch (error) {
        logError(`❌ Token test failed for ${tokenAddress}`, error);
        
        results.push({
          tokenAddress: tokenAddress,
          dexScreener: { success: false, error: error.message },
          blockchain: { success: false, error: error.message },
          calculation: null,
          overall: { success: false, hasPrice: false, canCalculateUsd: false, error: error.message }
        });
      }
      
      // Add delay between tests
      if (i < tokens.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    timer.end();
    
    // Calculate test summary
    const summary = {
      totalTests: results.length,
      successful: results.filter(r => r.overall.success).length,
      withPrices: results.filter(r => r.overall.hasPrice).length,
      canCalculateUsd: results.filter(r => r.overall.canCalculateUsd).length,
      dexScreenerSuccess: results.filter(r => r.dexScreener.success).length,
      blockchainSuccess: results.filter(r => r.blockchain.success).length
    };
    
    summary.successRate = ((summary.successful / summary.totalTests) * 100).toFixed(1);
    summary.priceRate = ((summary.withPrices / summary.totalTests) * 100).toFixed(1);
    
    logInfo(`🎯 USD pricing test completed on ${networkConfig.name}`, {
      ...summary,
      network: network
    });
    
    res.json({
      success: true,
      network: {
        id: network,
        name: networkConfig.name,
        chainId: networkConfig.chainId
      },
      summary: summary,
      results: results,
      recommendations: generateTestRecommendations(summary, results)
    });
    
  } catch (error) {
    timer.end();
    logError(`USD pricing test failed`, error);
    
    res.status(500).json({
      error: 'Pricing test failed',
      message: error.message
    });
  }
});

/**
 * Generate recommendations based on test results
 */
function generateTestRecommendations(summary, results) {
  const recommendations = [];
  
  if (summary.successful === 0) {
    recommendations.push('🔥 CRITICAL: No tokens returned USD prices. Check DexScreener API connectivity.');
  } else if (summary.successRate < 50) {
    recommendations.push('⚠️ WARNING: Low success rate. Consider adding backup price sources.');
  } else if (summary.successRate < 80) {
    recommendations.push('💡 INFO: Good success rate, but could be improved.');
  } else {
    recommendations.push('✅ EXCELLENT: High success rate for USD pricing.');
  }
  
  if (summary.dexScreenerSuccess === 0) {
    recommendations.push('🔧 Check DexScreener API - no successful calls detected.');
  }
  
  if (summary.canCalculateUsd < summary.withPrices) {
    recommendations.push('🧮 USD calculation issues detected - check calculateUsdValue function.');
  }
  
  // Check for specific error patterns
  const commonErrors = {};
  results.forEach(result => {
    if (result.dexScreener.error) {
      commonErrors[result.dexScreener.error] = (commonErrors[result.dexScreener.error] || 0) + 1;
    }
  });
  
  Object.entries(commonErrors).forEach(([error, count]) => {
    if (count > 1) {
      recommendations.push(`🔍 Recurring error (${count}x): ${error}`);
    }
  });
  
  return recommendations;
}

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
 * Analyze individual wallet for target tokens on specific network - POPRAWIONA WERSJA
 */
async function analyzeWallet(walletAddress, targetTokens, network, requestId) {
  const networkConfig = getNetworkConfig(network);
  const walletTimer = new PerformanceTimer(`Wallet Analysis: ${walletAddress.substring(0, 10)}-${networkConfig.name}`);
  
  try {
    logInfo(`🔄 Starting wallet analysis on ${networkConfig.name}`, {
      requestId,
      walletAddress: walletAddress.substring(0, 20) + '...',
      tokenCount: targetTokens.length,
      network: network,
      networkName: networkConfig.name
    });
    
    // Step 1: Get token balances
    const balanceResults = await blockchainService.getMultipleTokenBalances(
      walletAddress, 
      targetTokens, 
      network
    );
    
    logDebug(`📊 Balance results for wallet ${walletAddress.substring(0, 10)}...`, {
      totalTokens: balanceResults.length,
      tokensWithBalance: balanceResults.filter(r => r.hasBalance).length,
      tokensWithErrors: balanceResults.filter(r => r.error).length,
      network: networkConfig.name
    });
    
    // Step 2: Get token information with pricing for tokens that have balances
    const tokensWithBalances = balanceResults.filter(result => result.hasBalance && !result.error);
    const tokenAddresses = tokensWithBalances.map(result => result.tokenAddress);
    
    logDebug(`💰 Fetching pricing for ${tokenAddresses.length} tokens with balances`, {
      tokenAddresses: tokenAddresses.map(addr => addr.substring(0, 10) + '...'),
      network: networkConfig.name
    });
    
    let tokenInfos = [];
    if (tokenAddresses.length > 0) {
      try {
        logDebug(`🔄 Calling getMultipleTokenInfo with pricing=true`);
        tokenInfos = await blockchainService.getMultipleTokenInfo(tokenAddresses, network, true);
        
        logDebug(`✅ Received token info for ${tokenInfos.length} tokens`, {
          tokensWithPrices: tokenInfos.filter(t => t.priceUsd !== null && t.priceUsd > 0).length,
          tokensWithErrors: tokenInfos.filter(t => t.priceError).length,
          network: networkConfig.name
        });
        
      } catch (error) {
        logError(`❌ Failed to get token info with pricing on ${networkConfig.name}`, error, {
          requestId,
          tokenCount: tokenAddresses.length,
          network: network
        });
        
        // Fallback: get token info without pricing
        logDebug(`🔄 Falling back to token info without pricing`);
        try {
          tokenInfos = await Promise.all(
            tokenAddresses.map(address => blockchainService.getTokenInfo(address, network, false))
          );
          logDebug(`✅ Fallback token info received for ${tokenInfos.length} tokens`);
        } catch (fallbackError) {
          logError(`❌ Even fallback token info failed`, fallbackError);
          tokenInfos = [];
        }
      }
    }
    
    // Step 3: Build found tokens array with USD calculations
    const foundTokens = [];
    
    logDebug(`🔨 Building foundTokens array from ${tokensWithBalances.length} balance results`);
    
    for (const balanceData of tokensWithBalances) {
      const tokenInfo = tokenInfos.find(info => 
        info.address.toLowerCase() === balanceData.tokenAddress.toLowerCase()
      );
      
      if (tokenInfo) {
        // Calculate USD value if price is available
        let usdValue = null;
        let usdValueFormatted = null;
        
        logDebug(`💵 Processing token ${tokenInfo.symbol}`, {
          address: tokenInfo.address.substring(0, 10) + '...',
          balance: balanceData.balance,
          priceUsd: tokenInfo.priceUsd,
          priceSource: tokenInfo.priceSource,
          priceError: tokenInfo.priceError
        });
        
        if (tokenInfo.priceUsd && tokenInfo.priceUsd > 0 && balanceData.balance) {
          try {
            usdValue = dexScreenerService.calculateUsdValue(balanceData.balance, tokenInfo.priceUsd);
            usdValueFormatted = dexScreenerService.formatUsdValue(usdValue);
            
            logDebug(`✅ USD calculation successful for ${tokenInfo.symbol}`, {
              balance: balanceData.balance,
              priceUsd: tokenInfo.priceUsd,
              usdValue: usdValue,
              usdValueFormatted: usdValueFormatted
            });
          } catch (calcError) {
            logError(`❌ USD calculation failed for ${tokenInfo.symbol}`, calcError, {
              balance: balanceData.balance,
              priceUsd: tokenInfo.priceUsd
            });
            usdValue = null;
            usdValueFormatted = null;
          }
        } else {
          logDebug(`⚠️ No USD calculation for ${tokenInfo.symbol}`, {
            hasPrice: !!tokenInfo.priceUsd,
            priceValue: tokenInfo.priceUsd,
            hasBalance: !!balanceData.balance,
            priceError: tokenInfo.priceError
          });
        }
        
        const tokenResult = {
          address: balanceData.tokenAddress,
          balance: balanceData.balance,
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          decimals: tokenInfo.decimals || balanceData.decimals,
          network: network,
          networkName: networkConfig.name,
          // USD pricing information
          priceUsd: tokenInfo.priceUsd,
          priceChange24h: tokenInfo.priceChange24h,
          usdValue: usdValue,
          usdValueFormatted: usdValueFormatted,
          priceSource: tokenInfo.priceSource,
          priceError: tokenInfo.priceError
        };
        
        foundTokens.push(tokenResult);
        
      } else {
        logDebug(`⚠️ No token info found for ${balanceData.tokenAddress.substring(0, 10)}...`);
        
        // Add token with basic info even if we can't get details
        foundTokens.push({
          address: balanceData.tokenAddress,
          balance: balanceData.balance,
          symbol: balanceData.tokenAddress.substring(0, 6) + '...',
          name: 'Unknown Token',
          decimals: balanceData.decimals || 18,
          network: network,
          networkName: networkConfig.name,
          priceUsd: null,
          priceChange24h: null,
          usdValue: null,
          usdValueFormatted: null,
          priceSource: null,
          priceError: 'Token info unavailable'
        });
      }
    }
    
    walletTimer.end();
    
    // Calculate total portfolio value
    const totalUsdValue = foundTokens.reduce((total, token) => {
      const tokenUsdValue = token.usdValue || 0;
      return total + tokenUsdValue;
    }, 0);
    
    const result = {
      walletAddress,
      foundTokens,
      network: network,
      networkName: networkConfig.name,
      totalUsdValue: totalUsdValue,
      totalUsdValueFormatted: dexScreenerService.formatUsdValue(totalUsdValue)
    };
    
    logInfo(`✅ Wallet analysis completed on ${networkConfig.name}`, {
      requestId,
      walletAddress: walletAddress.substring(0, 10) + '...',
      tokensChecked: targetTokens.length,
      tokensFound: foundTokens.length,
      tokensWithUsdValue: foundTokens.filter(t => t.usdValue && t.usdValue > 0).length,
      totalUsdValue: totalUsdValue,
      totalUsdValueFormatted: result.totalUsdValueFormatted,
      foundSymbols: foundTokens.map(t => t.symbol).join(', '),
      network: network,
      networkName: networkConfig.name
    });
    
    return result;
    
  } catch (error) {
    walletTimer.end();
    logError(`❌ Wallet analysis failed on ${networkConfig.name}`, error, {
      requestId,
      walletAddress: walletAddress.substring(0, 10) + '...',
      network: network
    });
    
    return {
      walletAddress,
      foundTokens: [],
      error: error.message,
      network: network,
      networkName: networkConfig.name,
      totalUsdValue: 0,
      totalUsdValueFormatted: '$0.00'
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
