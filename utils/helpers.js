/**
 * Utility functions for the Ethereum Wallet Analyzer
 * Enhanced with better error handling and validation
 */

const { VALIDATION } = require('../config/constants');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isValidEthereumAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  return VALIDATION.ETHEREUM_ADDRESS.test(address.trim());
}

function validateAddresses(addresses) {
  if (!Array.isArray(addresses)) {
    return { valid: [], invalid: addresses ? [addresses] : [] };
  }
  
  const valid = [];
  const invalid = [];
  
  addresses.forEach(address => {
    const trimmed = address?.toString().trim();
    if (!trimmed) return; // Skip empty strings
    
    if (isValidEthereumAddress(trimmed)) {
      // Normalize to lowercase for consistency
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

function parseAddressInput(input) {
  if (!input || typeof input !== 'string') {
    return [];
  }
  
  return input
    .split(/[\n,;|\s]+/) // Split by newlines, commas, semicolons, pipes, or spaces
    .map(addr => addr.trim())
    .filter(addr => addr.length > 0)
    .map(addr => addr.toLowerCase());
}

function hexToString(hex) {
  try {
    if (!hex || hex === '0x' || hex.length < 3) return '';
    
    // Remove 0x prefix
    hex = hex.startsWith('0x') ? hex.slice(2) : hex;
    
    // Handle dynamic strings (ABI encoded)
    if (hex.length >= 128) {
      // Skip first 64 chars (offset), next 64 chars contain length
      const lengthHex = hex.substring(64, 128);
      const length = parseInt(lengthHex, 16) * 2; // Convert to hex chars
      
      if (length > 0 && length <= hex.length - 128) {
        hex = hex.substring(128, 128 + length); // Extract actual string data
      }
    }
    
    // Convert hex to string
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const hexPair = hex.substr(i, 2);
      if (hexPair.length === 2) {
        const charCode = parseInt(hexPair, 16);
        // Only include printable ASCII characters
        if (charCode >= 32 && charCode <= 126) {
          str += String.fromCharCode(charCode);
        }
      }
    }
    
    return str.trim();
  } catch (error) {
    console.error('Error converting hex to string:', error.message);
    return '';
  }
}

function weiToTokens(weiAmount, decimals = 18) {
  try {
    if (!weiAmount || weiAmount === '0') {
      return '0';
    }
    
    const balanceNum = typeof weiAmount === 'string' 
      ? parseFloat(weiAmount) 
      : weiAmount;
    
    if (isNaN(balanceNum) || balanceNum === 0) {
      return '0';
    }
    
    const divisor = Math.pow(10, decimals);
    const tokenBalance = balanceNum / divisor;
    
    // Use appropriate decimal places based on amount
    if (tokenBalance >= 1) {
      return tokenBalance.toFixed(6);
    } else if (tokenBalance >= 0.01) {
      return tokenBalance.toFixed(8);
    } else {
      return tokenBalance.toExponential(3);
    }
  } catch (error) {
    console.error('Error converting wei to tokens:', error.message);
    return '0';
  }
}

function shortenAddress(address, startChars = 6, endChars = 4) {
  if (!address || typeof address !== 'string') {
    return '';
  }
  
  if (address.length <= startChars + endChars + 3) {
    return address;
  }
  
  return `${address.substring(0, startChars)}...${address.slice(-endChars)}`;
}

async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break; // Don't delay on last attempt
      }
      
      // Exponential backoff: baseDelay * 2^attempt
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

function validateRequestLimits(wallets, tokens) {
  const errors = [];
  
  if (!wallets || !Array.isArray(wallets)) {
    errors.push('Wallets must be an array');
  } else if (wallets.length === 0) {
    errors.push('At least one wallet address is required');
  } else if (wallets.length > VALIDATION.MAX_WALLETS_PER_REQUEST) {
    errors.push(`Too many wallets (max: ${VALIDATION.MAX_WALLETS_PER_REQUEST})`);
  }
  
  if (!tokens || !Array.isArray(tokens)) {
    errors.push('Tokens must be an array');
  } else if (tokens.length === 0) {
    errors.push('At least one token address is required');
  } else if (tokens.length > VALIDATION.MAX_TOKENS_PER_REQUEST) {
    errors.push(`Too many tokens (max: ${VALIDATION.MAX_TOKENS_PER_REQUEST})`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  sleep,
  isValidEthereumAddress,
  validateAddresses,
  parseAddressInput,
  hexToString,
  weiToTokens,
  shortenAddress,
  retryWithBackoff,
  validateRequestLimits
};
