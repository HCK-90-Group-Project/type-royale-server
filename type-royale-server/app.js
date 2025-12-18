require('dotenv').config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Frontend URLs for CORS
const FRONTEND_URLS = process.env.NODE_ENV === "production"
  ? [
      process.env.FRONTEND_URL || "https://typeroyale-2ddf6.web.app",
      "https://typeroyale-2ddf6.firebaseapp.com"
    ]
  : ["http://localhost:3000", "http://localhost:5173"];

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URLS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

// Middleware - Note: Helmet is applied in server.js
app.use(
  cors({
    origin: FRONTEND_URLS,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Basic route for health check
app.get("/", (req, res) => {
  res.json({
    message: "Type Royale Server Running!",
    status: "online",
    timestamp: new Date().toISOString(),
  });
});

// Export for socket handler and server
module.exports = { app, server, io };
