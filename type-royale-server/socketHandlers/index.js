const { rooms, GameRoom } = require('./gameLogic');
const { v4: uuidv4 } = require('uuid');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // CREATE ROOM
    socket.on('create_room', (data) => {
      const { username } = data;
      const roomId = uuidv4().substring(0, 6).toUpperCase(); // Short room code

      const gameRoom = new GameRoom(roomId, {
        socketId: socket.id,
        username: username || 'Player 1'
      });

      rooms.set(roomId, gameRoom);
      socket.join(roomId);

      console.log(`🏠 Room created: ${roomId} by ${username}`);

      socket.emit('room_created', {
        success: true,
        roomId,
        gameState: gameRoom.getGameState()
      });
    });

    // JOIN ROOM
    socket.on('join_room', (data) => {
      const { roomId, username } = data;

      const room = rooms.get(roomId);

      if (!room) {
        socket.emit('join_room_error', {
          success: false,
          message: 'Room not found'
        });
        return;
      }

      const result = room.addPlayer({
        socketId: socket.id,
        username: username || 'Player 2'
      });

      if (!result.success) {
        socket.emit('join_room_error', {
          success: false,
          message: result.message
        });
        return;
      }

      socket.join(roomId);
      console.log(`👥 ${username} joined room: ${roomId}`);

      // Notify both players
      io.to(roomId).emit('player_joined', {
        success: true,
        gameState: room.getGameState()
      });
    });

    // PLAYER READY
    socket.on('player_ready', (data) => {
      const { roomId } = data;
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const playerId = room.getPlayerBySocketId(socket.id);
      if (!playerId) {
        socket.emit('error', { message: 'Player not in room' });
        return;
      }

      const bothReady = room.setReady(playerId);

      if (bothReady) {
        // Game starts!
        console.log(`🎮 Game started in room: ${roomId}`);
        
        // Send initial words to each player
        const p1Socket = room.players.player1.socketId;
        const p2Socket = room.players.player2.socketId;

        io.to(p1Socket).emit('game_start', {
          gameState: room.getGameState(),
          yourWords: room.players.player1.words,
          yourPlayerId: 'player1'
        });

        io.to(p2Socket).emit('game_start', {
          gameState: room.getGameState(),
          yourWords: room.players.player2.words,
          yourPlayerId: 'player2'
        });
      } else {
        io.to(roomId).emit('player_ready_update', {
          gameState: room.getGameState()
        });
      }
    });

    // ATTACK (FIREBALL)
    socket.on('attack', (data) => {
      const { roomId, attackType, typedWord } = data;
      const room = rooms.get(roomId);

      if (!room || !room.gameStarted) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      const playerId = room.getPlayerBySocketId(socket.id);
      if (!playerId) {
        socket.emit('error', { message: 'Player not in room' });
        return;
      }

      // Validate attack type
      if (!['easy', 'medium', 'hard'].includes(attackType)) {
        socket.emit('error', { message: 'Invalid attack type' });
        return;
      }

      // Launch attack
      const result = room.launchAttack(playerId, attackType);

      if (!result.success) {
        socket.emit('attack_failed', { message: result.message });
        return;
      }

      console.log(`⚔️ ${playerId} launched ${attackType} attack in ${roomId}`);

      // Broadcast attack to both players
      io.to(roomId).emit('attack_launched', {
        attack: result.attack,
        from: playerId,
        ammoCount: result.ammoCount
      });

      // Schedule impact resolution and broadcast
      setTimeout(() => {
        const impactResult = room.resolveAttack(result.attack.id);
        if (impactResult) {
          io.to(roomId).emit('attack_impact', {
            attackId: result.attack.id,
            blocked: impactResult.blocked,
            damage: impactResult.damage,
            targetPlayerId: result.attack.to,
            targetHp: impactResult.targetHp
          });
        }
      }, result.attack.speed);
    });

    // SHIELD
    socket.on('shield', (data) => {
      const { roomId, typedWord } = data;
      const room = rooms.get(roomId);

      if (!room || !room.gameStarted) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      const playerId = room.getPlayerBySocketId(socket.id);
      if (!playerId) {
        socket.emit('error', { message: 'Player not in room' });
        return;
      }

      // Activate shield
      const result = room.activateShield(playerId);

      if (!result.success) {
        socket.emit('shield_failed', { message: result.message });
        return;
      }

      console.log(`🛡️ ${playerId} activated shield in ${roomId}`);

      // Broadcast shield activation to both players
      io.to(roomId).emit('shield_activated', {
        playerId,
        shield: result.shield,
        ammoCount: result.ammoCount
      });
    });

    // ATTACK IMPACT (called automatically by server after delay)
    // This is handled internally by gameLogic.js resolveAttack
    // We listen for it to broadcast the result
    socket.on('request_game_state', (data) => {
      const { roomId } = data;
      const room = rooms.get(roomId);

      if (room) {
        socket.emit('game_state_update', {
          gameState: room.getGameState()
        });
      }
    });

    // DISCONNECT
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.id}`);

      // Find and cleanup rooms where this player was
      for (const [roomId, room] of rooms.entries()) {
        const playerId = room.getPlayerBySocketId(socket.id);
        if (playerId) {
          console.log(`👋 ${playerId} left room ${roomId}`);
          
          // Notify other player
          io.to(roomId).emit('player_disconnected', {
            playerId,
            message: 'Opponent disconnected'
          });

          // Clean up room after some time
          setTimeout(() => {
            rooms.delete(roomId);
            console.log(`🗑️ Room ${roomId} deleted`);
          }, 30000); // 30 seconds
        }
      }
    });
  });

  // Auto-resolve attacks and check win conditions
  setInterval(() => {
    for (const [roomId, room] of rooms.entries()) {
      if (!room.gameStarted) continue;

      // Check win condition
      const winCheck = room.checkWinCondition();
      
      if (winCheck.gameOver) {
        console.log(`🏆 Game over in ${roomId}: ${winCheck.winner} wins by ${winCheck.reason}`);
        
        io.to(roomId).emit('game_over', {
          winner: winCheck.winner,
          reason: winCheck.reason,
          finalState: room.getGameState()
        });

        // Clean up room
        setTimeout(() => {
          rooms.delete(roomId);
        }, 10000); // 10 seconds to show results
      }
    }
  }, 100); // Check every 100ms
}

module.exports = setupSocketHandlers;
