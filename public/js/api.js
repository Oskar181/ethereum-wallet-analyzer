/**
 * API Layer - Frontend communication with backend services
 * Handles all HTTP requests to the backend API
 */

// API Configuration
const API_BASE = window.location.origin + '/api';

/**
 * HTTP request wrapper with error handling
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 */
async function apiRequest(url, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    ...options
  };
  
  try {
    debugLog(`API Request: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: 'Network error', 
        message: `HTTP ${response.status}: ${response.statusText}` 
      }));
      
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    debugLog(`API Response: ${response.status} - ${JSON.stringify(data).substring(0, 200)}...`);
    
    return data;
    
  } catch (error) {
    debugLog(`API Error: ${error.message}`);
    throw error;
  }
}

/**
 * Analyze wallets for specified tokens
 * @param {string[]} wallets - Array of wallet addresses
 * @param {string[]} tokens - Array of token addresses
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeWallets(wallets, tokens) {
  const url = `${API_BASE}/analyze`;
  
  const options = {
    method: 'POST',
    body: JSON.stringify({
      wallets: wallets,
      tokens: tokens
    })
  };
  
  return await apiRequest(url, options);
}

/**
 * Validate Ethereum addresses
 * @param {string[]} addresses - Array of addresses to validate
 * @returns {Promise<Object>} Validation results
 */
async function validateAddresses(addresses) {
  const url = `${API_BASE}/validate-addresses`;
  
  const options = {
    method: 'POST',
    body: JSON.stringify({
      addresses: addresses
    })
  };
  
  return await apiRequest(url, options);
}

/**
 * Get token information
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<Object>} Token information
 */
async function getTokenInfo(tokenAddress) {
  const url = `${API_BASE}/token-info/${tokenAddress}`;
  
  return await apiRequest(url);
}

/**
 * Get token balance for a specific wallet
 * @param {string} walletAddress - Wallet address
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<Object>} Token balance data
 */
async function getTokenBalance(walletAddress, tokenAddress) {
  const url = `${API_BASE}/token-balance`;
  
  const options = {
    method: 'POST',
    body: JSON.stringify({
      walletAddress: walletAddress,
      tokenAddress: tokenAddress
    })
  };
  
  return await apiRequest(url, options);
}

/**
 * Check API health
 * @returns {Promise<Object>} Health status
 */
async function checkApiHealth() {
  const url = `${API_BASE}/health`;
  
  return await apiRequest(url);
}

/**
 * Parse input text into array of addresses
 * @param {string} input - Multi-line input text
 * @returns {string[]} Array of addresses
 */
function parseAddressInput(input) {
  if (!input || typeof input !== 'string') {
    return [];
  }
  
  return input
    .split(/[\n,;|\s]+/) // Split by newlines, commas, semicolons, pipes, or spaces
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0)
    .filter(addr => addr.length === 42) // Ethereum addresses are 42 characters
    .map(addr => addr.toLowerCase());
}

/**
 * Validate Ethereum address format (client-side)
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid
 */
function isValidEthereumAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

/**
 * Validate multiple addresses (client-side)
 * @param {string[]} addresses - Array of addresses
 * @returns {Object} Validation results
 */
function validateAddressesClientSide(addresses) {
  const valid = [];
  const invalid = [];
  
  if (!Array.isArray(addresses)) {
    return { valid: [], invalid: [] };
  }
  
  addresses.forEach(address => {
    const trimmed = address.trim();
    if (!trimmed) return;
    
    if (isValidEthereumAddress(trimmed)) {
      valid.push(trimmed.toLowerCase());
    } else {
      invalid.push(trimmed);
    }
  });
  
  return {
    valid: [...new Set(valid)], // Remove duplicates
    invalid: [...new Set(invalid)]
  };
}

/**
 * Get sample data for testing
 * @returns {Object} Sample wallets and tokens
 */
function getSampleData() {
  return {
    wallets: [
      '0x742d35Cc6634C0532925a3b8D2645Ff9b5B4b6bE',
      '0x8ba1f109551bD432803012645Hac136c5F7eB4B5B',
      '0x1234567890123456789012345678901234567890',
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' // Vitalik's address
    ],
    tokens: [
      '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4CE', // SHIB
      '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
      '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'  // UNI
    ]
  };
}

/**
 * Format error message for display
 * @param {Error} error - Error object
 * @returns {string} Formatted error message
 */
function formatError(error) {
  if (!error) return 'Unknown error occurred';
  
  if (error.message) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Function result
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      debugLog(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Check if the application is online
 * @returns {Promise<boolean>} True if online
 */
async function checkOnlineStatus() {
  try {
    await checkApiHealth();
    return true;
  } catch (error) {
    debugLog('Offline or API unavailable:', error.message);
    return false;
  }
}

/**
 * Initialize API monitoring
 */
function initApiMonitoring() {
  // Check initial status
  checkOnlineStatus().then(isOnline => {
    updateStatusIndicator(isOnline);
  });
  
  // Periodic health checks
  setInterval(async () => {
    const isOnline = await checkOnlineStatus();
    updateStatusIndicator(isOnline);
  }, 30000); // Check every 30 seconds
}

/**
 * Update status indicator
 * @param {boolean} isOnline - Online status
 */
function updateStatusIndicator(isOnline) {
  const statusIcon = document.getElementById('status-icon');
  const statusText = document.getElementById('status-text');
  
  if (statusIcon && statusText) {
    if (isOnline) {
      statusIcon.textContent = '🟢';
      statusText.textContent = 'Online';
    } else {
      statusIcon.textContent = '🔴';
      statusText.textContent = 'Offline';
    }
  }
}

// Initialize API monitoring when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApiMonitoring);
} else {
  initApiMonitoring();
}
