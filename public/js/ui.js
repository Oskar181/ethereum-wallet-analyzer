/**
 * UI Layer - Handles all user interface interactions and state management
 * Enhanced with professional animations and user experience features
 * POPRAWIONA WERSJA z USD pricing debugging
 */

// Global UI state
let currentResults = null;
let currentCategory = 'all';
let debugDiv;
let selectedNetwork = 'ethereum'; // Default network

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
  
  // Load saved inputs and network from localStorage
  loadSavedInputs();
  loadSavedNetwork();
  
  debugLog('UI initialized successfully');
}

/**
 * Setup event listeners for interactive elements
 */
function setupEventListeners() {
  // Input change listeners for real-time validation
  const walletsInput = document.getElementById('wallets');
  const tokensInput = document.getElementById('tokens');
  const networkSelector = document.getElementById('network-selector');
  
  if (walletsInput) {
    walletsInput.addEventListener('input', debounce(handleWalletsInput, 300));
    walletsInput.addEventListener('paste', handlePasteEvent);
  }
  
  if (tokensInput) {
    tokensInput.addEventListener('input', debounce(handleTokensInput, 300));
    tokensInput.addEventListener('paste', handlePasteEvent);
  }

  // Network selector change listener
  if (networkSelector) {
    networkSelector.addEventListener('change', handleNetworkChange);
  }
  
  // Main action buttons
  const analyzeBtn = document.getElementById('analyze-btn');
  const validateBtn = document.getElementById('validate-btn');
  const clearBtn = document.getElementById('clear-btn');
  const debugToggle = document.getElementById('debug-toggle');
  const retryBtn = document.getElementById('retry-btn');
  
  if (analyzeBtn) analyzeBtn.addEventListener('click', startAnalysis);
  if (validateBtn) validateBtn.addEventListener('click', validateInputsUI);
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
 * Handle network selector change
 */
function handleNetworkChange(event) {
  const newNetwork = event.target.value;
  selectedNetwork = newNetwork;
  
  // Save to localStorage
  saveNetworkToStorage();
  
  // Update UI feedback
  const networkIcon = getNetworkIcon(newNetwork);
  const networkName = getNetworkName(newNetwork);
  
  debugLog(`🌐 Network changed to: ${networkIcon} ${networkName}`, 'info');
  
  // Show toast notification
  showToast(`🌐 Switched to ${networkName}`);
  
  // Clear previous results when switching networks
  if (currentResults) {
    hideAllResults();
    debugLog('Previous results cleared due to network change', 'info');
  }
}

/**
 * Get network icon for display
 */
function getNetworkIcon(network) {
  const icons = {
    'ethereum': '🔷',
    'base': '🔵'
  };
  return icons[network] || '🌐';
}

/**
 * Get network display name
 */
function getNetworkName(network) {
  const names = {
    'ethereum': 'Ethereum Mainnet',
    'base': 'Base Mainnet'
  };
  return names[network] || 'Unknown Network';
}

/**
 * Get currently selected network
 */
function getSelectedNetwork() {
  return selectedNetwork;
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
  const networkName = getNetworkName(selectedNetwork);
  const details = currentItem 
    ? `Analyzing on ${networkName}: ${current}/${total} - ${currentItem}...`
    : `Processing on ${networkName}: ${current}/${total}...`;
  
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
  
  // Get network info for display
  const networkIcon = getNetworkIcon(selectedNetwork);
  const networkName = getNetworkName(selectedNetwork);
  
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
      <div class="stat-sublabel">on ${networkIcon} ${networkName}</div>
    </div>
  `;
  
  // Update tab counts
  updateTabCounts(allCount, someCount, noneCount);
  
  // Populate category results - USING ENHANCED VERSION
  populateCategoryResultsWithDebug('all', results.allTokens, analysisData?.tokenCount);
  populateCategoryResultsWithDebug('some', results.someTokens, analysisData?.tokenCount);
  populateCategoryResultsWithDebug('none', results.noTokens, analysisData?.tokenCount);
  
  // Show results section
  resultsSection.style.display = 'block';
  resultsSection.classList.add('fade-in');
  
  // Show the active category
  showCategory(currentCategory);
  
  debugLog(`Results displayed: ${totalWallets} wallets analyzed on ${networkName}`, 'success');
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
 * ENHANCED TOKEN ITEM with USD debugging info - NOWA FUNKCJA
 */
function createTokenItemHTML(token) {
  const hasPriceData = token.priceUsd !== null && token.priceUsd !== undefined;
  const hasUsdValue = token.usdValueFormatted && token.usdValue > 0;
  
  // Debug information for pricing
  const debugInfo = `
    <!-- Pricing Debug Info -->
    <!-- Price USD: ${token.priceUsd} -->
    <!-- USD Value: ${token.usdValue} -->
    <!-- USD Formatted: ${token.usdValueFormatted} -->
    <!-- Price Source: ${token.priceSource} -->
    <!-- Price Error: ${token.priceError} -->
    <!-- Balance: ${token.balance} -->
  `;
  
  return `
    <div class="token-item">
      ${debugInfo}
      <div class="token-header">
        <div class="token-info">
          <span class="token-symbol">${token.symbol}</span>
          <span class="token-name">${token.name}</span>
        </div>
        <div class="token-balance">
          <div class="balance-amount">${token.balance} ${token.symbol}</div>
          ${hasUsdValue ? `
            <div class="balance-usd" style="color: #4caf50; font-weight: bold;">${token.usdValueFormatted}</div>
          ` : ''}
          ${hasPriceData && !hasUsdValue ? `
            <div class="balance-usd-error" style="color: #ff9800; font-size: 0.8rem;">
              Price: $${parseFloat(token.priceUsd).toFixed(6)} (calc error)
            </div>
          ` : ''}
          ${!hasPriceData && token.priceError ? `
            <div class="balance-usd-error" style="color: #f44336; font-size: 0.8rem;">
              No price data
            </div>
          ` : ''}
          ${token.priceUsd && hasPriceData ? `
            <div class="token-price">
              $${parseFloat(token.priceUsd).toFixed(token.priceUsd < 0.01 ? 6 : 4)}
              ${token.priceChange24h ? `
                <span class="price-change ${token.priceChange24h >= 0 ? 'positive' : 'negative'}">
                  ${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%
                </span>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>
      <div class="token-address">
        <code>${token.address}</code>
        <button class="copy-btn" data-copy="${token.address}" title="Copy token address">
          📋
        </button>
      </div>
      ${token.priceSource ? `
        <div class="price-source">
          <small>Price from ${token.priceSource}</small>
        </div>
      ` : ''}
      ${token.priceError ? `
        <div class="price-error" style="color: #f44336; font-size: 0.75rem; font-style: italic;">
          ⚠️ ${token.priceError}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * ENHANCED WALLET RESULT with USD debugging - NOWA FUNKCJA
 */
function createWalletResultHTML(wallet, category, totalTokens) {
  const foundCount = wallet.foundTokens?.length || 0;
  const statusClass = getWalletStatusClass(category);
  const statusText = getWalletStatusText(category, foundCount, totalTokens);
  
  // Calculate USD totals with debug info
  const tokensWithUsd = wallet.foundTokens?.filter(t => t.usdValue && t.usdValue > 0) || [];
  const tokensWithPrices = wallet.foundTokens?.filter(t => t.priceUsd && t.priceUsd > 0) || [];
  const tokensWithErrors = wallet.foundTokens?.filter(t => t.priceError) || [];
  
  return `
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
      
      <!-- USD DEBUG INFO -->
      <div class="usd-debug-info" style="background: rgba(66, 165, 245, 0.1); padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 0.8rem;">
        💰 USD Debug: ${tokensWithUsd.length}/${foundCount} tokens have USD values | 
        📊 ${tokensWithPrices.length} have prices | 
        ${tokensWithErrors.length > 0 ? `⚠️ ${tokensWithErrors.length} price errors` : '✅ No price errors'}
      </div>
      
      ${wallet.error ? `
        <div class="wallet-error">
          <span class="error-icon">⚠️</span>
          <span class="error-text">${wallet.error}</span>
        </div>
      ` : ''}
      
      ${wallet.foundTokens && wallet.foundTokens.length > 0 ? `
        <div class="token-list">
          ${wallet.foundTokens.map(token => createTokenItemHTML(token)).join('')}
        </div>
       ${wallet.totalUsdValueFormatted && wallet.totalUsdValue > 0 ? `
  <div class="wallet-total-value">
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <div>
        <strong>🎯 Selected Tokens Value: ${wallet.totalUsdValueFormatted}</strong>
        <small style="display: block; opacity: 0.8; font-weight: normal; margin-top: 4px;">
          📊 Sum of ${wallet.foundTokens?.length || 0} matching token(s)
        </small>
      </div>
      <button 
        onclick="showPortfolioValueInfo()" 
        style="background: none; border: 1px solid #4caf50; color: #4caf50; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;"
        title="What does this mean?"
      >
        ❓
      </button>
    </div>
  </div>
` : `
  <div class="wallet-total-value" style="color: #ff9800;">
    ⚠️ Selected Tokens Value: Unable to calculate (missing price data)
  </div>
`}
      ` : category !== 'none' ? `
        <div class="no-tokens-found">
          <span class="info-icon">ℹ️</span>
          <span>No matching tokens found in this wallet</span>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * ENHANCED populateCategoryResults with debugging - POPRAWIONA WERSJA
 */
function populateCategoryResultsWithDebug(category, wallets, totalTokens = 0) {
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
  
  // Debug summary - calculate totals for debugging
  const totalTokensWithPrices = wallets.reduce((sum, wallet) => {
    return sum + (wallet.foundTokens?.filter(t => t.priceUsd && t.priceUsd > 0).length || 0);
  }, 0);
  
  const totalTokensWithUsdValues = wallets.reduce((sum, wallet) => {
    return sum + (wallet.foundTokens?.filter(t => t.usdValue && t.usdValue > 0).length || 0);
  }, 0);
  
  const totalUsdValue = wallets.reduce((sum, wallet) => {
    return sum + (wallet.totalUsdValue || 0);
  }, 0);
  
  // Create USD value formatter (simplified version for UI)
  const formatUsdValue = (value) => {
    if (!value || value === 0) return '$0.00';
    if (value < 1000) return `$${value.toFixed(2)}`;
    if (value < 1000000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${(value / 1000000).toFixed(2)}M`;
  };
  
  let html = `
    <div class="category-debug-summary" style="background: rgba(129, 199, 132, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
      <h4 style="color: #4caf50; margin: 0 0 8px 0;">📊 USD Pricing Summary for ${category.toUpperCase()} category:</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; font-size: 0.9rem;">
        <div>💰 Total USD Value: <strong>${formatUsdValue(totalUsdValue)}</strong></div>
        <div>📊 Tokens with prices: <strong>${totalTokensWithPrices}</strong></div>
        <div>💵 Tokens with USD values: <strong>${totalTokensWithUsdValues}</strong></div>
        <div>📈 Success rate: <strong>${totalTokensWithPrices > 0 ? ((totalTokensWithUsdValues/totalTokensWithPrices)*100).toFixed(1) : 0}%</strong></div>
      </div>
    </div>
  `;
  
  // Add wallet results
  wallets.forEach((wallet, index) => {
    html += createWalletResultHTML(wallet, category, totalTokens);
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
  
  // Log debug info
  debugLog(`🎯 Category ${category}: ${wallets.length} wallets, $${totalUsdValue.toFixed(2)} total value`);
}

/**
 * LEGACY populateCategoryResults for backward compatibility
 */
function populateCategoryResults(category, wallets, totalTokens = 0) {
  // Use the enhanced version
  populateCategoryResultsWithDebug(category, wallets, totalTokens);
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
function validateInputsUI() {
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
  
  const networkName = getNetworkName(selectedNetwork);
  
  let html = '';
  
  // Network info
  html += `
    <div class="validation-group">
      <h4>🌐 Selected Network</h4>
      <p>Analysis will be performed on: <strong>${networkName}</strong></p>
    </div>
  `;
  
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
  const walletsEl = document.getElementById('wallets');
  const tokensEl = document.getElementById('tokens');
  
  if (walletsEl) walletsEl.value = '';
  if (tokensEl) tokensEl.value = '';
  
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
    const walletsEl = document.getElementById('wallets');
    const tokensEl = document.getElementById('tokens');
    
    if (walletsEl) {
      localStorage.setItem('wallet-analyzer-wallets', walletsEl.value);
    }
    if (tokensEl) {
      localStorage.setItem('wallet-analyzer-tokens', tokensEl.value);
    }
  } catch (error) {
    debugLog('Failed to save inputs to storage: ' + error.message, 'warning');
  }
}

function saveNetworkToStorage() {
  try {
    localStorage.setItem('wallet-analyzer-network', selectedNetwork);
  } catch (error) {
    debugLog('Failed to save network to storage: ' + error.message, 'warning');
  }
}

function loadSavedInputs() {
  try {
    const savedWallets = localStorage.getItem('wallet-analyzer-wallets');
    const savedTokens = localStorage.getItem('wallet-analyzer-tokens');
    
    const walletsEl = document.getElementById('wallets');
    const tokensEl = document.getElementById('tokens');
    
    if (savedWallets && walletsEl) {
      walletsEl.value = savedWallets;
    }
    
    if (savedTokens && tokensEl) {
      tokensEl.value = savedTokens;
    }
    
    updateInputCounters();
    debugLog('Saved inputs loaded successfully');
  } catch (error) {
    debugLog('Failed to load saved inputs: ' + error.message, 'warning');
  }
}

function loadSavedNetwork() {
  try {
    const savedNetwork = localStorage.getItem('wallet-analyzer-network');
    if (savedNetwork) {
      selectedNetwork = savedNetwork;
      const networkSelector = document.getElementById('network-selector');
      if (networkSelector) {
        networkSelector.value = savedNetwork;
      }
      debugLog(`Loaded saved network: ${getNetworkName(savedNetwork)}`, 'info');
    }
  } catch (error) {
    debugLog('Failed to load saved network: ' + error.message, 'warning');
  }
}

function clearStorage() {
  try {
    localStorage.removeItem('wallet-analyzer-wallets');
    localStorage.removeItem('wallet-analyzer-tokens');
    localStorage.removeItem('wallet-analyzer-network');
    debugLog('Storage cleared successfully');
  } catch (error) {
    debugLog('Failed to clear storage: ' + error.message, 'warning');
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
    network: {
      name: getNetworkName(selectedNetwork),
      value: selectedNetwork,
      icon: getNetworkIcon(selectedNetwork)
    },
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
  a.download = `wallet-analysis-${selectedNetwork}-${Date.now()}.json`;
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
  
  const networkName = getNetworkName(selectedNetwork);
  
  const shareData = {
    title: 'Multi-Chain Wallet Analysis Results',
    text: `Found ${currentResults.allTokens.length} perfect matches, ${currentResults.someTokens.length} partial matches, and ${currentResults.noTokens.length} empty wallets on ${networkName}.`,
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
    <h3>🔍 How to Use Wallet Analyzer</h3>
    <ol>
      <li><strong>Select Network:</strong> Choose the blockchain network (Ethereum or Base) for analysis</li>
      <li><strong>Add Wallet Addresses:</strong> Enter wallet addresses (0x...) one per line in the left textarea</li>
      <li><strong>Add Token Addresses:</strong> Enter token contract addresses one per line in the right textarea</li>
      <li><strong>Validate (Optional):</strong> Click "Validate Addresses" to check for format errors</li>
      <li><strong>Analyze:</strong> Click "Analyze Wallets" to start the blockchain analysis</li>
      <li><strong>View Results:</strong> Results are categorized into ALL/SOME/NO tokens found</li>
    </ol>
    
    <h4>🌐 Supported Networks:</h4>
    <ul>
      <li><strong>🔷 Ethereum Mainnet:</strong> The original Ethereum blockchain</li>
      <li><strong>🔵 Base Mainnet:</strong> Coinbase's Layer 2 solution built on Optimism</li>
    </ul>
    
    <h4>💡 Tips:</h4>
    <ul>
      <li>Use Ctrl+Enter to quickly start analysis</li>
      <li>Use Ctrl+Shift+T to test USD pricing</li>
      <li>Maximum 50 wallets and 20 tokens per analysis</li>
      <li>Analysis may take 1-2 minutes for large datasets</li>
      <li>Results can be exported as JSON or shared</li>
      <li>Network selection is saved automatically</li>
      <li>USD pricing debug info shows in results</li>
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

// =====================================================================
// ENHANCED USD PRICING DEBUGGING FUNCTIONS - DODANE
// =====================================================================

/**
 * Test USD pricing functionality - NOWA FUNKCJA
 */
async function testUsdPricing() {
  debugLog('🧪 Testing USD pricing functionality...', 'info');
  
  const testTokens = [
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', // SHIB
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'  // WBTC
  ];
  
  const selectedNetwork = getSelectedNetwork();
  
  try {
    debugLog(`🔄 Testing price fetch for ${testTokens.length} tokens on ${getNetworkName(selectedNetwork)}`);
    
    const response = await fetch('/api/test-pricing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokens: testTokens,
        network: selectedNetwork
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      debugLog('✅ USD pricing test successful', 'success');
      debugLog(`📊 Test Results Summary:`, 'info');
      debugLog(`   • Success Rate: ${result.summary.successRate}%`, 'info');
      debugLog(`   • Tokens with Prices: ${result.summary.withPrices}/${result.summary.totalTests}`, 'info');
      debugLog(`   • Can Calculate USD: ${result.summary.canCalculateUsd}`, 'info');
      debugLog(`   • DexScreener Success: ${result.summary.dexScreenerSuccess}`, 'info');
      
      // Show recommendations
      if (result.recommendations && result.recommendations.length > 0) {
        debugLog('💡 Recommendations:', 'info');
        result.recommendations.forEach(rec => debugLog(`   ${rec}`, 'info'));
      }
      
      // Show detailed results for first few tokens
      if (result.results && result.results.length > 0) {
        debugLog('🔍 Detailed Results (first 3):', 'debug');
        result.results.slice(0, 3).forEach((tokenResult, i) => {
          debugLog(`   Token ${i + 1}: ${tokenResult.blockchain.symbol || 'Unknown'}`, 'debug');
          debugLog(`     Price USD: ${tokenResult.dexScreener.priceUsd || 'N/A'}`, 'debug');
          debugLog(`     Source: ${tokenResult.dexScreener.source || 'N/A'}`, 'debug');
          debugLog(`     Overall Success: ${tokenResult.overall.success ? '✅' : '❌'}`, 'debug');
        });
      }
      
      showToast('🧪 USD Pricing Test Complete - Check Debug Console');
      
    } else {
      debugLog('❌ USD pricing test failed', 'error');
      debugLog(`Response: ${response.status} ${response.statusText}`, 'error');
      showToast('❌ USD Pricing Test Failed', 5000);
    }
  } catch (error) {
    debugLog(`❌ USD pricing test error: ${error.message}`, 'error');
    showToast('❌ USD Pricing Test Error', 5000);
  }
}

/**
 * Quick USD debugging function - NOWA FUNKCJA
 */
function debugUsdPricing() {
  if (!currentResults) {
    debugLog('⚠️ No current results to debug', 'warning');
    showToast('No analysis results to debug');
    return;
  }
  
  debugLog('🔍 USD Pricing Debug Analysis', 'info');
  
  const allWallets = [
    ...currentResults.allTokens,
    ...currentResults.someTokens,
    ...currentResults.noTokens
  ];
  
  let totalTokens = 0;
  let tokensWithPrices = 0;
  let tokensWithUsdValues = 0;
  let totalUsdValue = 0;
  
  allWallets.forEach(wallet => {
    if (wallet.foundTokens) {
      wallet.foundTokens.forEach(token => {
        totalTokens++;
        if (token.priceUsd && token.priceUsd > 0) tokensWithPrices++;
        if (token.usdValue && token.usdValue > 0) {
          tokensWithUsdValues++;
          totalUsdValue += token.usdValue;
        }
      });
    }
  });
  
  debugLog(`📊 USD Debug Summary:`, 'info');
  debugLog(`   • Total Tokens: ${totalTokens}`, 'info');
  debugLog(`   • Tokens with Prices: ${tokensWithPrices} (${(tokensWithPrices/totalTokens*100).toFixed(1)}%)`, 'info');
  debugLog(`   • Tokens with USD Values: ${tokensWithUsdValues} (${(tokensWithUsdValues/totalTokens*100).toFixed(1)}%)`, 'info');
  debugLog(`   • Total USD Value: $${totalUsdValue.toFixed(2)}`, 'info');
  debugLog(`   • Price → USD Conversion Rate: ${tokensWithPrices > 0 ? (tokensWithUsdValues/tokensWithPrices*100).toFixed(1) : 0}%`, 'info');
  
  // Find tokens with price errors
  const tokensWithErrors = [];
  allWallets.forEach(wallet => {
    if (wallet.foundTokens) {
      wallet.foundTokens.forEach(token => {
        if (token.priceError) {
          tokensWithErrors.push({
            symbol: token.symbol,
            error: token.priceError,
            wallet: wallet.walletAddress.substring(0, 10) + '...'
          });
        }
      });
    }
  });
  
  if (tokensWithErrors.length > 0) {
    debugLog(`⚠️ Tokens with Price Errors (${tokensWithErrors.length}):`, 'warning');
    tokensWithErrors.slice(0, 5).forEach(token => {
      debugLog(`   • ${token.symbol}: ${token.error}`, 'warning');
    });
    if (tokensWithErrors.length > 5) {
      debugLog(`   ... and ${tokensWithErrors.length - 5} more`, 'warning');
    }
  }
  
  showToast(`🔍 USD Debug Complete - ${tokensWithUsdValues}/${totalTokens} tokens have USD values`);
}

// Make functions globally available
window.debugLog = debugLog;
window.showError = showError;
window.hideError = hideError;
window.showLoading = showLoading;
window.updateProgress = updateProgress;
window.displayResults = displayResults;
window.showValidationResults = showValidationResults;
window.hideAllResults = hideAllResults;
window.showToast = showToast;
window.showModal = showModal;
window.getSelectedNetwork = getSelectedNetwork;
window.getNetworkName = getNetworkName;
window.getNetworkIcon = getNetworkIcon;

// ENHANCED USD PRICING FUNCTIONS - DODANE DO WINDOW
window.testUsdPricing = testUsdPricing;
window.debugUsdPricing = debugUsdPricing;
window.populateCategoryResultsWithDebug = populateCategoryResultsWithDebug;
window.createTokenItemHTML = createTokenItemHTML;
window.createWalletResultHTML = createWalletResultHTML;

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

// =====================================================================
// ENHANCED KEYBOARD SHORTCUTS - ROZSZERZONE
// =====================================================================

document.addEventListener('keydown', (event) => {
  // Ctrl/Cmd + Enter: Start analysis
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    if (!analysisInProgress && typeof startAnalysis === 'function') {
      startAnalysis();
    }
  }
  
  // Ctrl/Cmd + Shift + V: Advanced validation
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'V') {
    event.preventDefault();
    if (typeof performAdvancedValidation === 'function') {
      performAdvancedValidation();
    }
  }
  
  // Ctrl/Cmd + Shift + T: Test USD pricing - NOWE
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T') {
    event.preventDefault();
    testUsdPricing();
  }
  
  // Ctrl/Cmd + Shift + D: Debug USD pricing - NOWE
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
    event.preventDefault();
    debugUsdPricing();
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
/**
 * Show explanation about Selected Tokens Value vs Total Portfolio Value
 */
function showPortfolioValueInfo() {
  const helpContent = `
    <h3>📊 Understanding Token Values</h3>
    
    <h4>🎯 Selected Tokens Value:</h4>
    <p>This shows the <strong>total USD value</strong> of only the <strong>specific tokens</strong> you searched for that were found in the wallet.</p>
    
    <h4>💡 What this means:</h4>
    <ul>
      <li><strong>Not the complete portfolio</strong> - only your selected tokens</li>
      <li><strong>Partial view</strong> - wallet may contain other valuable tokens</li>
      <li><strong>Focused analysis</strong> - shows value of tokens you're interested in</li>
    </ul>
    
    <h4>📈 Example:</h4>
    <p>If you search for USDT and SHIB, and wallet has USDT ($500) + SHIB ($50) + ETH ($1000):</p>
    <ul>
      <li>✅ <strong>Selected Tokens Value: $550</strong> (USDT + SHIB only)</li>
      <li>❌ <strong>Real Portfolio Value: $1,550</strong> (would include ETH too)</li>
    </ul>
    
    <h4>🔍 For True Portfolio Analysis:</h4>
    <p>To see the complete portfolio value, you would need to analyze ALL ERC-20 tokens in the wallet, not just specific ones.</p>
  `;
  
  showModal('Token Values Explanation', helpContent);
}

// Make function globally available
window.showPortfolioValueInfo = showPortfolioValueInfo;
  
});

// Log enhanced shortcuts info
debugLog('💰 Enhanced USD pricing debugging loaded. Shortcuts:', 'info');
debugLog('   • Ctrl+Shift+T: Test USD pricing', 'info');
debugLog('   • Ctrl+Shift+D: Debug current USD results', 'info');
debugLog('   • Ctrl+Enter: Start analysis', 'info');
debugLog('   • Ctrl+Shift+V: Advanced validation', 'info');
debugLog('   • Ctrl+Shift+N: Focus network selector', 'info');
