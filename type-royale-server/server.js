const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

// Import database and models
const sequelize = require('./database.js');
const { testConnection, syncDatabase } = require('./database.js');
require('./models/index.js'); // Load model associations

// Import routes
const authRoutes = require('./routes/auth.js');
const wordRoutes = require('./routes/words.js');

// Import middleware
const { generalRateLimit } = require('./middleware/auth.js');

// Load environment variables
dotenv.config();

class TypeRoyaleServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable for API
      crossOriginEmbedderPolicy: false
    }));
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-frontend-domain.com'] 
        : ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Rate limiting
    this.app.use(generalRateLimit);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        message: 'Type Royale Backend is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/words', wordRoutes);

    // API documentation
    this.app.get('/api', (req, res) => {
      res.json({
        success: true,
        message: 'Type Royale: Spellcaster Duel API',
        version: '1.0.0',
        endpoints: {
          auth: {
            'POST /api/auth/register': 'Register new spellcaster',
            'POST /api/auth/login': 'Login spellcaster',
            'GET /api/auth/profile': 'Get spellcaster profile',
            'PUT /api/auth/profile': 'Update spellcaster profile',
            'GET /api/auth/leaderboard': 'Get top spellcasters'
          },
          words: {
            'POST /api/words/generate-ammo': 'Generate 50-word ammo pool',
            'GET /api/words/spell/:type/:difficulty': 'Get spell word for card',
            'GET /api/words/card-deck': 'Get card deck words',
            'GET /api/words/stats': 'Word bank statistics',
            'POST /api/words/regenerate': 'Regenerate words (admin)'
          }
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl
      });
    });
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('💥 Global error handler:', error);
      
      // Sequelize validation errors
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path,
            message: e.message
          }))
        });
      }

      // JWT errors
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      // Default error response
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    });
  }

  async start() {
    try {
      // Test database connection
      console.log('🔮 Starting Type Royale Backend Server...');
      
      const dbConnected = await testConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }

      // Sync database models
      await syncDatabase(false); // Set to true to drop tables

      // Start server
      this.app.listen(this.port, () => {
        console.log('🎮 =================================');
        console.log(`⚡ Type Royale Backend Server running on port ${this.port}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📊 Database: PostgreSQL (${process.env.DB_NAME})`);
        console.log('🔥 Ready for spellcaster duels!');
        console.log('🎮 =================================');
      });

    } catch (error) {
      console.error('💀 Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start server
const server = new TypeRoyaleServer();
server.start();

module.exports = TypeRoyaleServer;