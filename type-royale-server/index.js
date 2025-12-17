const { server, io } = require('./app');
const setupSocketHandlers = require('./socketHandlers');

const PORT = process.env.PORT || 3000;

// Setup Socket.io handlers
setupSocketHandlers(io);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Type Royale Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
});
