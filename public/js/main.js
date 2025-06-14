/**
 * Main Application Logic - Wallet Analyzer
 * Orchestrates the entire analysis workflow with professional error handling
 * Now supports multi-chain analysis (Ethereum, Base)
 */

// Global application state
let analysisInProgress = false;
let analysisStartTime = null;

/**
 * Parse address input from textarea and return clean array
 */
function parseAddressInput(input) {
  if (!input || typeof input !== 'string') {
    return [];
  }
  
  return input
    .split('\n')
    .map(address => address.trim())
    .filter(address => address.length > 0)
    .filter(address => address !== '');
}

/**
 * Validate Ethereum address format
 */
function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Client-side address validation
 */
function validateAddressesClientSide(addresses) {
  const valid = [];
  const invalid = [];
  
  for (const address of addresses) {
    if (isValidEthereumAddress(address)) {
      valid.push(address);
    } else {
      invalid.push(address);
    }
  }
  
  return { valid, invalid };
}

/**
 * Main analysis function - entry point triggered by UI
 */
async function startAnalysis() {
  // Prevent multiple simultaneous analyses
  if (analysisInProgress) {
    showError('Analysis already in progress. Please wait for it to complete.');
    return;
  }
  
  try {
    // Validate inputs first
    if (!validateInputs()) {
      return;
    }
    
    // Parse and prepare data
    const walletsInput = document.getElementById('wallets').value.trim();
    const tokensInput = document.getElementById('tokens').value.trim();
    
    const wallets = parseAddressInput(walletsInput);
    const tokens = parseAddressInput(tokensInput);
    
    // Get selected network
    const selectedNetwork = getSelectedNetwork();
    const networkName = getNetworkName(selectedNetwork);
    
    // Final client-side validation
    const walletValidation = validateAddressesClientSide(wallets);
    const tokenValidation = validateAddressesClientSide(tokens);
    
    if (walletValidation.invalid.length > 0 || tokenValidation.invalid.length > 0) {
      showValidationResults(walletValidation, tokenValidation);
      showError('Please fix invalid addresses before proceeding');
      return;
    }
    
    // Check limits
    if (wallets.length > 50) {
      showError('Too many wallets. Maximum 50 wallets allowed per analysis.');
      return;
    }
    
    if (tokens.length > 20) {
      showError('Too many tokens. Maximum 20 tokens allowed per analysis.');
      return;
    }
    
    // Start analysis with network information
    await performAnalysis(walletValidation.valid, tokenValidation.valid, selectedNetwork);
    
  } catch (error) {
    handleAnalysisError(error);
  }
}

/**
 * Validate inputs function
 */
function validateInputs() {
  const walletsInput = document.getElementById('wallets').value.trim();
  const tokensInput = document.getElementById('tokens').value.trim();
  
  if (!walletsInput || !tokensInput) {
    showError('Please provide both wallet and token addresses');
    return false;
  }
  
  return true;
}

/**
 * Perform the main wallet analysis with network support
 */
async function performAnalysis(wallets, tokens, network) {
  analysisInProgress = true;
  analysisStartTime = Date.now();
  
  try {
    const networkIcon = getNetworkIcon(network);
    const networkName = getNetworkName(network);
    
    debugLog('🚀 Starting comprehensive multi-chain wallet analysis');
    debugLog(`🌐 Selected Network: ${networkIcon} ${networkName}`);
    debugLog(`📊 Analyzing ${wallets.length} wallets for ${tokens.length} tokens`);
    
    // Initialize UI for analysis
    hideAllResults();
    showDebug(true);
    showLoading(true, 0, `Initializing ${networkName} blockchain analysis...`);
    
    // Estimate analysis time
    const estimatedTime = calculateEstimatedTime(wallets.length, tokens.length);
    debugLog(`⏱️ Estimated completion time: ${estimatedTime}`);
    
    // Start the analysis
    updateProgress(0, 100, `Connecting to ${networkName} APIs...`);
    
    // Pass network information to the analysis function
    const result = await analyzeWallets(wallets, tokens, network);
    
    if (!result.success) {
      throw new Error(result.message || 'Analysis failed');
    }
    
    // Process and display results
    const duration = Date.now() - analysisStartTime;
    debugLog(`✅ Analysis completed in ${duration}ms`);
    
    const analysisData = {
      walletCount: wallets.length,
      tokenCount: tokens.length,
      duration: formatDuration(duration),
      estimatedTime: estimatedTime,
      actualTime: formatDuration(duration),
      network: network,
      networkName: networkName,
      networkIcon: networkIcon
    };
    
    // Display results with enhanced data
    displayResults(result.results, analysisData);
    
    // Log success metrics
    logAnalysisMetrics(result.results, analysisData);
    
    showToast(`🎉 ${networkName} analysis completed successfully!`);
    
  } catch (error) {
    throw error;
  } finally {
    // Cleanup
    analysisInProgress = false;
    analysisStartTime = null;
    showLoading(false);
    
    // Scroll to results if successful
    if (document.getElementById('results').style.display !== 'none') {
      document.getElementById('results').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }
}

/**
 * Handle analysis errors with appropriate user feedback
 */
function handleAnalysisError(error) {
  analysisInProgress = false;
  showLoading(false);
  
  const selectedNetwork = getSelectedNetwork();
  const networkName = getNetworkName(selectedNetwork);
  
  debugLog(`❌ Analysis error on ${networkName}: ${error.message}`, 'error');
  
  // Categorize errors and provide helpful messages
  let userMessage = `Analysis failed on ${networkName}. Please try again.`;
  let technicalDetails = error.message;
  
  if (error.message.includes('rate limit')) {
    userMessage = `Rate limit exceeded on ${networkName}. Please wait a few minutes before trying again.`;
  } else if (error.message.includes('network') || error.message.includes('fetch')) {
    userMessage = `Network error connecting to ${networkName}. Please check your internet connection and try again.`;
  } else if (error.message.includes('Invalid API')) {
    userMessage = `API configuration error for ${networkName}. Please contact support.`;
    technicalDetails = 'API key configuration issue';
  } else if (error.message.includes('timeout')) {
    userMessage = `Analysis timed out on ${networkName}. Try reducing the number of wallets or tokens.`;
  } else if (error.message.includes('400')) {
    userMessage = `Invalid request data for ${networkName}. Please check your wallet and token addresses.`;
  } else if (error.message.includes('500')) {
    userMessage = `Server error on ${networkName}. Please try again in a few moments.`;
  } else if (error.message.includes('unsupported network')) {
    userMessage = `${networkName} is not yet supported. Please select a different network.`;
  }
  
  showError(userMessage, technicalDetails);
}

/**
 * Calculate estimated analysis time based on network
 */
function calculateEstimatedTime(walletCount, tokenCount) {
  const selectedNetwork = getSelectedNetwork();
  
  // Base time calculation (varies by network)
  let baseTimePerCheck = 1.2; // seconds
  
  // Adjust timing based on network characteristics
  switch (selectedNetwork) {
    case 'ethereum':
      baseTimePerCheck = 1.2; // Ethereum mainnet - standard timing
      break;
    case 'base':
      baseTimePerCheck = 0.8; // Base L2 - potentially faster
      break;
    default:
      baseTimePerCheck = 1.5; // Unknown networks - conservative estimate
  }
  
  const overhead = 5; // seconds
  const totalChecks = walletCount * tokenCount;
  const estimatedSeconds = (totalChecks * baseTimePerCheck) + overhead;
  
  return formatDuration(estimatedSeconds * 1000);
}

/**
 * Format duration in milliseconds to human readable string
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Log analysis metrics for monitoring
 */
function logAnalysisMetrics(results, analysisData) {
  const metrics = {
    network: analysisData.network,
    networkName: analysisData.networkName,
    totalWallets: analysisData.walletCount,
    totalTokens: analysisData.tokenCount,
    perfectMatches: results.allTokens.length,
    partialMatches: results.someTokens.length,
    noMatches: results.noTokens.length,
    successRate: ((results.allTokens.length + results.someTokens.length) / analysisData.walletCount * 100).toFixed(2),
    duration: analysisData.duration,
    timestamp: new Date().toISOString()
  };
  
  debugLog('📈 Analysis Metrics:', 'success');
  debugLog(`   Network: ${analysisData.networkIcon} ${metrics.networkName}`);
  debugLog(`   Wallets Analyzed: ${metrics.totalWallets}`);
  debugLog(`   Tokens Searched: ${metrics.totalTokens}`);
  debugLog(`   Perfect Matches: ${metrics.perfectMatches} (${(metrics.perfectMatches/metrics.totalWallets*100).toFixed(1)}%)`);
  debugLog(`   Partial Matches: ${metrics.partialMatches} (${(metrics.partialMatches/metrics.totalWallets*100).toFixed(1)}%)`);
  debugLog(`   No Matches: ${metrics.noMatches} (${(metrics.noMatches/metrics.totalWallets*100).toFixed(1)}%)`);
  debugLog(`   Success Rate: ${metrics.successRate}%`);
  debugLog(`   Duration: ${metrics.duration}`);
}

/**
 * Advanced validation with detailed feedback
 */
function performAdvancedValidation() {
  const walletsInput = document.getElementById('wallets').value.trim();
  const tokensInput = document.getElementById('tokens').value.trim();
  
  if (!walletsInput && !tokensInput) {
    showError('Please provide wallet and token addresses to validate');
    return;
  }
  
  const wallets = parseAddressInput(walletsInput);
  const tokens = parseAddressInput(tokensInput);
  const selectedNetwork = getSelectedNetwork();
  const networkName = getNetworkName(selectedNetwork);
  
  debugLog(`🔍 Performing advanced validation for ${networkName}...`);
  
  // Detailed validation
  const results = {
    network: {
      name: networkName,
      value: selectedNetwork,
      icon: getNetworkIcon(selectedNetwork)
    },
    wallets: analyzeAddresses(wallets, 'wallet'),
    tokens: analyzeAddresses(tokens, 'token')
  };
  
  showAdvancedValidationResults(results);
}

/**
 * Analyze addresses for detailed validation
 */
function analyzeAddresses(addresses, type) {
  const result = {
    total: addresses.length,
    valid: [],
    invalid: [],
    duplicates: [],
    suspicious: []
  };
  
  const seen = new Set();
  
  addresses.forEach(address => {
    const normalized = address.toLowerCase();
    
    // Check for duplicates
    if (seen.has(normalized)) {
      result.duplicates.push(address);
      return;
    }
    seen.add(normalized);
    
    // Basic format validation
    if (!isValidEthereumAddress(address)) {
      result.invalid.push(address);
      return;
    }
    
    // Suspicious patterns (all zeros, common test addresses, etc.)
    if (isSuspiciousAddress(address)) {
      result.suspicious.push(address);
    }
    
    result.valid.push(address);
  });
  
  return result;
}

/**
 * Check if address looks suspicious
 */
function isSuspiciousAddress(address) {
  const lower = address.toLowerCase();
  
  // All zeros (except 0x)
  if (lower === '0x0000000000000000000000000000000000000000') {
    return true;
  }
  
  // Common test addresses
  const testAddresses = [
    '0x1234567890123456789012345678901234567890',
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
  ];
  
  return testAddresses.includes(lower);
}

/**
 * Show advanced validation results with network info
 */
function showAdvancedValidationResults(results) {
  let content = '<h3>🔍 Advanced Validation Results</h3>';
  
  // Network information
  content += `
    <div class="validation-section">
      <h4>🌐 Network Analysis</h4>
      <p>Analysis will be performed on: <strong>${results.network.icon} ${results.network.name}</strong></p>
    </div>
  `;
  
  ['wallets', 'tokens'].forEach(type => {
    const data = results[type];
    const typeName = type.charAt(0).toUpperCase() + type.slice(0, -1);
    
    content += `
      <div class="validation-section">
        <h4>${type === 'wallets' ? '📁' : '🪙'} ${typeName} Analysis</h4>
        <div class="validation-summary">
          <span class="summary-item valid">✅ ${data.valid.length} valid</span>
          <span class="summary-item invalid">❌ ${data.invalid.length} invalid</span>
          <span class="summary-item duplicates">🔄 ${data.duplicates.length} duplicates</span>
          <span class="summary-item suspicious">⚠️ ${data.suspicious.length} suspicious</span>
        </div>
        
        ${data.invalid.length > 0 ? `
          <div class="issue-group">
            <h5>❌ Invalid Addresses:</h5>
            <ul class="issue-list">
              ${data.invalid.map(addr => `<li><code>${addr}</code></li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${data.duplicates.length > 0 ? `
          <div class="issue-group">
            <h5>🔄 Duplicate Addresses:</h5>
            <ul class="issue-list">
              ${data.duplicates.map(addr => `<li><code>${addr}</code></li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${data.suspicious.length > 0 ? `
          <div class="issue-group">
            <h5>⚠️ Suspicious Addresses:</h5>
            <ul class="issue-list">
              ${data.suspicious.map(addr => `<li><code>${addr}</code> <small>(test/placeholder address)</small></li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  });
  
  showModal('Advanced Validation Results', content);
}

/**
 * Network-aware analysis function
 * This function makes API calls to the backend
 */
async function analyzeWallets(wallets, tokens, network) {
  try {
    debugLog(`🔗 Connecting to ${getNetworkName(network)} APIs...`);
    
    // Prepare request data with network information
    const requestData = {
      wallets: wallets,
      tokens: tokens,
      network: network,
      networkName: getNetworkName(network)
    };
    
    // Update progress
    updateProgress(10, 100, `Preparing ${getNetworkName(network)} API requests...`);
    
    // Make API call to backend with network parameter
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    debugLog(`✅ Successfully received response from ${getNetworkName(network)} APIs`);
    
    return result;
    
  } catch (error) {
    debugLog(`❌ Failed to analyze on ${getNetworkName(network)}: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Keyboard shortcut handlers
 */
document.addEventListener('keydown', (event) => {
  // Ctrl/Cmd + Enter: Start analysis
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    if (!analysisInProgress) {
      startAnalysis();
    }
  }
  
  // Ctrl/Cmd + Shift + V: Advanced validation
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'V') {
    event.preventDefault();
    performAdvancedValidation();
  }
  
  // Ctrl/Cmd + Shift + N: Quick network switch
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'N') {
    event.preventDefault();
    const networkSelector = document.getElementById('network-selector');
    if (networkSelector) {
      networkSelector.focus();
    }
  }
  
  // Escape: Cancel analysis or close modals
  if (event.key === 'Escape') {
    if (analysisInProgress) {
      // Could implement cancellation here
    } else {
      // Close any open modals
      document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
    }
  }
});

// Make functions globally available
window.parseAddressInput = parseAddressInput;
window.isValidEthereumAddress = isValidEthereumAddress;
window.validateAddressesClientSide = validateAddressesClientSide;
window.startAnalysis = startAnalysis;
window.validateInputs = validateInputs;
window.analyzeWallets = analyzeWallets;
window.performAdvancedValidation = performAdvancedValidation;

/**
 * Initialize application on page load
 */
document.addEventListener('DOMContentLoaded', () => {
  debugLog('🚀 Wallet Analyzer initialized');
  debugLog('ℹ️ Keyboard shortcuts:');
  debugLog('   Ctrl+Enter: Start analysis');
  debugLog('   Ctrl+Shift+V: Advanced validation');
  debugLog('   Ctrl+Shift+N: Focus network selector');
  debugLog('   Escape: Cancel/Close');
  
  // Check for supported networks
  const supportedNetworks = ['ethereum', 'base'];
  const currentNetwork = getSelectedNetwork();
  
  if (supportedNetworks.includes(currentNetwork)) {
    debugLog(`🌐 Network ready: ${getNetworkIcon(currentNetwork)} ${getNetworkName(currentNetwork)}`);
  } else {
    debugLog(`⚠️ Unsupported network: ${currentNetwork}`, 'warning');
  }
  
  // Initialize performance monitoring
  if ('performance' in window) {
    const loadTime = performance.now();
    debugLog(`⚡ Page loaded in ${loadTime.toFixed(2)}ms`);
  }
  
  // Show welcome message for first-time users
  const hasUsedBefore = localStorage.getItem('wallet-analyzer-used');
  if (!hasUsedBefore) {
    setTimeout(() => {
      showToast('👋 Welcome to Wallet Analyzer! Select a network and start analyzing.', 5000);
      localStorage.setItem('wallet-analyzer-used', 'true');
    }, 1000);
  }
});
document.addEventListener('DOMContentLoaded', () => {
  debugLog('🚀 Wallet Analyzer initialized');
  debugLog('ℹ️ Keyboard shortcuts:');
  debugLog('   Ctrl+Enter: Start analysis');
  debugLog('   Ctrl+Shift+V: Advanced validation');
  debugLog('   Ctrl+Shift+N: Focus network selector');
  debugLog('   Escape: Cancel/Close');
  
  // Check for supported networks
  const supportedNetworks = ['ethereum', 'base'];
  const currentNetwork = getSelectedNetwork();
  
  if (supportedNetworks.includes(currentNetwork)) {
    debugLog(`🌐 Network ready: ${getNetworkIcon(currentNetwork)} ${getNetworkName(currentNetwork)}`);
  } else {
    debugLog(`⚠️ Unsupported network: ${currentNetwork}`, 'warning');
  }
  
  // Initialize performance monitoring
  if ('performance' in window) {
    const loadTime = performance.now();
    debugLog(`⚡ Page loaded in ${loadTime.toFixed(2)}ms`);
  }
  
  // Show welcome message for first-time users
  const hasUsedBefore = localStorage.getItem('wallet-analyzer-used');
  if (!hasUsedBefore) {
    setTimeout(() => {
      showToast('👋 Welcome to Wallet Analyzer! Select a network and start analyzing.', 5000);
      localStorage.setItem('wallet-analyzer-used', 'true');
    }, 1000);
  }
});
