require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const apiRoutes = require('./routes/api');
const { logInfo, logError } = require('./utils/debugger');

const app = express();
const PORT = process.env.PORT || 10000;

// Trust proxy configuration for deployment platforms (Render, Railway, etc.)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true); // Trust first proxy (Render's load balancer)
} else {
  app.set('trust proxy', false); // Local development
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for event handlers
      connectSrc: ["'self'", "https://api.etherscan.io", "https://api.coingecko.com", "https://api.dexscreener.com"],
      imgSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", "data:"],
      frameAncestors: ["'none'"]
    },
  },
}));

// CORS configuration
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['https://*.onrender.com'])
  : ['http://localhost:10000', 'http://127.0.0.1:10000'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Rate limiting with proper proxy support
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 50 : 100, // Stricter in production
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Trust proxy setting is inherited from app.set('trust proxy')
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static('public'));

// API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Ethereum Wallet Analyzer',
    version: '2.1.0',
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Main route - serve HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logError('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
const server = app.listen(PORT, () => {
  logInfo(`✅ Ethereum Wallet Analyzer started on port ${PORT}`);
  logInfo(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  logInfo(`🔒 Trust proxy: ${app.get('trust proxy')}`);
  logInfo(`📁 Serving static files from 'public' directory`);
  logInfo(`🔑 API Key configured: ${!!process.env.ETHERSCAN_API_KEY}`);
  
  // Log CORS origins in development
  if (process.env.NODE_ENV !== 'production') {
    logInfo(`🌐 CORS origins: ${corsOrigins.join(', ')}`);
  }
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logInfo(`🛑 ${signal} received, shutting down gracefully...`);
  server.close(() => {
    logInfo('🔚 Server closed. Process terminated');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
