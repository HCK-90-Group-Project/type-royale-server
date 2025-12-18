require("dotenv").config();

// Import optional security middleware
let helmet;
try {
  helmet = require("helmet");
} catch (e) {
  console.warn("⚠️ Helmet not installed - security headers disabled");
  helmet = null;
}

// Import app, server, and io from app.js
const { app, server, io } = require("./app.js");

// Import database and models
const sequelize = require("./database.js");
const { testConnection, syncDatabase } = require("./database.js");
require("./models/index.js"); // Load model associations

// Import routes
const authRoutes = require("./routes/auth.js");
const wordRoutes = require("./routes/words.js");

// Import socket handlers
const setupSocketHandlers = require("./socketHandlers/index.js");

// Import middleware
const { generalRateLimit } = require("./middleware/auth.js");

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Security middleware (optional)
if (helmet) {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
}

// Rate limiting
app.use(generalRateLimit);

// Health check route
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Type Royale Backend is running",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/words", wordRoutes);

// API documentation
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Type Royale: Spellcaster Duel API",
    version: "1.0.0",
    endpoints: {
      auth: {
        "POST /api/auth/register": "Register new spellcaster",
        "POST /api/auth/login": "Login spellcaster",
        "GET /api/auth/profile": "Get spellcaster profile",
        "PUT /api/auth/profile": "Update spellcaster profile",
        "GET /api/auth/leaderboard": "Get top spellcasters",
      },
      words: {
        "POST /api/words/generate-ammo": "Generate 50-word ammo pool",
        "GET /api/words/spell/:type/:difficulty": "Get spell word for card",
        "GET /api/words/card-deck": "Get card deck words",
        "GET /api/words/stats": "Word bank statistics",
        "POST /api/words/regenerate": "Regenerate words (admin)",
      },
    },
  });
});

// Setup Socket.io handlers
setupSocketHandlers(io);

// 404 handler (catch-all)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("💥 Global error handler:", error);

  // Sequelize validation errors
  if (error.name === "SequelizeValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: error.errors.map((e) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  // JWT errors
  if (error.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message:
      NODE_ENV === "production" ? "Internal server error" : error.message,
    ...(NODE_ENV === "development" && { stack: error.stack }),
  });
});

// Server startup
async function startServer() {
  try {
    console.log("🔮 Starting Type Royale Backend Server...");

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error("Database connection failed");
    }

    // Sync database models
    await syncDatabase(false);

    // Start server
    server.listen(PORT, () => {
      console.log("🎮 =================================");
      console.log(`⚡ Type Royale Backend Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`📊 Database: PostgreSQL (${process.env.DB_NAME})`);
      console.log("📡 Socket.io ready for WebSocket connections");
      console.log("🔥 Ready for spellcaster duels!");
      console.log("🎮 =================================");
    });
  } catch (error) {
    console.error("💀 Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("📴 SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("⚠️ SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

// Start the server
startServer();
