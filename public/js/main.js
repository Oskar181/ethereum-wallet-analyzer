/**
 * Main Application Logic - Ethereum Wallet Analyzer
 * Orchestrates the entire analysis workflow with professional error handling
 */

// Global application state
let analysisInProgress = false;
let analysisStartTime = null;

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
    
    // Start analysis
    await performAnalysis(walletValidation.valid, tokenValidation.valid);
    
  } catch (error) {
    handleAnalysisError(error);
  }
}

/**
 * Perform the main wallet analysis
 */
async function performAnalysis(wallets, tokens) {
  analysisInProgress = true;
  analysisStartTime = Date.now();
  
  try {
    debugLog('🚀 Starting comprehensive wallet analysis');
    debugLog(`📊 Analyzing ${wallets.length} wallets for ${tokens.length} tokens`);
    
    // Initialize UI for analysis
    hideAllResults();
    showDebug(true);
    showLoading(true, 0, 'Initializing blockchain analysis...');
    
    // Estimate analysis time
    const estimatedTime = calculateEstimatedTime(wallets.length, tokens.length);
    debugLog(`⏱️ Estimated completion time: ${estimatedTime}`);
    
    // Start the analysis
    updateProgress(0, 100, 'Connecting to blockchain APIs...');
    
    const result = await analyzeWallets(wallets, tokens);
    
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
      actualTime: formatDuration(duration)
    };
    
    // Display results with enhanced data
    displayResults(result.results, analysisData);
    
    // Log success metrics
    logAnalysisMetrics(result.results, analysisData);
    
    showToast('🎉 Analysis completed successfully!');
    
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
  
  debugLog(`❌ Analysis error: ${error.message}`, 'error');
  
  // Categorize errors and provide helpful messages
  let userMessage = 'Analysis failed. Please try again.';
  let technicalDetails = error.message;
  
  if (error.message.includes('rate limit')) {
    userMessage = 'Rate limit exceeded. Please wait a few minutes before trying again.';
  } else if (error.message.includes('network') || error.message.includes('fetch')) {
    userMessage = 'Network error. Please check your internet connection and try again.';
  } else if (error.message.includes('Invalid API')) {
    userMessage = 'API configuration error. Please contact support.';
    technicalDetails = 'API key configuration issue';
  } else if (error.message.includes('timeout')) {
    userMessage = 'Analysis timed out. Try reducing the number of wallets or tokens.';
  } else if (error.message.includes('400')) {
    userMessage = 'Invalid request data. Please check your wallet and token addresses.';
  } else if (error.message.includes('500')) {
    userMessage = 'Server error. Please try again in a few moments.';
  }
  
  showError(userMessage, technicalDetails);
}

/**
 * Calculate estimated analysis time
 */
function calculateEstimatedTime(walletCount, tokenCount) {
  // Base time calculation (approximate)
  // ~1 second per wallet per token, plus overhead
  const baseTimePerCheck = 1.2; // seconds
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
  
  debugLog('🔍 Performing advanced validation...');
  
  // Detailed validation
  const results = {
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
 * Show advanced validation results
 */
function showAdvancedValidationResults(results) {
  let content = '<h3>🔍 Advanced Validation Results</h3>';
  
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

/**
 * Initialize application on page load
 */
document.addEventListener('DOMContentLoaded', () => {
  debugLog('🚀 Ethereum Wallet Analyzer initialized');
  debugLog('ℹ️ Keyboard shortcuts:');
  debugLog('   Ctrl+Enter: Start analysis');
  debugLog('   Ctrl+Shift+V: Advanced validation');
  debugLog('   Escape: Cancel/Close');
  
  // Initialize performance monitoring
  if ('performance' in window) {
    const loadTime = performance.now();
    debugLog(`⚡ Page loaded in ${loadTime.toFixed(2)}ms`);
  }
});
