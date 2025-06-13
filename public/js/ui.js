/**
 * UI Layer - Handles all user interface interactions and state management
 * Enhanced with professional animations and user experience features
 */

// Global UI state
let currentResults = null;
let currentCategory = 'all';
let debugDiv;

/**
 * Initialize UI when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
  initializeUI();
  setupEventListeners();
  setupInputCounters();
});

/**
 * Initialize UI components
 */
function initializeUI() {
  // Add fade-in animation to main container
  const container = document.querySelector('.container');
  if (container) {
    container.classList.add('fade-in');
  }
  
  // Initialize debug panel
  debugDiv = document.getElementById('debug-content');
  
  // ✅ Prawidłowa inicjalizacja debug panelu
  const debugPanel = document.getElementById('debug');
  const debugContent = document.getElementById('debug-content');
  const debugToggle = document.getElementById('debug-toggle');
  
  if (debugPanel && debugContent && debugToggle) {
    // Panel widoczny, ale zawartość ukryta na start
    debugPanel.style.display = 'block';
    debugContent.style.display = 'none';
    debugToggle.textContent = 'Show';
  }
  
  // Load saved inputs from localStorage
  loadSavedInputs();
  
  debugLog('UI initialized successfully');
}

/**
 * Setup event listeners for interactive elements
 */
function setupEventListeners() {
  // Input change listeners for real-time validation
  const walletsInput = document.getElementById('wallets');
  const tokensInput = document.getElementById('tokens');
  
  if (walletsInput) {
    walletsInput.addEventListener('input', debounce(handleWalletsInput, 300));
    walletsInput.addEventListener('paste', handlePasteEvent);
  }
  
  if (tokensInput) {
    tokensInput.addEventListener('input', debounce(handleTokensInput, 300));
    tokensInput.addEventListener('paste', handlePasteEvent);
  }
  
  // Main action buttons
  const analyzeBtn = document.getElementById('analyze-btn');
  const validateBtn = document.getElementById('validate-btn');
  const clearBtn = document.getElementById('clear-btn');
  const debugToggle = document.getElementById('debug-toggle');
  const retryBtn = document.getElementById('retry-btn');
  
  if (analyzeBtn) analyzeBtn.addEventListener('click', startAnalysis);
  if (validateBtn) validateBtn.addEventListener('click', validateInputs);
  if (clearBtn) clearBtn.addEventListener('click', clearInputs);
  if (debugToggle) debugToggle.addEventListener('click', toggleDebug);
  if (retryBtn) retryBtn.addEventListener('click', retryAnalysis);
  
  // Category tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(tab => {
    tab.addEventListener('click', () => {
      const category = tab.dataset.category;
      if (category) showCategory(category);
    });
  });
  
  // ✅ POPRAWIONE Footer links - usunięto niepotrzebne
  const showHelpBtn = document.getElementById('show-help');
  
  if (showHelpBtn) showHelpBtn.addEventListener('click', (e) => { e.preventDefault(); showHelp(); });
  
  // Window resize handler for responsive adjustments
  window.addEventListener('resize', debounce(handleWindowResize, 250));
  
  debugLog('Event listeners setup completed');
}

/**
 * Setup input counters
 */
function setupInputCounters() {
  updateInputCounters();
}

/**
 * Handle wallets input changes
 */
function handleWalletsInput() {
  updateInputCounters();
  saveInputsToStorage();
  
  const wallets = parseAddressInput(document.getElementById('wallets').value);
  const validation = validateAddressesClientSide(wallets);
  
  showInputValidation('wallets', validation);
}

/**
 * Handle tokens input changes
 */
function handleTokensInput() {
  updateInputCounters();
  saveInputsToStorage();
  
  const tokens = parseAddressInput(document.getElementById('tokens').value);
  const validation = validateAddressesClientSide(tokens);
  
  showInputValidation('tokens', validation);
}

/**
 * Handle paste events with automatic formatting
 */
function handlePasteEvent(event) {
  setTimeout(() => {
    const textarea = event.target;
    const value = textarea.value;
    
    // Auto-format pasted content
    const addresses = parseAddressInput(value);
    if (addresses.length > 0) {
      textarea.value = addresses.join('\n');
      textarea.dispatchEvent(new Event('input'));
    }
  }, 10);
}

/**
 * Handle window resize for responsive adjustments
 */
function handleWindowResize() {
  // Adjust UI for mobile/desktop
  const container = document.querySelector('.container');
  if (window.innerWidth < 768) {
    container.classList.add('mobile-view');
  } else {
    container.classList.remove('mobile-view');
  }
}

/**
 * Update input counters
 */
function updateInputCounters() {
  const walletsInput = document.getElementById('wallets');
  const tokensInput = document.getElementById('tokens');
  const walletCountEl = document.getElementById('wallet-count');
  const tokenCountEl = document.getElementById('token-count');
  
  if (walletsInput && walletCountEl) {
    const wallets = parseAddressInput(walletsInput.value);
    walletCountEl.textContent = wallets.length;
    
    // Add visual feedback for limits
    if (wallets.length > 50) {
      walletCountEl.style.color = '#f44336';
      walletCountEl.title = 'Maximum 50 wallets allowed';
    } else {
      walletCountEl.style.color = '#4caf50';
      walletCountEl.title = '';
    }
  }
  
  if (tokensInput && tokenCountEl) {
    const tokens = parseAddressInput(tokensInput.value);
    tokenCountEl.textContent = tokens.length;
    
    // Add visual feedback for limits
    if (tokens.length > 20) {
      tokenCountEl.style.color = '#f44336';
      tokenCountEl.title = 'Maximum 20 tokens allowed';
    } else {
      tokenCountEl.style.color = '#4caf50';
      tokenCountEl.title = '';
    }
  }
}

/**
 * Show input validation feedback
 */
function showInputValidation(inputType, validation) {
  const input = document.getElementById(inputType);
  if (!input) return;
  
  // Remove existing validation classes
  input.classList.remove('valid', 'invalid', 'partial');
  
  if (validation.valid.length > 0 && validation.invalid.length === 0) {
    input.classList.add('valid');
  } else if (validation.invalid.length > 0 && validation.valid.length === 0) {
    input.classList.add('invalid');
  } else if (validation.valid.length > 0 && validation.invalid.length > 0) {
    input.classList.add('partial');
  }
}

/**
 * Debug logging function with enhanced formatting
 */
function debugLog(message, level = 'info') {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
  
  if (debugDiv) {
    const timestamp = new Date().toLocaleTimeString();
    const levelIcon = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'debug': '🔍'
    }[level] || 'ℹ️';
    
    const logEntry = document.createElement('div');
    logEntry.className = `debug-entry debug-${level}`;
    logEntry.innerHTML = `<span class="debug-time">[${timestamp}]</span> ${levelIcon} ${message}`;
    
    debugDiv.appendChild(logEntry);
    debugDiv.scrollTop = debugDiv.scrollHeight;
    
    // Limit debug entries to prevent memory issues
    const entries = debugDiv.querySelectorAll('.debug-entry');
    if (entries.length > 1000) {
      entries[0].remove();
    }
  }
}

/**
 * ✅ NAPRAWIONY Toggle debug panel visibility - ukrywa tylko zawartość, nie cały panel
 */
function toggleDebug() {
  const debugContent = document.getElementById('debug-content');
  const debugToggle = document.getElementById('debug-toggle');
  const debugPanel = document.getElementById('debug');
  
  if (debugContent && debugToggle && debugPanel) {
    // Upewnij się że panel jest widoczny (żeby header był zawsze dostępny)
    debugPanel.style.display = 'block';
    
    const isContentVisible = debugContent.style.display !== 'none';
    
    if (isContentVisible) {
      // Hide debug content (but keep header visible)
      debugContent.style.display = 'none';
      debugToggle.textContent = 'Show'; // ✅ Zmiana tekstu na "Show"
      debugLog('Debug console content hidden', 'info');
    } else {
      // Show debug content
      debugContent.style.display = 'block';
      debugToggle.textContent = 'Hide'; // ✅ Zmiana tekstu na "Hide"
      debugLog('Debug console content shown', 'info');
    }
  }
}

/**
 * ✅ POPRAWIONA funkcja showDebug - też ukrywa tylko zawartość
 */
function showDebug(show = true) {
  const debugPanel = document.getElementById('debug');
  const debugContent = document.getElementById('debug-content');
  const debugToggle = document.getElementById('debug-toggle');
  
  if (debugPanel && debugContent && debugToggle) {
    // Panel zawsze widoczny (żeby header był dostępny)
    debugPanel.style.display = 'block';
    
    // Ukryj/pokaż tylko zawartość
    debugContent.style.display = show ? 'block' : 'none';
    debugToggle.textContent = show ? 'Hide' : 'Show';
    
    if (show && debugDiv) {
      debugDiv.innerHTML = '';
    }
  }
}

/**
/**
 * ✅ NAPRAWIONY Toggle debug panel visibility - ukrywa tylko zawartość
 */
function toggleDebug() {
  const debugContent = document.getElementById('debug-content');
  const debugToggle = document.getElementById('debug-toggle');
  const debugPanel = document.getElementById('debug');
  
  if (debugContent && debugToggle && debugPanel) {
    // Upewnij się że panel jest widoczny (żeby header był zawsze dostępny)
    debugPanel.style.display = 'block';
    
    const isContentVisible = debugContent.style.display !== 'none';
    
    if (isContentVisible) {
      // Hide debug content (but keep header visible)
      debugContent.style.display = 'none';
      debugToggle.textContent = 'Show'; // ✅ Zmiana tekstu na "Show"
      debugLog('Debug console content hidden', 'info');
    } else {
      // Show debug content
      debugContent.style.display = 'block';
      debugToggle.textContent = 'Hide'; // ✅ Zmiana tekstu na "Hide"
      debugLog('Debug console content shown', 'info');
    }
  }
}

/**
 * Show/hide loading indicator with progress
 */
function showLoading(show = true, progress = 0, details = '') {
  const loadingSection = document.getElementById('loading');
  const analyzeBtn = document.getElementById('analyze-btn');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const loadingDetails = document.getElementById('loading-details');
  
  if (loadingSection) {
    loadingSection.style.display = show ? 'block' : 'none';
    
    if (show) {
      loadingSection.classList.add('fade-in');
    }
  }
  
  if (analyzeBtn) {
    analyzeBtn.disabled = show;
    
    if (show) {
      analyzeBtn.innerHTML = `
        <span class="btn-icon">⏳</span>
        <span class="btn-text">Analyzing...</span>
      `;
    } else {
      analyzeBtn.innerHTML = `
        <span class="btn-icon">🚀</span>
        <span class="btn-text">Analyze Wallets</span>
      `;
    }
  }
  
  // Update progress
  if (show && progressFill && progressText) {
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;
  }
  
  // Update details
  if (show && loadingDetails && details) {
    loadingDetails.textContent = details;
  }
}

/**
 * Update loading progress
 */
function updateProgress(current, total, currentItem = '') {
  const progress = total > 0 ? (current / total) * 100 : 0;
  const details = currentItem 
    ? `Processing ${current}/${total}: ${currentItem}...`
    : `Processing ${current}/${total}...`;
  
  showLoading(true, progress, details);
}

/**
 * Show error message with enhanced styling
 */
function showError(message, details = '') {
  const errorSection = document.getElementById('error-section');
  const errorMessage = document.getElementById('error-message');
  
  if (errorSection && errorMessage) {
    errorMessage.innerHTML = message;
    
    if (details) {
      errorMessage.innerHTML += `<br><small style="opacity: 0.8;">${details}</small>`;
    }
    
    errorSection.style.display = 'block';
    errorSection.classList.add('fade-in');
    
    // Auto-hide after 10 seconds unless it's a critical error
    if (!message.toLowerCase().includes('critical')) {
      setTimeout(() => {
        hideError();
      }, 10000);
    }
  }
  
  debugLog(`Error: ${message}`, 'error');
}

/**
 * Hide error message
 */
function hideError() {
  const errorSection = document.getElementById('error-section');
  if (errorSection) {
    errorSection.style.display = 'none';
  }
}

/**
 * Display analysis results with enhanced categorization
 */
function displayResults(results, analysisData) {
  currentResults = results;
  
  const resultsSection = document.getElementById('results');
  const statsDiv = document.getElementById('stats');
  
  if (!resultsSection || !statsDiv) {
    showError('UI components missing');
    return;
  }
  
  // Calculate statistics
  const allCount = results.allTokens.length;
  const someCount = results.someTokens.length;
  const noneCount = results.noTokens.length;
  const totalWallets = allCount + someCount + noneCount;
  const successRate = totalWallets > 0 ? ((allCount + someCount) / totalWallets * 100).toFixed(1) : 0;
  
  // Update statistics grid
  statsDiv.innerHTML = `
    <div class="stat-card perfect-match">
      <div class="stat-icon">🎯</div>
      <div class="stat-number">${allCount}</div>
      <div class="stat-label">Perfect Match</div>
      <div class="stat-sublabel">All tokens found</div>
    </div>
    <div class="stat-card partial-match">
      <div class="stat-icon">⚡</div>
      <div class="stat-number">${someCount}</div>
      <div class="stat-label">Partial Match</div>
      <div class="stat-sublabel">Some tokens found</div>
    </div>
    <div class="stat-card no-match">
      <div class="stat-icon">❌</div>
      <div class="stat-number">${noneCount}</div>
      <div class="stat-label">No Match</div>
      <div class="stat-sublabel">No tokens found</div>
    </div>
    <div class="stat-card success-rate">
      <div class="stat-icon">📊</div>
      <div class="stat-number">${successRate}%</div>
      <div class="stat-label">Success Rate</div>
      <div class="stat-sublabel">Wallets with tokens</div>
    </div>
    <div class="stat-card total-wallets">
      <div class="stat-icon">👛</div>
      <div class="stat-number">${totalWallets}</div>
      <div class="stat-label">Total Wallets</div>
      <div class="stat-sublabel">Analyzed</div>
    </div>
    <div class="stat-card analysis-time">
      <div class="stat-icon">⏱️</div>
      <div class="stat-number">${analysisData?.duration || 'N/A'}</div>
      <div class="stat-label">Analysis Time</div>
      <div class="stat-sublabel">Duration</div>
    </div>
  `;
  
  // Update tab counts
  updateTabCounts(allCount, someCount, noneCount);
  
  // Populate category results
  populateCategoryResults('all', results.allTokens, analysisData?.tokenCount);
  populateCategoryResults('some', results.someTokens, analysisData?.tokenCount);
  populateCategoryResults('none', results.noTokens, analysisData?.tokenCount);
  
  // Show results section
  resultsSection.style.display = 'block';
  resultsSection.classList.add('fade-in');
  
  // Show the active category
  showCategory(currentCategory);
  
  debugLog(`Results displayed: ${totalWallets} wallets analyzed`, 'success');
}

/**
 * Update tab counts
 */
function updateTabCounts(allCount, someCount, noneCount) {
  const tabAll = document.getElementById('tab-all');
  const tabSome = document.getElementById('tab-some');
  const tabNone = document.getElementById('tab-none');
  
  if (tabAll) tabAll.innerHTML = `🎯 ALL Tokens <span class="tab-count">${allCount}</span>`;
  if (tabSome) tabSome.innerHTML = `⚡ SOME Tokens <span class="tab-count">${someCount}</span>`;
  if (tabNone) tabNone.innerHTML = `❌ NO Tokens <span class="tab-count">${noneCount}</span>`;
}

/**
 * Populate category results
 */
function populateCategoryResults(category, wallets, totalTokens = 0) {
  const resultsDiv = document.getElementById(`results-${category}`);
  if (!resultsDiv) return;
  
  if (wallets.length === 0) {
    resultsDiv.innerHTML = `
      <div class="empty-category">
        <div class="empty-icon">${getEmptyIcon(category)}</div>
        <div class="empty-message">No wallets in this category</div>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  wallets.forEach((wallet, index) => {
    const foundCount = wallet.foundTokens?.length || 0;
    const statusClass = getWalletStatusClass(category);
    const statusText = getWalletStatusText(category, foundCount, totalTokens);
    
    html += `
      <div class="wallet-result ${statusClass}" data-wallet="${wallet.walletAddress}">
        <div class="wallet-header">
          <div class="wallet-address">
            <span class="wallet-icon">📁</span>
            <code class="address-text">${wallet.walletAddress}</code>
            <button class="copy-btn" data-copy="${wallet.walletAddress}" title="Copy address">
              📋
            </button>
          </div>
          <div class="wallet-status ${statusClass}">
            ${statusText}
          </div>
        </div>
        
        ${wallet.error ? `
          <div class="wallet-error">
            <span class="error-icon">⚠️</span>
            <span class="error-text">${wallet.error}</span>
          </div>
        ` : ''}
        
        ${wallet.foundTokens && wallet.foundTokens.length > 0 ? `
          <div class="token-list">
            ${wallet.foundTokens.map(token => `
              <div class="token-item">
                <div class="token-header">
                  <div class="token-info">
                    <span class="token-symbol">${token.symbol}</span>
                    <span class="token-name">${token.name}</span>
                  </div>
                  <div class="token-balance">
                    ${token.balance} ${token.symbol}
                  </div>
                </div>
                <div class="token-address">
                  <code>${token.address}</code>
                  <button class="copy-btn" data-copy="${token.address}" title="Copy token address">
                    📋
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : category !== 'none' ? `
          <div class="no-tokens-found">
            <span class="info-icon">ℹ️</span>
            <span>No matching tokens found in this wallet</span>
          </div>
        ` : ''}
      </div>
    `;
  });
  
  resultsDiv.innerHTML = html;
  
  // Add event listeners to copy buttons
  const copyButtons = resultsDiv.querySelectorAll('.copy-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy;
      copyToClipboard(text);
    });
  });
}

/**
 * Show specific category tab
 */
function showCategory(category) {
  currentCategory = category;
  
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeTab = document.getElementById(`tab-${category}`);
  if (activeTab) {
    activeTab.classList.add('active');
  }
  
  // Update category sections
  document.querySelectorAll('.category-section').forEach(section => {
    section.classList.remove('active');
  });
  
  const activeSection = document.getElementById(`category-${category}`);
  if (activeSection) {
    activeSection.classList.add('active');
  }
  
  debugLog(`Switched to category: ${category}`);
}

/**
 * Helper functions for wallet display
 */
function getEmptyIcon(category) {
  const icons = { all: '🎯', some: '⚡', none: '❌' };
  return icons[category] || '📭';
}

function getWalletStatusClass(category) {
  const classes = { all: 'status-perfect', some: 'status-partial', none: 'status-empty' };
  return classes[category] || '';
}

function getWalletStatusText(category, foundCount, totalTokens) {
  switch (category) {
    case 'all':
      return `<span class="status-icon">✅</span> Complete (${foundCount}/${totalTokens})`;
    case 'some':
      return `<span class="status-icon">⚡</span> Partial (${foundCount}/${totalTokens})`;
    case 'none':
      return `<span class="status-icon">❌</span> Empty (0/${totalTokens})`;
    default:
      return '';
  }
}

/**
 * Validation and input handling functions
 */
function validateInputs() {
  const walletsInput = document.getElementById('wallets').value.trim();
  const tokensInput = document.getElementById('tokens').value.trim();
  
  if (!walletsInput || !tokensInput) {
    showError('Please provide both wallet and token addresses');
    return false;
  }
  
  const wallets = parseAddressInput(walletsInput);
  const tokens = parseAddressInput(tokensInput);
  
  const walletValidation = validateAddressesClientSide(wallets);
  const tokenValidation = validateAddressesClientSide(tokens);
  
  showValidationResults(walletValidation, tokenValidation);
  
  return walletValidation.invalid.length === 0 && tokenValidation.invalid.length === 0;
}

/**
 * Show validation results
 */
function showValidationResults(walletValidation, tokenValidation) {
  const validationSection = document.getElementById('validation-results');
  const validationContent = document.getElementById('validation-content');
  
  if (!validationSection || !validationContent) return;
  
  let html = '';
  
  // Wallet validation results
  html += `
    <div class="validation-group">
      <h4>📁 Wallet Addresses</h4>
      <div class="validation-stats">
        <span class="valid-count">✅ ${walletValidation.valid.length} valid</span>
        <span class="invalid-count">❌ ${walletValidation.invalid.length} invalid</span>
      </div>
      ${walletValidation.invalid.length > 0 ? `
        <div class="invalid-addresses">
          <h5>Invalid wallet addresses:</h5>
          <ul>
            ${walletValidation.invalid.map(addr => `<li><code>${addr}</code></li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
  
  // Token validation results
  html += `
    <div class="validation-group">
      <h4>🪙 Token Addresses</h4>
      <div class="validation-stats">
        <span class="valid-count">✅ ${tokenValidation.valid.length} valid</span>
        <span class="invalid-count">❌ ${tokenValidation.invalid.length} invalid</span>
      </div>
      ${tokenValidation.invalid.length > 0 ? `
        <div class="invalid-addresses">
          <h5>Invalid token addresses:</h5>
          <ul>
            ${tokenValidation.invalid.map(addr => `<li><code>${addr}</code></li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
  
  validationContent.innerHTML = html;
  validationSection.style.display = 'block';
  validationSection.classList.add('fade-in');
}

/**
 * Utility functions
 */
function clearInputs() {
  document.getElementById('wallets').value = '';
  document.getElementById('tokens').value = '';
  updateInputCounters();
  hideAllResults();
  clearStorage();
  debugLog('Inputs cleared');
}

function hideAllResults() {
  document.getElementById('results').style.display = 'none';
  document.getElementById('validation-results').style.display = 'none';
  hideError();
}

function retryAnalysis() {
  hideError();
  startAnalysis();
}

/**
 * Storage functions
 */
function saveInputsToStorage() {
  try {
    const wallets = document.getElementById('wallets').value;
    const tokens = document.getElementById('tokens').value;
    
    localStorage.setItem('ethereum-analyzer-wallets', wallets);
    localStorage.setItem('ethereum-analyzer-tokens', tokens);
  } catch (error) {
    debugLog('Failed to save inputs to storage', 'warning');
  }
}

function loadSavedInputs() {
  try {
    const savedWallets = localStorage.getItem('ethereum-analyzer-wallets');
    const savedTokens = localStorage.getItem('ethereum-analyzer-tokens');
    
    if (savedWallets) {
      document.getElementById('wallets').value = savedWallets;
    }
    
    if (savedTokens) {
      document.getElementById('tokens').value = savedTokens;
    }
    
    updateInputCounters();
  } catch (error) {
    debugLog('Failed to load saved inputs', 'warning');
  }
}

function clearStorage() {
  try {
    localStorage.removeItem('ethereum-analyzer-wallets');
    localStorage.removeItem('ethereum-analyzer-tokens');
  } catch (error) {
    debugLog('Failed to clear storage', 'warning');
  }
}

/**
 * Copy to clipboard functionality
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Copied to clipboard!');
  }).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('📋 Copied to clipboard!');
  });
}

/**
 * Show toast notification
 */
function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 100);
  
  // Remove toast
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, duration);
}

/**
 * Export results functionality
 */
function exportResults() {
  if (!currentResults) {
    showError('No results to export');
    return;
  }
  
  const data = {
    timestamp: new Date().toISOString(),
    analysis: {
      totalWallets: currentResults.allTokens.length + currentResults.someTokens.length + currentResults.noTokens.length,
      perfectMatch: currentResults.allTokens.length,
      partialMatch: currentResults.someTokens.length,
      noMatch: currentResults.noTokens.length
    },
    results: currentResults
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `ethereum-wallet-analysis-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
  
  showToast('📄 Results exported!');
  debugLog('Results exported to JSON file');
}

/**
 * Share results functionality
 */
function shareResults() {
  if (!currentResults) {
    showError('No results to share');
    return;
  }
  
  const shareData = {
    title: 'Ethereum Wallet Analysis Results',
    text: `Found ${currentResults.allTokens.length} perfect matches, ${currentResults.someTokens.length} partial matches, and ${currentResults.noTokens.length} empty wallets.`,
    url: window.location.href
  };
  
  if (navigator.share) {
    navigator.share(shareData).catch(() => {
      fallbackShare(shareData);
    });
  } else {
    fallbackShare(shareData);
  }
}

function fallbackShare(shareData) {
  const shareText = `${shareData.text}\n\n${shareData.url}`;
  copyToClipboard(shareText);
  showToast('🔗 Share link copied to clipboard!');
}

/**
 * Help function
 */
function showHelp() {
  const helpContent = `
    <h3>🔍 How to Use Ethereum Wallet Analyzer</h3>
    <ol>
      <li><strong>Add Wallet Addresses:</strong> Enter Ethereum wallet addresses (0x...) one per line in the left textarea</li>
      <li><strong>Add Token Addresses:</strong> Enter ERC-20 token contract addresses one per line in the right textarea</li>
      <li><strong>Validate (Optional):</strong> Click "Validate Addresses" to check for format errors</li>
      <li><strong>Analyze:</strong> Click "Analyze Wallets" to start the blockchain analysis</li>
      <li><strong>View Results:</strong> Results are categorized into ALL/SOME/NO tokens found</li>
    </ol>
    
    <h4>💡 Tips:</h4>
    <ul>
      <li>Use Ctrl+Enter to quickly start analysis</li>
      <li>Maximum 50 wallets and 20 tokens per analysis</li>
      <li>Analysis may take 1-2 minutes for large datasets</li>
      <li>Results can be exported as JSON or shared</li>
    </ul>
  `;
  
  showModal('Help & Instructions', helpContent);
}

function showModal(title, content) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.remove());
  }
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

/**
 * Utility function for debouncing
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
