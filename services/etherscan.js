/**
 * Etherscan API Service
 * Professional service for interacting with Etherscan API with proper error handling
 */

const { API_CONFIG, CONTRACT_FUNCTIONS, ANALYSIS_CONFIG, TOKEN_DATABASE } = require('../config/constants');
const { weiToTokens, retryWithBackoff, isValidEthereumAddress } = require('../utils/helpers');
const { logDebug, logError, PerformanceTimer } = require('../utils/debugger');

/**
 * Base API call function with retry logic
 */
async function makeApiCall(url, operation) {
  const timer = new PerformanceTimer(`Etherscan API: ${operation}`);
  
  try {
    const response = await retryWithBackoff(async () => {
      logDebug(`Making API call: ${operation}`, { url });
      
      const res = await fetch(url, {
        timeout: ANALYSIS_CONFIG.TIMEOUT_MS,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Ethereum-Wallet-Analyzer/2.1.0'
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
      // Handle specific Etherscan error messages
      if (data.message === 'NOTOK' && data.result && data.result.includes('Max rate limit reached')) {
        throw new Error('Rate limit exceeded');
      }
      if (data.message === 'NOTOK' && data.result && data.result.includes('Invalid API Key')) {
        throw new Error('Invalid API key');
      }
      
      logDebug(`API returned status ${data.status}`, { message: data.message, result: data.result });
    }
    
    return data;
    
  } catch (error) {
    timer.end();
    logError(`API call failed: ${operation}`, error);
    throw error;
  }
}

/**
 * Get token balance for a wallet
 */
async function getTokenBalance(walletAddress, tokenAddress, decimals = null) {
  if (!isValidEthereumAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }
  
  if (!isValidEthereumAddress(tokenAddress)) {
    throw new Error('Invalid token address');
  }
  
  try {
    const url = `${API_CONFIG.ETHERSCAN_API}?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${walletAddress}&tag=latest&apikey=${API_CONFIG.ETHERSCAN_API_KEY}`;
    
    const data = await makeApiCall(url, `tokenbalance-${tokenAddress.substring(0, 8)}`);
    
    if (data.status !== '1') {
      logDebug('Token balance check returned non-success status', {
        walletAddress: walletAddress.substring(0, 10) + '...',
        tokenAddress: tokenAddress.substring(0, 10) + '...',
        status: data.status,
        message: data.message
      });
      return {
        balance: '0',
        hasBalance: false,
        rawBalance: '0'
      };
    }
    
    const rawBalance = data.result || '0';
    
    // Auto-detect decimals if not provided
    if (decimals === null) {
      // Check local database first
      const knownToken = TOKEN_DATABASE[tokenAddress.toLowerCase()];
      if (knownToken && knownToken.decimals) {
        decimals = knownToken.decimals;
      } else {
        // Try to get decimals from contract
        try {
          decimals = await getTokenDecimals(tokenAddress);
        } catch {
          decimals = ANALYSIS_CONFIG.DEFAULT_DECIMALS; // Fallback to 18
        }
      }
    }
    
    const formattedBalance = weiToTokens(rawBalance, decimals);
    const hasBalance = parseFloat(formattedBalance) > ANALYSIS_CONFIG.MIN_BALANCE_THRESHOLD;
    
    logDebug('Token balance retrieved', {
      walletAddress: walletAddress.substring(0, 10) + '...',
      tokenAddress: tokenAddress.substring(0, 10) + '...',
      rawBalance,
      formattedBalance,
      decimals,
      hasBalance
    });
    
    return {
      balance: formattedBalance,
      hasBalance,
      rawBalance,
      decimals
    };
    
  } catch (error) {
    logError('Failed to get token balance', error, {
      walletAddress: walletAddress.substring(0, 10) + '...',
      tokenAddress: tokenAddress.substring(0, 10) + '...'
    });
    
    return {
      balance: '0',
      hasBalance: false,
      rawBalance: '0',
      error: error.message
    };
  }
}

/**
 * Get multiple token balances for a wallet with rate limiting
 */
async function getMultipleTokenBalances(walletAddress, tokenAddresses) {
  if (!isValidEthereumAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }
  
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    throw new Error('Token addresses must be a non-empty array');
  }
  
  const timer = new PerformanceTimer(`MultipleTokenBalances-${tokenAddresses.length}tokens`);
  const results = [];
  
  try {
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i];
      
      if (!isValidEthereumAddress(tokenAddress)) {
        logError(`Invalid token address: ${tokenAddress}`);
        results.push({
          tokenAddress,
          balance: '0',
          hasBalance: false,
          error: 'Invalid token address'
        });
        continue;
      }
      
      try {
        const balanceData = await getTokenBalance(walletAddress, tokenAddress);
        results.push({
          tokenAddress,
          ...balanceData
        });
        
      } catch (error) {
        logError(`Failed to get balance for token ${tokenAddress}`, error);
        results.push({
          tokenAddress,
          balance: '0',
          hasBalance: false,
          error: error.message
        });
      }
      
      // Add delay between token checks to respect rate limits
      if (i < tokenAddresses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, API_CONFIG.RATE_LIMITS.TOKEN_DELAY));
      }
    }
    
    timer.end();
    
    const successCount = results.filter(r => !r.error).length;
    const foundCount = results.filter(r => r.hasBalance).length;
    
    logDebug('Multiple token balances completed', {
      walletAddress: walletAddress.substring(0, 10) + '...',
      totalTokens: tokenAddresses.length,
      successfulCalls: successCount,
      tokensFound: foundCount
    });
    
    return results;
    
  } catch (error) {
    timer.end();
    logError('Failed to get multiple token balances', error);
    throw error;
  }
}

/**
 * Call contract function via Etherscan proxy
 */
async function callContractFunction(contractAddress, functionData) {
  if (!isValidEthereumAddress(contractAddress)) {
    throw new Error('Invalid contract address');
  }
  
  try {
    const url = `${API_CONFIG.ETHERSCAN_API}?module=proxy&action=eth_call&to=${contractAddress}&data=${functionData}&tag=latest&apikey=${API_CONFIG.ETHERSCAN_API_KEY}`;
    
    const data = await makeApiCall(url, `eth_call-${functionData.substring(0, 10)}`);
    
    if (data.result && data.result !== '0x' && data.result !== '0x0') {
      return data.result;
    }
    
    return null;
    
  } catch (error) {
    logDebug('Contract function call failed', {
      contractAddress: contractAddress.substring(0, 10) + '...',
      functionData,
      error: error.message
    });
    return null;
  }
}

/**
 * Get token name from contract
 */
async function getTokenName(tokenAddress) {
  try {
    const result = await callContractFunction(tokenAddress, CONTRACT_FUNCTIONS.NAME);
    if (result) {
      const { hexToString } = require('../utils/helpers');
      return hexToString(result);
    }
    return null;
  } catch (error) {
    logDebug(`Failed to get token name for ${tokenAddress}`, { error: error.message });
    return null;
  }
}

/**
 * Get token symbol from contract
 */
async function getTokenSymbol(tokenAddress) {
  try {
    const result = await callContractFunction(tokenAddress, CONTRACT_FUNCTIONS.SYMBOL);
    if (result) {
      const { hexToString } = require('../utils/helpers');
      return hexToString(result);
    }
    return null;
  } catch (error) {
    logDebug(`Failed to get token symbol for ${tokenAddress}`, { error: error.message });
    return null;
  }
}

/**
 * Get token decimals from contract
 */
async function getTokenDecimals(tokenAddress) {
  try {
    const result = await callContractFunction(tokenAddress, CONTRACT_FUNCTIONS.DECIMALS);
    if (result) {
      const decimals = parseInt(result, 16);
      return isNaN(decimals) ? ANALYSIS_CONFIG.DEFAULT_DECIMALS : decimals;
    }
    return ANALYSIS_CONFIG.DEFAULT_DECIMALS;
  } catch (error) {
    logDebug(`Failed to get token decimals for ${tokenAddress}`, { error: error.message });
    return ANALYSIS_CONFIG.DEFAULT_DECIMALS;
  }
}

/**
 * Get comprehensive token information
 */
async function getTokenInfo(tokenAddress) {
  if (!isValidEthereumAddress(tokenAddress)) {
    throw new Error('Invalid token address');
  }
  
  const lowerAddress = tokenAddress.toLowerCase();
  
  // Check local database first
  if (TOKEN_DATABASE[lowerAddress]) {
    logDebug(`Token found in local database: ${TOKEN_DATABASE[lowerAddress].symbol}`);
    return {
      address: tokenAddress,
      ...TOKEN_DATABASE[lowerAddress],
      source: 'database'
    };
  }
  
  // Try to get info from contract
  try {
    const [name, symbol, decimals] = await Promise.all([
      getTokenName(tokenAddress),
      getTokenSymbol(tokenAddress),
      getTokenDecimals(tokenAddress)
    ]);
    
    if (symbol || name) {
      const tokenInfo = {
        address: tokenAddress,
        symbol: symbol || `Token_${tokenAddress.substring(0, 6)}...`,
        name: name || `Token: ${tokenAddress.substring(0, 10)}...${tokenAddress.slice(-4)}`,
        decimals: decimals,
        source: 'contract'
      };
      
      logDebug('Token info retrieved from contract', tokenInfo);
      return tokenInfo;
    }
  } catch (error) {
    logDebug('Failed to get token info from contract', { error: error.message });
  }
  
  // Fallback to basic info
  return {
    address: tokenAddress,
    symbol: `${tokenAddress.substring(0, 6)}...`,
    name: `Token: ${tokenAddress.substring(0, 10)}...${tokenAddress.slice(-4)}`,
    decimals: ANALYSIS_CONFIG.DEFAULT_DECIMALS,
    source: 'fallback'
  };
}

module.exports = {
  getTokenBalance,
  getMultipleTokenBalances,
  callContractFunction,
  getTokenName,
  getTokenSymbol,
  getTokenDecimals,
  getTokenInfo
};
