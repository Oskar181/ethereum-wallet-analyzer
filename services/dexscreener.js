/**
 * DexScreener API Service - NAPRAWIONA WERSJA
 * Professional service for fetching real-time token prices and market data
 * Supports multiple blockchain networks including Ethereum and Base
 */

const { getNetworkConfig, isNetworkSupported, API_CONFIG } = require('../config/constants');
const { logDebug, logError, PerformanceTimer } = require('../utils/debugger');

/**
 * Network mapping for DexScreener API - POPRAWIONE
 */
const DEXSCREENER_NETWORK_MAP = {
  'ethereum': 'ethereum',
  'base': 'base'
};

/**
 * Backup price sources - NOWE
 */
const BACKUP_PRICE_SOURCES = [
  'https://api.coingecko.com/api/v3',
  'https://api.1inch.dev/price/v1.1'
];

/**
 * Make API call to DexScreener with improved error handling - POPRAWIONE
 */
async function makeDexScreenerApiCall(url, operation) {
  const timer = new PerformanceTimer(`DexScreener API: ${operation}`);
  
  try {
    logDebug(`Making DexScreener API call`, { url, operation });
    
    // NOWE: Dodane AbortController dla timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Wallet-Analyzer/2.2.0',
        'Origin': 'https://walletanalyzer.onrender.com' // NOWE: Dodane dla CORS
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    timer.end();
    
    if (!data) {
      throw new Error('No data received from DexScreener API');
    }
    
    logDebug(`DexScreener API success`, { operation, dataKeys: Object.keys(data) });
    return data;
    
  } catch (error) {
    timer.end();
    logError(`DexScreener API call failed: ${operation}`, error);
    
    // NOWE: Szczegółowe logowanie błędów
    if (error.name === 'AbortError') {
      logError('DexScreener API timeout', { operation, url });
    } else if (error.message.includes('CORS')) {
      logError('DexScreener CORS error', { operation, url });
    }
    
    throw error;
  }
}

/**
 * Get token price from DexScreener - POPRAWIONA WERSJA
 */
async function getTokenPrice(tokenAddress, networkId = 'ethereum') {
  if (!isNetworkSupported(networkId)) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  
  try {
    const dexScreenerNetwork = getDexScreenerNetworkId(networkId);
    const networkConfig = getNetworkConfig(networkId);
    
    // POPRAWIONY URL - używamy nowego formatu DexScreener API
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    
    logDebug(`Fetching price for token ${tokenAddress} on ${networkConfig.name}`, { url });
    
    const data = await makeDexScreenerApiCall(url, `token-price-${tokenAddress.substring(0, 8)}`);
    
    // POPRAWIONE: Lepsze parsowanie odpowiedzi DexScreener
    if (!data.pairs || data.pairs.length === 0) {
      logDebug(`No trading pairs found for token ${tokenAddress} on ${networkConfig.name}`);
      
      // NOWE: Próba alternatywnego API
      return await getTokenPriceFromBackup(tokenAddress, networkId);
    }
    
    // Filtruj pary dla odpowiedniej sieci
    const networkPairs = data.pairs.filter(pair => {
      const chainId = pair.chainId;
      if (networkId === 'ethereum' && chainId === 'ethereum') return true;
      if (networkId === 'base' && chainId === 'base') return true;
      return false;
    });
    
    if (networkPairs.length === 0) {
      logDebug(`No pairs found for network ${networkConfig.name}`);
      return await getTokenPriceFromBackup(tokenAddress, networkId);
    }
    
    // Get the most liquid pair (highest volume)
    const bestPair = networkPairs.reduce((best, current) => {
      const currentVolume = parseFloat(current.volume?.h24 || 0);
      const bestVolume = parseFloat(best.volume?.h24 || 0);
      return currentVolume > bestVolume ? current : best;
    });
    
    const priceUsd = parseFloat(bestPair.priceUsd) || 0;
    const priceChange24h = parseFloat(bestPair.priceChange?.h24) || 0;
    const volume24h = parseFloat(bestPair.volume?.h24) || 0;
    
    logDebug(`Token price retrieved successfully`, {
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
    
    // NOWE: Fallback do backup API
    try {
      return await getTokenPriceFromBackup(tokenAddress, networkId);
    } catch (backupError) {
      logError(`All price sources failed for token ${tokenAddress}`, backupError);
      
      return {
        address: tokenAddress,
        network: networkId,
        networkName: networkConfig.name,
        priceUsd: null,
        priceChange24h: null,
        volume24h: null,
        source: 'dexscreener',
        error: `Failed to fetch price: ${error.message}`
      };
    }
  }
}

/**
 * NOWA FUNKCJA: Backup price source using CoinGecko
 */
async function getTokenPriceFromBackup(tokenAddress, networkId) {
  const networkConfig = getNetworkConfig(networkId);
  
  try {
    // Próba przez CoinGecko API (wymaga coin ID, nie address)
    // To jest uproszczona wersja - w pełnej implementacji potrzebowałbyś mapowania address -> coin_id
    
    logDebug(`Trying backup price source for ${tokenAddress} on ${networkConfig.name}`);
    
    // Dla popularnych tokenów możemy mieć hardcoded mapping
    const coinGeckoIds = {
      // Ethereum tokens
      '0xdac17f958d2ee523a2206206994597c13d831ec7': 'tether', // USDT
      '0xa0b86a33e6441466f4f0c9bb6eb6a5e40f3df8ab': 'usd-coin', // USDC
      '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce': 'shiba-inu', // SHIB
      '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'wrapped-bitcoin', // WBTC
      '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'uniswap', // UNI
      '0x514910771af9ca656af840dff83e8264ecf986ca': 'chainlink', // LINK
    };
    
    const coinId = coinGeckoIds[tokenAddress.toLowerCase()];
    
    if (coinId) {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`);
      const data = await response.json();
      
      if (data[coinId]) {
        const priceData = data[coinId];
        return {
          address: tokenAddress,
          network: networkId,
          networkName: networkConfig.name,
          priceUsd: priceData.usd || 0,
          priceChange24h: priceData.usd_24h_change || 0,
          volume24h: null,
          source: 'coingecko-backup'
        };
      }
    }
    
    // Fallback: zwróć null price
    return {
      address: tokenAddress,
      network: networkId,
      networkName: networkConfig.name,
      priceUsd: null,
      priceChange24h: null,
      volume24h: null,
      source: 'backup-failed',
      error: 'Token not found in backup price sources'
    };
    
  } catch (error) {
    logError(`Backup price source failed for ${tokenAddress}`, error);
    throw error;
  }
}

/**
 * Get DexScreener network identifier - POPRAWIONE
 */
function getDexScreenerNetworkId(networkId) {
  return DEXSCREENER_NETWORK_MAP[networkId] || 'ethereum';
}

/**
 * Get multiple token prices - POPRAWIONA WERSJA
 */
async function getMultipleTokenPrices(tokenAddresses, networkId = 'ethereum') {
  if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) {
    return [];
  }
  
  if (!isNetworkSupported(networkId)) {
    throw new Error(`Unsupported network: ${networkId}`);
  }
  
  const networkConfig = getNetworkConfig(networkId);
  const timer = new PerformanceTimer(`DexScreener Multiple Prices - ${tokenAddresses.length} tokens on ${networkConfig.name}`);
  
  try {
    logDebug(`Fetching multiple token prices from DexScreener`, {
      tokenCount: tokenAddresses.length,
      network: networkConfig.name
    });
    
    const results = [];
    
    // POPRAWIONE: Sequential calls zamiast batch (bardziej niezawodne)
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i];
      
      try {
        const priceData = await getTokenPrice(tokenAddress, networkId);
        results.push(priceData);
        
        // Rate limiting between calls
        if (i < tokenAddresses.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
        
      } catch (error) {
        logError(`Failed to get price for token ${tokenAddress}`, error);
        results.push({
          address: tokenAddress,
          network: networkId,
          networkName: networkConfig.name,
          priceUsd: null,
          priceChange24h: null,
          volume24h: null,
          source: 'dexscreener',
          error: error.message
        });
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
 * Calculate USD value of token balance - POPRAWIONE
 */
function calculateUsdValue(balance, priceUsd) {
  if (!balance || !priceUsd || priceUsd === 0) return 0;
  
  try {
    // Usuń przecinki i konwertuj na liczby
    const balanceFloat = parseFloat(balance.toString().replace(/,/g, ''));
    const priceFloat = parseFloat(priceUsd);
    
    if (isNaN(balanceFloat) || isNaN(priceFloat)) {
      logDebug(`Invalid numbers for USD calculation`, { balance, priceUsd });
      return 0;
    }
    
    const usdValue = balanceFloat * priceFloat;
    
    // Sprawdź czy wynik jest sensowny
    if (!isFinite(usdValue) || usdValue < 0) {
      logDebug(`Invalid USD calculation result`, { balance, priceUsd, usdValue });
      return 0;
    }
    
    return usdValue;
  } catch (error) {
    logError(`Error calculating USD value`, error, { balance, priceUsd });
    return 0;
  }
}

/**
 * Format USD value for display - POPRAWIONE
 */
function formatUsdValue(usdValue) {
  if (!usdValue || usdValue === 0 || !isFinite(usdValue)) return '$0.00';
  
  try {
    const value = Math.abs(usdValue); // Zawsze pozytywna wartość
    
    if (value < 0.000001) {
      return '$0.00';
    } else if (value < 0.01) {
      return `$${value.toFixed(6)}`;
    } else if (value < 1) {
      return `$${value.toFixed(4)}`;
    } else if (value < 1000) {
      return `$${value.toFixed(2)}`;
    } else if (value < 1000000) {
      return `$${(value / 1000).toFixed(2)}K`;
    } else if (value < 1000000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else {
      return `$${(value / 1000000000).toFixed(2)}B`;
    }
  } catch (error) {
    logError(`Error formatting USD value`, error, { usdValue });
    return '$0.00';
  }
}

module.exports = {
  getTokenPrice,
  getMultipleTokenPrices,
  calculateUsdValue,
  formatUsdValue,
  getDexScreenerNetworkId,
  getTokenPriceFromBackup // NOWE
};
