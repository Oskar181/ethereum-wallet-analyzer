/**
 * Multi-Chain Blockchain API Service
 * Professional service for interacting with multiple blockchain networks
 * Supports Ethereum (Etherscan) and Base (Basescan) APIs
 */

const { 
  getNetworkConfig, 
  getTokenDatabase, 
  isNetworkSupported,
  CONTRACT_FUNCTIONS, 
  ANALYSIS_CONFIG, 
  API_CONFIG,
  VALIDATION 
} = require('../config/constants');
const { weiToTokens, retryWithBackoff, isValidEthereumAddress } = require('../utils/helpers');
const { logDebug, logError, PerformanceTimer } = require('../utils/debugger');
const dexScreenerService = require('./dexscreener');

/**
 * Base API call function with retry logic for any network
 */
async function makeApiCall(url, operation, networkId = 'ethereum') {
  const networkConfig = getNetworkConfig(networkId);
  const timer = new PerformanceTimer(`${networkConfig.name} API: ${operation}`);
  
  try {
    const response = await retryWithBackoff(async () => {
      logDebug(`Making API call to ${networkConfig.name}`, { url, operation });
      
      const res = await fetch(url, {
        timeout: ANALYSIS_CONFIG.TIMEOUT_MS,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Wallet-Analyzer/2.2.0'
        }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      return res;
    }, API_CONFIG.RATE_LIMITS.MAX_RETRIES, API_CONFIG.RATE_LIMITS.ETHERSCAN_DELAY);
    
    const data = await response.json();
    timer.end();
    
    if (!data) {
      throw new Error('No data received from API');
    }
    
    if (data.status !== '1') {
      // Handle specific API error messages
      if (data.message === 'NOTOK' && data.result && data.result.includes('Max rate limit reached')) {
        throw new Error(`Rate limit exceeded on ${networkConfig.name}`);
      }
      if (data.message === 'NOTOK' && data.result && data.result.includes('Invalid API Key')) {
        throw new Error(`Invalid API key for ${networkConfig.name}`);
      }
      
      logDebug(`${networkConfig.name} API returned status ${data.status}`, { 
        message: data.message, 
        result: data.result 
      });
    }
    
    return data;
    
  } catch (error) {
    timer.end();
    logError(`${networkConfig.name} API call failed: ${operation}`, error);
    throw error;
  }
}

/**
 * Get token balance for a wallet on specified network
 */
async function getTokenBalance(walletAddress, tokenAddress, networkId = 'ethereum', decimals = null) {
  if (!isValidEthereumAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }
  
  if (!isValidEthereumAddress(tokenAddress)) {
    throw new Error('Invalid token address');
  }

  if (!isNetworkSupported(networkId)) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  
  try {
    const networkConfig = getNetworkConfig(networkId);
    const url = `${networkConfig.apiUrl}?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${walletAddress}&tag=latest&apikey=${networkConfig.apiKey}`;
    
    const data = await makeApiCall(url, `tokenbalance-${tokenAddress.substring(0, 8)}`, networkId);
    
    if (data.status !== '1') {
      logDebug(`Token balance check returned non-success status on ${networkConfig.name}`, {
        walletAddress: walletAddress.substring(0, 10) + '...',
        tokenAddress: tokenAddress.substring(0, 10) + '...',
        status: data.status,
        message: data.message,
        network: networkConfig.name
      });
      return {
        balance: '0',
        hasBalance: false,
        rawBalance: '0',
        network: networkId
      };
    }
    
    const rawBalance = data.result || '0';
    
    // Auto-detect decimals if not provided
    if (decimals === null) {
      // Check network-specific database first
      const tokenDatabase = getTokenDatabase(networkId);
      const knownToken = tokenDatabase[tokenAddress.toLowerCase()];
      if (knownToken && knownToken.decimals) {
        decimals = knownToken.decimals;
      } else {
        // Try to get decimals from contract
        try {
          decimals = await getTokenDecimals(tokenAddress, networkId);
        } catch {
          decimals = ANALYSIS_CONFIG.DEFAULT_DECIMALS; // Fallback to 18
        }
      }
    }
    
    const formattedBalance = weiToTokens(rawBalance, decimals);
    const hasBalance = parseFloat(formattedBalance) > ANALYSIS_CONFIG.MIN_BALANCE_THRESHOLD;
    
    logDebug(`Token balance retrieved from ${networkConfig.name}`, {
      walletAddress: walletAddress.substring(0, 10) + '...',
      tokenAddress: tokenAddress.substring(0, 10) + '...',
      rawBalance,
      formattedBalance,
      decimals,
      hasBalance,
      network: networkConfig.name
    });
    
    return {
      balance: formattedBalance,
      hasBalance,
      rawBalance,
      decimals,
      network: networkId
    };
    
  } catch (error) {
    const networkConfig = getNetworkConfig(networkId);
    logError(`Failed to get token balance from ${networkConfig.name}`, error, {
      walletAddress: walletAddress.substring(0, 10) + '...',
      tokenAddress: tokenAddress.substring(0, 10) + '...',
      network: networkConfig.name
    });
    
    return {
      balance: '0',
      hasBalance: false,
      rawBalance: '0',
      error: error.message,
      network: networkId
    };
  }
}

/**
 * Get multiple token balances for a wallet with rate limiting on specified network
 */
async function getMultipleTokenBalances(walletAddress, tokenAddresses, networkId = 'ethereum') {
  if (!isValidEthereumAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }
  
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    throw new Error('Token addresses must be a non-empty array');
  }

  if (!isNetworkSupported(networkId)) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  
  const networkConfig = getNetworkConfig(networkId);
  const timer = new PerformanceTimer(`MultipleTokenBalances-${tokenAddresses.length}tokens-${networkConfig.name}`);
  const results = [];
  
  try {
    logDebug(`Starting multi-token balance check on ${networkConfig.name}`, {
      walletAddress: walletAddress.substring(0, 10) + '...',
      tokenCount: tokenAddresses.length,
      network: networkConfig.name
    });

    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i];
      
      if (!isValidEthereumAddress(tokenAddress)) {
        logError(`Invalid token address: ${tokenAddress}`);
        results.push({
          tokenAddress,
          balance: '0',
          hasBalance: false,
          error: 'Invalid token address',
          network: networkId
        });
        continue;
      }
      
      try {
        const balanceData = await getTokenBalance(walletAddress, tokenAddress, networkId);
        results.push({
          tokenAddress,
          ...balanceData
        });
        
      } catch (error) {
        logError(`Failed to get balance for token ${tokenAddress} on ${networkConfig.name}`, error);
        results.push({
          tokenAddress,
          balance: '0',
          hasBalance: false,
          error: error.message,
          network: networkId
        });
      }
      
      // Add delay between token checks to respect rate limits
      // Use network-specific delay multiplier
      const delayMultiplier = ANALYSIS_CONFIG.NETWORK_DELAYS[networkId] || 1.0;
      const adjustedDelay = Math.round(API_CONFIG.RATE_LIMITS.TOKEN_DELAY * delayMultiplier);
      
      if (i < tokenAddresses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, adjustedDelay));
      }
    }
    
    timer.end();
    
    const successCount = results.filter(r => !r.error).length;
    const foundCount = results.filter(r => r.hasBalance).length;
    
    logDebug(`Multiple token balances completed on ${networkConfig.name}`, {
      walletAddress: walletAddress.substring(0, 10) + '...',
      totalTokens: tokenAddresses.length,
      successfulCalls: successCount,
      tokensFound: foundCount,
      network: networkConfig.name
    });
    
    return results;
    
  } catch (error) {
    timer.end();
    logError(`Failed to get multiple token balances on ${networkConfig.name}`, error);
    throw error;
  }
}

/**
 * Call contract function via network proxy
 */
async function callContractFunction(contractAddress, functionData, networkId = 'ethereum') {
  if (!isValidEthereumAddress(contractAddress)) {
    throw new Error('Invalid contract address');
  }

  if (!isNetworkSupported(networkId)) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  
  try {
    const networkConfig = getNetworkConfig(networkId);
    const url = `${networkConfig.apiUrl}?module=proxy&action=eth_call&to=${contractAddress}&data=${functionData}&tag=latest&apikey=${networkConfig.apiKey}`;
    
    const data = await makeApiCall(url, `eth_call-${functionData.substring(0, 10)}`, networkId);
    
    if (data.result && data.result !== '0x' && data.result !== '0x0') {
      return data.result;
    }
    
    return null;
    
  } catch (error) {
    const networkConfig = getNetworkConfig(networkId);
    logDebug(`Contract function call failed on ${networkConfig.name}`, {
      contractAddress: contractAddress.substring(0, 10) + '...',
      functionData,
      error: error.message,
      network: networkConfig.name
    });
    return null;
  }
}

/**
 * Get token name from contract on specified network
 */
async function getTokenName(tokenAddress, networkId = 'ethereum') {
  try {
    const result = await callContractFunction(tokenAddress, CONTRACT_FUNCTIONS.NAME, networkId);
    if (result) {
      const { hexToString } = require('../utils/helpers');
      return hexToString(result);
    }
    return null;
  } catch (error) {
    const networkConfig = getNetworkConfig(networkId);
    logDebug(`Failed to get token name for ${tokenAddress} on ${networkConfig.name}`, { 
      error: error.message,
      network: networkConfig.name 
    });
    return null;
  }
}

/**
 * Get token symbol from contract on specified network
 */
async function getTokenSymbol(tokenAddress, networkId = 'ethereum') {
  try {
    const result = await callContractFunction(tokenAddress, CONTRACT_FUNCTIONS.SYMBOL, networkId);
    if (result) {
      const { hexToString } = require('../utils/helpers');
      return hexToString(result);
    }
    return null;
  } catch (error) {
    const networkConfig = getNetworkConfig(networkId);
    logDebug(`Failed to get token symbol for ${tokenAddress} on ${networkConfig.name}`, { 
      error: error.message,
      network: networkConfig.name 
    });
    return null;
  }
}

/**
 * Get token decimals from contract on specified network
 */
async function getTokenDecimals(tokenAddress, networkId = 'ethereum') {
  try {
    const result = await callContractFunction(tokenAddress, CONTRACT_FUNCTIONS.DECIMALS, networkId);
    if (result) {
      const decimals = parseInt(result, 16);
      return isNaN(decimals) ? ANALYSIS_CONFIG.DEFAULT_DECIMALS : decimals;
    }
    return ANALYSIS_CONFIG.DEFAULT_DECIMALS;
  } catch (error) {
    const networkConfig = getNetworkConfig(networkId);
    logDebug(`Failed to get token decimals for ${tokenAddress} on ${networkConfig.name}`, { 
      error: error.message,
      network: networkConfig.name 
    });
    return ANALYSIS_CONFIG.DEFAULT_DECIMALS;
  }
}

/**
 * POPRAWIONA SEKCJA getTokenInfo w services/etherscan.js
 * Zastąp funkcję getTokenInfo w swoim pliku tą wersją
 */

/**
 * Get comprehensive token information on specified network with USD pricing - POPRAWIONA WERSJA
 */
async function getTokenInfo(tokenAddress, networkId = 'ethereum', includePricing = true) {
  if (!isValidEthereumAddress(tokenAddress)) {
    throw new Error('Invalid token address');
  }

  if (!isNetworkSupported(networkId)) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  
  const networkConfig = getNetworkConfig(networkId);
  const lowerAddress = tokenAddress.toLowerCase();
  
  // Check network-specific database first
  const tokenDatabase = getTokenDatabase(networkId);
  let tokenInfo;
  
  if (tokenDatabase[lowerAddress]) {
    logDebug(`Token found in ${networkConfig.name} database: ${tokenDatabase[lowerAddress].symbol}`);
    tokenInfo = {
      address: tokenAddress,
      ...tokenDatabase[lowerAddress],
      source: 'database',
      network: networkId,
      networkName: networkConfig.name
    };
  } else {
    // Try to get info from contract
    try {
      const [name, symbol, decimals] = await Promise.all([
        getTokenName(tokenAddress, networkId),
        getTokenSymbol(tokenAddress, networkId),
        getTokenDecimals(tokenAddress, networkId)
      ]);
      
      if (symbol || name) {
        tokenInfo = {
          address: tokenAddress,
          symbol: symbol || `Token_${tokenAddress.substring(0, 6)}...`,
          name: name || `Token: ${tokenAddress.substring(0, 10)}...${tokenAddress.slice(-4)}`,
          decimals: decimals,
          source: 'contract',
          network: networkId,
          networkName: networkConfig.name
        };
        
        logDebug(`Token info retrieved from ${networkConfig.name} contract`, tokenInfo);
      } else {
        // Fallback to basic info
        tokenInfo = {
          address: tokenAddress,
          symbol: `${tokenAddress.substring(0, 6)}...`,
          name: `Token: ${tokenAddress.substring(0, 10)}...${tokenAddress.slice(-4)}`,
          decimals: ANALYSIS_CONFIG.DEFAULT_DECIMALS,
          source: 'fallback',
          network: networkId,
          networkName: networkConfig.name
        };
      }
    } catch (error) {
      logDebug(`Failed to get token info from ${networkConfig.name} contract`, { 
        error: error.message,
        network: networkConfig.name 
      });
      
      // Fallback to basic info
      tokenInfo = {
        address: tokenAddress,
        symbol: `${tokenAddress.substring(0, 6)}...`,
        name: `Token: ${tokenAddress.substring(0, 10)}...${tokenAddress.slice(-4)}`,
        decimals: ANALYSIS_CONFIG.DEFAULT_DECIMALS,
        source: 'fallback',
        network: networkId,
        networkName: networkConfig.name
      };
    }
  }
  
  // POPRAWIONA SEKCJA: Add pricing information from DexScreener if requested
  if (includePricing) {
    logDebug(`Attempting to fetch price data for ${tokenInfo.symbol} on ${networkConfig.name}`, {
      tokenAddress: tokenAddress.substring(0, 10) + '...',
      network: networkId
    });
    
    try {
      const priceData = await dexScreenerService.getTokenPrice(tokenAddress, networkId);
      
      if (priceData && !priceData.error && priceData.priceUsd !== null) {
        tokenInfo.priceUsd = priceData.priceUsd;
        tokenInfo.priceChange24h = priceData.priceChange24h;
        tokenInfo.volume24h = priceData.volume24h;
        tokenInfo.dexId = priceData.dexId;
        tokenInfo.pairAddress = priceData.pairAddress;
        tokenInfo.priceSource = priceData.source || 'dexscreener';
        
        logDebug(`✅ Price data added successfully for ${tokenInfo.symbol}`, {
          priceUsd: tokenInfo.priceUsd,
          priceChange24h: tokenInfo.priceChange24h,
          source: tokenInfo.priceSource,
          network: networkConfig.name
        });
      } else {
        tokenInfo.priceUsd = null;
        tokenInfo.priceChange24h = null;
        tokenInfo.priceSource = null;
        tokenInfo.priceError = priceData?.error || 'Price data unavailable';
        
        logDebug(`❌ No price data available for ${tokenInfo.symbol}`, {
          error: priceData?.error,
          network: networkConfig.name
        });
      }
    } catch (priceError) {
      logError(`Failed to fetch price data for token ${tokenAddress} on ${networkConfig.name}`, priceError);
      tokenInfo.priceUsd = null;
      tokenInfo.priceChange24h = null;
      tokenInfo.priceSource = null;
      tokenInfo.priceError = `Price fetch failed: ${priceError.message}`;
    }
  } else {
    // Jeśli pricing nie jest wymagane, ustaw wartości null
    tokenInfo.priceUsd = null;
    tokenInfo.priceChange24h = null;
    tokenInfo.priceSource = null;
  }
  
  return tokenInfo;
}

/**
 * POPRAWIONA WERSJA getMultipleTokenInfo
 */
async function getMultipleTokenInfo(tokenAddresses, networkId = 'ethereum', includePricing = true) {
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    return [];
  }

  if (!isNetworkSupported(networkId)) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  
  const networkConfig = getNetworkConfig(networkId);
  const timer = new PerformanceTimer(`Multiple Token Info - ${tokenAddresses.length} tokens on ${networkConfig.name}`);
  
  try {
    logDebug(`🔄 Fetching multiple token info on ${networkConfig.name}`, {
      tokenCount: tokenAddresses.length,
      includePricing: includePricing,
      network: networkConfig.name
    });
    
    // Get all token info without pricing first
    const tokenInfoPromises = tokenAddresses.map(address => 
      getTokenInfo(address, networkId, false) // Don't include pricing yet
    );
    
    const tokenInfos = await Promise.all(tokenInfoPromises);
    
    // If pricing is requested, fetch all prices using the improved DexScreener service
    if (includePricing) {
      try {
        logDebug(`🔄 Fetching batch price data for ${tokenAddresses.length} tokens on ${networkConfig.name}`);
        
        const priceDataArray = await dexScreenerService.getMultipleTokenPrices(tokenAddresses, networkId);
        
        // Merge price data with token info
        tokenInfos.forEach((tokenInfo, index) => {
          const priceData = priceDataArray.find(p => 
            p.address.toLowerCase() === tokenInfo.address.toLowerCase()
          );
          
          if (priceData && !priceData.error && priceData.priceUsd !== null) {
            tokenInfo.priceUsd = priceData.priceUsd;
            tokenInfo.priceChange24h = priceData.priceChange24h;
            tokenInfo.volume24h = priceData.volume24h;
            tokenInfo.dexId = priceData.dexId;
            tokenInfo.pairAddress = priceData.pairAddress;
            tokenInfo.priceSource = priceData.source || 'dexscreener';
            
            logDebug(`✅ Price merged for ${tokenInfo.symbol}: $${tokenInfo.priceUsd}`, {
              network: networkConfig.name
            });
          } else {
            tokenInfo.priceUsd = null;
            tokenInfo.priceChange24h = null;
            tokenInfo.priceSource = null;
            tokenInfo.priceError = priceData?.error || 'Price data unavailable';
            
            logDebug(`❌ No price data for ${tokenInfo.symbol}`, {
              error: priceData?.error,
              network: networkConfig.name
            });
          }
        });
        
        const successfulPrices = tokenInfos.filter(t => t.priceUsd !== null && t.priceUsd > 0).length;
        logDebug(`💰 Price data summary: ${successfulPrices}/${tokenInfos.length} tokens have USD prices`, {
          network: networkConfig.name
        });
        
      } catch (priceError) {
        logError(`Failed to fetch batch price data for ${networkConfig.name}`, priceError);
        
        // Set all tokens to have no pricing data but don't fail the whole operation
        tokenInfos.forEach(tokenInfo => {
          tokenInfo.priceUsd = null;
          tokenInfo.priceChange24h = null;
          tokenInfo.priceSource = null;
          tokenInfo.priceError = `Batch price fetch failed: ${priceError.message}`;
        });
      }
    }
    
    timer.end();
    
    logDebug(`✅ Multiple token info completed for ${networkConfig.name}`, {
      totalTokens: tokenInfos.length,
      withPricing: includePricing,
      tokensWithPrices: includePricing ? tokenInfos.filter(t => t.priceUsd !== null).length : 0,
      network: networkConfig.name
    });
    
    return tokenInfos;
    
  } catch (error) {
    timer.end();
    logError(`Failed to get multiple token info for ${networkConfig.name}`, error);
    throw error;
  }
}
      
      // Fallback to basic info
      tokenInfo = {
        address: tokenAddress,
        symbol: `${tokenAddress.substring(0, 6)}...`,
        name: `Token: ${tokenAddress.substring(0, 10)}...${tokenAddress.slice(-4)}`,
        decimals: ANALYSIS_CONFIG.DEFAULT_DECIMALS,
        source: 'fallback',
        network: networkId,
        networkName: networkConfig.name
      };
    }
  }
  
  // Add pricing information from DexScreener if requested
  if (includePricing) {
    try {
      const priceData = await dexScreenerService.getTokenPrice(tokenAddress, networkId);
      
      if (priceData && !priceData.error) {
        tokenInfo.priceUsd = priceData.priceUsd;
        tokenInfo.priceChange24h = priceData.priceChange24h;
        tokenInfo.volume24h = priceData.volume24h;
        tokenInfo.dexId = priceData.dexId;
        tokenInfo.pairAddress = priceData.pairAddress;
        tokenInfo.priceSource = 'dexscreener';
        
        logDebug(`Added price data to token info for ${tokenInfo.symbol}`, {
          priceUsd: tokenInfo.priceUsd,
          priceChange24h: tokenInfo.priceChange24h,
          network: networkConfig.name
        });
      } else {
        tokenInfo.priceUsd = null;
        tokenInfo.priceChange24h = null;
        tokenInfo.priceSource = null;
        tokenInfo.priceError = priceData?.error || 'Price data unavailable';
        
        logDebug(`Failed to get price data for ${tokenInfo.symbol}`, {
          error: priceData?.error,
          network: networkConfig.name
        });
      }
    } catch (priceError) {
      logError(`Failed to fetch price data for token ${tokenAddress} on ${networkConfig.name}`, priceError);
      tokenInfo.priceUsd = null;
      tokenInfo.priceChange24h = null;
      tokenInfo.priceSource = null;
      tokenInfo.priceError = priceError.message;
    }
  }
  
  return tokenInfo;
}

/**
 * Get multiple token information with pricing efficiently
 * @param {Array} tokenAddresses - Array of token contract addresses
 * @param {string} networkId - Network identifier
 * @param {boolean} includePricing - Whether to include USD pricing
 * @returns {Promise<Array>} Array of token info with pricing
 */
async function getMultipleTokenInfo(tokenAddresses, networkId = 'ethereum', includePricing = true) {
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    return [];
  }

  if (!isNetworkSupported(networkId)) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  
  const networkConfig = getNetworkConfig(networkId);
  const timer = new PerformanceTimer(`Multiple Token Info - ${tokenAddresses.length} tokens on ${networkConfig.name}`);
  
  try {
    logDebug(`Fetching multiple token info on ${networkConfig.name}`, {
      tokenCount: tokenAddresses.length,
      includePricing: includePricing,
      network: networkConfig.name
    });
    
    // Get all token info without pricing first
    const tokenInfoPromises = tokenAddresses.map(address => 
      getTokenInfo(address, networkId, false) // Don't include pricing yet
    );
    
    const tokenInfos = await Promise.all(tokenInfoPromises);
    
    // If pricing is requested, fetch all prices in batches
    if (includePricing) {
      try {
        const priceDataArray = await dexScreenerService.getMultipleTokenPrices(tokenAddresses, networkId);
        
        // Merge price data with token info
        tokenInfos.forEach((tokenInfo, index) => {
          const priceData = priceDataArray.find(p => 
            p.address.toLowerCase() === tokenInfo.address.toLowerCase()
          );
          
          if (priceData && !priceData.error) {
            tokenInfo.priceUsd = priceData.priceUsd;
            tokenInfo.priceChange24h = priceData.priceChange24h;
            tokenInfo.volume24h = priceData.volume24h;
            tokenInfo.dexId = priceData.dexId;
            tokenInfo.pairAddress = priceData.pairAddress;
            tokenInfo.priceSource = 'dexscreener';
          } else {
            tokenInfo.priceUsd = null;
            tokenInfo.priceChange24h = null;
            tokenInfo.priceSource = null;
            tokenInfo.priceError = priceData?.error || 'Price data unavailable';
          }
        });
        
        const successfulPrices = tokenInfos.filter(t => t.priceUsd !== null).length;
        logDebug(`Added price data to ${successfulPrices}/${tokenInfos.length} tokens`, {
          network: networkConfig.name
        });
        
      } catch (priceError) {
        logError(`Failed to fetch batch price data for ${networkConfig.name}`, priceError);
        
        // Set all tokens to have no pricing data
        tokenInfos.forEach(tokenInfo => {
          tokenInfo.priceUsd = null;
          tokenInfo.priceChange24h = null;
          tokenInfo.priceSource = null;
          tokenInfo.priceError = priceError.message;
        });
      }
    }
    
    timer.end();
    
    logDebug(`Multiple token info completed for ${networkConfig.name}`, {
      totalTokens: tokenInfos.length,
      withPricing: includePricing,
      network: networkConfig.name
    });
    
    return tokenInfos;
    
  } catch (error) {
    timer.end();
    logError(`Failed to get multiple token info for ${networkConfig.name}`, error);
    throw error;
  }
}

// Legacy functions for backward compatibility (default to Ethereum)
const legacyGetTokenBalance = (walletAddress, tokenAddress, decimals = null) => 
  getTokenBalance(walletAddress, tokenAddress, 'ethereum', decimals);

const legacyGetMultipleTokenBalances = (walletAddress, tokenAddresses) => 
  getMultipleTokenBalances(walletAddress, tokenAddresses, 'ethereum');

const legacyCallContractFunction = (contractAddress, functionData) => 
  callContractFunction(contractAddress, functionData, 'ethereum');

const legacyGetTokenName = (tokenAddress) => 
  getTokenName(tokenAddress, 'ethereum');

const legacyGetTokenSymbol = (tokenAddress) => 
  getTokenSymbol(tokenAddress, 'ethereum');

const legacyGetTokenDecimals = (tokenAddress) => 
  getTokenDecimals(tokenAddress, 'ethereum');

const legacyGetTokenInfo = (tokenAddress) => 
  getTokenInfo(tokenAddress, 'ethereum');
/**
 * Get multiple token information with pricing efficiently
 * @param {Array} tokenAddresses - Array of token contract addresses
 * @param {string} networkId - Network identifier
 * @param {boolean} includePricing - Whether to include USD pricing
 * @returns {Promise<Array>} Array of token info with pricing
 */
async function getMultipleTokenInfo(tokenAddresses, networkId = 'ethereum', includePricing = true) {
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    return [];
  }

  if (!isNetworkSupported(networkId)) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  
  const networkConfig = getNetworkConfig(networkId);
  const timer = new PerformanceTimer(`Multiple Token Info - ${tokenAddresses.length} tokens on ${networkConfig.name}`);
  
  try {
    logDebug(`Fetching multiple token info on ${networkConfig.name}`, {
      tokenCount: tokenAddresses.length,
      includePricing: includePricing,
      network: networkConfig.name
    });
    
    // Get all token info without pricing first
    const tokenInfoPromises = tokenAddresses.map(address => 
      getTokenInfo(address, networkId, false) // Don't include pricing yet
    );
    
    const tokenInfos = await Promise.all(tokenInfoPromises);
    
    // If pricing is requested, fetch all prices in batches
    if (includePricing) {
      try {
        const priceDataArray = await dexScreenerService.getMultipleTokenPrices(tokenAddresses, networkId);
        
        // Merge price data with token info
        tokenInfos.forEach((tokenInfo, index) => {
          const priceData = priceDataArray.find(p => 
            p.address.toLowerCase() === tokenInfo.address.toLowerCase()
          );
          
          if (priceData && !priceData.error) {
            tokenInfo.priceUsd = priceData.priceUsd;
            tokenInfo.priceChange24h = priceData.priceChange24h;
            tokenInfo.volume24h = priceData.volume24h;
            tokenInfo.dexId = priceData.dexId;
            tokenInfo.pairAddress = priceData.pairAddress;
            tokenInfo.priceSource = 'dexscreener';
          } else {
            tokenInfo.priceUsd = null;
            tokenInfo.priceChange24h = null;
            tokenInfo.priceSource = null;
            tokenInfo.priceError = priceData?.error || 'Price data unavailable';
          }
        });
        
        const successfulPrices = tokenInfos.filter(t => t.priceUsd !== null).length;
        logDebug(`Added price data to ${successfulPrices}/${tokenInfos.length} tokens`, {
          network: networkConfig.name
        });
        
      } catch (priceError) {
        logError(`Failed to fetch batch price data for ${networkConfig.name}`, priceError);
        
        // Set all tokens to have no pricing data
        tokenInfos.forEach(tokenInfo => {
          tokenInfo.priceUsd = null;
          tokenInfo.priceChange24h = null;
          tokenInfo.priceSource = null;
          tokenInfo.priceError = priceError.message;
        });
      }
    }
    
    timer.end();
    
    logDebug(`Multiple token info completed for ${networkConfig.name}`, {
      totalTokens: tokenInfos.length,
      withPricing: includePricing,
      network: networkConfig.name
    });
    
    return tokenInfos;
    
  } catch (error) {
    timer.end();
    logError(`Failed to get multiple token info for ${networkConfig.name}`, error);
    throw error;
  }
}
module.exports = {
  // Multi-chain functions (with network parameter)
  getTokenBalance,
  getMultipleTokenBalances,
  callContractFunction,
  getTokenName,
  getTokenSymbol,
  getTokenDecimals,
  getTokenInfo,
  getMultipleTokenInfo,
  
  // Legacy functions for backward compatibility (Ethereum only)
  getTokenBalanceLegacy: legacyGetTokenBalance,
  getMultipleTokenBalancesLegacy: legacyGetMultipleTokenBalances,
  callContractFunctionLegacy: legacyCallContractFunction,
  getTokenNameLegacy: legacyGetTokenName,
  getTokenSymbolLegacy: legacyGetTokenSymbol,
  getTokenDecimalsLegacy: legacyGetTokenDecimals,
  getTokenInfoLegacy: legacyGetTokenInfo
};
