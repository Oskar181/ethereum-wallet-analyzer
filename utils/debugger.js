/**
 * Advanced Debug and Logging Utility
 * Professional logging system with multiple levels and formatting
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

const COLORS = process.env.NODE_ENV !== 'production' ? {
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  GREEN: '\x1b[32m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  RESET: '\x1b[0m'
} : {
  RED: '', YELLOW: '', GREEN: '', BLUE: '', MAGENTA: '', 
  CYAN: '', WHITE: '', RESET: ''
};

function getTimestamp() {
  return new Date().toISOString();
}

function formatMessage(level, message, metadata = {}) {
  const timestamp = getTimestamp();
  const pid = process.pid;
  
  let formatted = `[${timestamp}] [PID:${pid}] [${level}] ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    formatted += ` ${JSON.stringify(metadata)}`;
  }
  
  return formatted;
}

function logError(message, error = null, metadata = {}) {
  if (CURRENT_LOG_LEVEL >= LOG_LEVELS.ERROR) {
    const formattedMessage = formatMessage('ERROR', message, metadata);
    console.error(`${COLORS.RED}❌ ${formattedMessage}${COLORS.RESET}`);
    
    if (error) {
      if (error.stack) {
        console.error(`${COLORS.RED}Stack: ${error.stack}${COLORS.RESET}`);
      }
    }
  }
}

function logWarn(message, metadata = {}) {
  if (CURRENT_LOG_LEVEL >= LOG_LEVELS.WARN) {
    const formattedMessage = formatMessage('WARN', message, metadata);
    console.warn(`${COLORS.YELLOW}⚠️  ${formattedMessage}${COLORS.RESET}`);
  }
}

function logInfo(message, metadata = {}) {
  if (CURRENT_LOG_LEVEL >= LOG_LEVELS.INFO) {
    const formattedMessage = formatMessage('INFO', message, metadata);
    console.log(`${COLORS.GREEN}ℹ️  ${formattedMessage}${COLORS.RESET}`);
  }
}

function logDebug(message, metadata = {}) {
  if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
    const formattedMessage = formatMessage('DEBUG', message, metadata);
    console.log(`${COLORS.CYAN}🔍 ${formattedMessage}${COLORS.RESET}`);
  }
}

function logSuccess(message, metadata = {}) {
  const formattedMessage = formatMessage('SUCCESS', message, metadata);
  console.log(`${COLORS.GREEN}✅ ${formattedMessage}${COLORS.RESET}`);
}

class PerformanceTimer {
  constructor(name, metadata = {}) {
    this.name = name;
    this.metadata = metadata;
    this.startTime = process.hrtime.bigint();
    
    logDebug(`Timer started: ${name}`, metadata);
  }
  
  end() {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - this.startTime) / 1_000_000;
    
    const metadata = {
      ...this.metadata,
      duration: `${duration.toFixed(2)}ms`
    };
    
    logInfo(`Timer finished: ${this.name}`, metadata);
    return { duration };
  }
}

module.exports = {
  LOG_LEVELS,
  logError,
  logWarn,
  logInfo,
  logDebug,
  logSuccess,
  PerformanceTimer
};
