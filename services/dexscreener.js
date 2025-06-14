/**
 * DexScreener API Service
 * Professional service for fetching real-time token prices and market data
 * Supports multiple blockchain networks including Ethereum and Base
 */

const { getNetworkConfig, isNetworkSupported, API_CONFIG } = require('../config/constants');
const { logDebug, logError, PerformanceTimer } = require('../utils/debugger');

/**
 * Network mapping for DexScreener API
 */
const DEXSCREENER_NETWORK_MAP = {
  'ethereum': 'ethereum',
  'base': 'base'
};

/**
 * Get DexScreener network identifier
 */
function getDexScreenerNetworkId(networkId) {
  return DEXSCREENER_NETWORK_MAP[networkId] || 'ethereum';
}

/**
 * Make API call to DexScreener with error handling
 */
async function makeDexScreenerApiCall(url, operation) {
  const timer = new PerformanceTimer(`DexScreener API: ${operation}`);
  
  try {
    logDebug(`Making DexScreener API call`, { url, operation });
    
    const response = await fetch(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Wallet-Analyzer/2.2.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    timer.end();
    
    if (!data) {
      throw new Error('No data received from DexScreener API');
    }
    
    return data;
    
  } catch (error) {
    timer.end();
    logError(`DexScreener API call failed: ${operation}`, error);
    throw error;
  }
}

/**
 * Get token price from DexScreener
 * @param {string} tokenAddress - Token contract address
 * @param {string} networkId - Network identifier (ethereum, base)
 * @returns {Promise<Object>} Token price data
 */
async function getTokenPrice(tokenAddress, networkId = 'ethereum') {
  if (!isNetworkSupported(networkId)) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  
  try {
    const dexScreenerNetwork = getDexScreenerNetworkId(networkId);
    const networkConfig = getNetworkConfig(networkId);
    
    // DexScreener API endpoint for single token
    const url = `${API_CONFIG.DEXSCREENER_API}/dex/tokens/${dexScreenerNetwork}:${tokenAddress}`;
    
    const data = await makeDexScreenerApiCall(url, `token-price-${tokenAddress.substring(0, 8)}`);
    
    if (!data.pairs || data.pairs.length === 0) {
      logDebug(`No trading pairs found for token ${tokenAddress} on ${networkConfig.name}`);
      return {
        address: tokenAddress,
        network: networkId,
        networkName: networkConfig.name,
        priceUsd: null,
        priceChange24h: null,
        volume24h: null,
        source: 'dexscreener',
        error: 'No trading pairs found'
      };
    }
    
    // Get the most liquid pair (highest volume)
    const bestPair = data.pairs.reduce((best, current) => {
      const currentVolume = parseFloat(current.volume?.h24 || 0);
      const bestVolume = parseFloat(best.volume?.h24 || 0);
      return currentVolume > bestVolume ? current : best;
    });
    
    const priceUsd = parseFloat(bestPair.priceUsd) || 0;
    const priceChange24h = parseFloat(bestPair.priceChange?.h24) || 0;
    const volume24h = parseFloat(bestPair.volume?.h24) || 0;
    
    logDebug(`Token price retrieved from DexScreener`, {
      tokenAddress: tokenAddress.substring(0, 10) + '...',
      network: networkConfig.name,
      priceUsd: priceUsd,
      priceChange24h: priceChange24h,
      dexName: bestPair.dexId,
      pairAddress: bestPair.pairAddress
    });
    
    return {
      address: tokenAddress,
      network: networkId,
      networkName: networkConfig.name,
      priceUsd: priceUsd,
      priceChange24h: priceChange24h,
      volume24h: volume24h,
      dexId: bestPair.dexId,
      pairAddress: bestPair.pairAddress,
      baseToken: bestPair.baseToken,
      quoteToken: bestPair.quoteToken,
      source: 'dexscreener'
    };
    
  } catch (error) {
    const networkConfig = getNetworkConfig(networkId);
    logError(`Failed to get token price from DexScreener for ${networkConfig.name}`, error, {
      tokenAddress: tokenAddress.substring(0, 10) + '...',
      network: networkConfig.name
    });
    
    return {
      address: tokenAddress,
      network: networkId,
      networkName: networkConfig.name,
      priceUsd: null,
      priceChange24h: null,
      volume24h: null,
      source: 'dexscreener',
      error: error.message
    };
  }
}

/**
 * Get multiple token prices from DexScreener
 * @param {Array} tokenAddresses - Array of token contract addresses
 * @param {string} networkId - Network identifier
 * @returns {Promise<Array>} Array of token price data
 */
async function getMultipleTokenPrices(tokenAddresses, networkId = 'ethereum') {
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    return [];
  }
  
  if (!isNetworkSupported(networkId)) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  
  const networkConfig = getNetworkConfig(networkId);
  const dexScreenerNetwork = getDexScreenerNetworkId(networkId);
  const timer = new PerformanceTimer(`DexScreener Multiple Prices - ${tokenAddresses.length} tokens on ${networkConfig.name}`);
  
  try {
    logDebug(`Fetching multiple token prices from DexScreener`, {
      tokenCount: tokenAddresses.length,
      network: networkConfig.name
    });
    
    // DexScreener supports up to 30 tokens per request
    const batchSize = 30;
    const results = [];
    
    for (let i = 0; i < tokenAddresses.length; i += batchSize) {
      const batch = tokenAddresses.slice(i, i + batchSize);
      
      // Format addresses with network prefix
      const formattedAddresses = batch.map(addr => `${dexScreenerNetwork}:${addr}`);
      const addressesParam = formattedAddresses.join(',');
      
      const url = `${API_CONFIG.DEXSCREENER_API}/dex/tokens/${addressesParam}`;
      
      try {
        const data = await makeDexScreenerApiCall(url, `batch-prices-${i / batchSize + 1}`);
        
        // Process each token in the batch
        for (const tokenAddress of batch) {
          const tokenPairs = data.pairs?.filter(pair => 
            pair.baseToken?.address?.toLowerCase() === tokenAddress.toLowerCase() ||
            pair.quoteToken?.address?.toLowerCase() === tokenAddress.toLowerCase()
          ) || [];
          
          if (tokenPairs.length === 0) {
            results.push({
              address: tokenAddress,
              network: networkId,
              networkName: networkConfig.name,
              priceUsd: null,
              priceChange24h: null,
              volume24h: null,
              source: 'dexscreener',
              error: 'No trading pairs found'
            });
            continue;
          }
          
          // Find the best pair for this token
          const bestPair = tokenPairs.reduce((best, current) => {
            const currentVolume = parseFloat(current.volume?.h24 || 0);
            const bestVolume = parseFloat(best?.volume?.h24 || 0);
            return currentVolume > bestVolume ? current : best;
          });
          
          const isBaseToken = bestPair.baseToken?.address?.toLowerCase() === tokenAddress.toLowerCase();
          const priceUsd = isBaseToken ? 
            parseFloat(bestPair.priceUsd) || 0 : 
            parseFloat(bestPair.priceUsd) ? 1 / parseFloat(bestPair.priceUsd) : 0;
          
          results.push({
            address: tokenAddress,
            network: networkId,
            networkName: networkConfig.name,
            priceUsd: priceUsd,
            priceChange24h: parseFloat(bestPair.priceChange?.h24) || 0,
            volume24h: parseFloat(bestPair.volume?.h24) || 0,
            dexId: bestPair.dexId,
            pairAddress: bestPair.pairAddress,
            source: 'dexscreener'
          });
        }
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < tokenAddresses.length) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
        
      } catch (batchError) {
        logError(`Failed to fetch batch prices for tokens ${i}-${i + batchSize}`, batchError);
        
        // Add error entries for this batch
        for (const tokenAddress of batch) {
          results.push({
            address: tokenAddress,
            network: networkId,
            networkName: networkConfig.name,
            priceUsd: null,
            priceChange24h: null,
            volume24h: null,
            source: 'dexscreener',
            error: batchError.message
          });
        }
      }
    }
    
    timer.end();
    
    const successCount = results.filter(r => !r.error && r.priceUsd !== null).length;
    
    logDebug(`Multiple token prices completed for ${networkConfig.name}`, {
      totalTokens: tokenAddresses.length,
      successfulPrices: successCount,
      network: networkConfig.name
    });
    
    return results;
    
  } catch (error) {
    timer.end();
    logError(`Failed to get multiple token prices from DexScreener for ${networkConfig.name}`, error);
    throw error;
  }
}

/**
 * Calculate USD value of token balance
 * @param {string} balance - Token balance (formatted)
 * @param {number} priceUsd - Price per token in USD
 * @returns {number} USD value
 */
function calculateUsdValue(balance, priceUsd) {
  if (!balance || !priceUsd) return 0;
  
  const balanceFloat = parseFloat(balance.replace(/,/g, ''));
  if (isNaN(balanceFloat) || isNaN(priceUsd)) return 0;
  
  return balanceFloat * priceUsd;
}

/**
 * Format USD value for display
 * @param {number} usdValue - USD value to format
 * @returns {string} Formatted USD string
 */
function formatUsdValue(usdValue) {
  if (!usdValue || usdValue === 0) return '$0.00';
  
  if (usdValue < 0.01) {
    return `$${usdValue.toExponential(2)}`;
  } else if (usdValue < 1) {
    return `$${usdValue.toFixed(4)}`;
  } else if (usdValue < 1000) {
    return `$${usdValue.toFixed(2)}`;
  } else if (usdValue < 1000000) {
    return `$${(usdValue / 1000).toFixed(2)}K`;
  } else {
    return `$${(usdValue / 1000000).toFixed(2)}M`;
  }
}

module.exports = {
  getTokenPrice,
  getMultipleTokenPrices,
  calculateUsdValue,
  formatUsdValue,
  getDexScreenerNetworkId
};
