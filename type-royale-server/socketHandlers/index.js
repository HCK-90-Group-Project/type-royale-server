const { rooms, GameRoom } = require("./gameLogic");
const { v4: uuidv4 } = require("uuid");
const MatchService = require("../services/MatchService");

function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // CREATE ROOM
    socket.on("create_room", (data) => {
      const { username, userId } = data;
      const roomId = uuidv4().substring(0, 6).toUpperCase(); // Short room code

      const gameRoom = new GameRoom(roomId, {
        socketId: socket.id,
        userId: userId,
        username: username || "Player 1",
      });

      rooms.set(roomId, gameRoom);
      socket.join(roomId);

      console.log(`🏠 Room created: ${roomId} by ${username}`);

      socket.emit("room_created", {
        success: true,
        roomId,
        gameState: gameRoom.getGameState(),
      });
    });

    // JOIN ROOM
    socket.on("join_room", (data) => {
      const { roomId, username, userId } = data;

      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("join_room_error", {
          success: false,
          message: "Room not found",
        });
        return;
      }

      const result = room.addPlayer({
        socketId: socket.id,
        userId: userId,
        username: username || "Player 2",
      });

      if (!result.success) {
        socket.emit("join_room_error", {
          success: false,
          message: result.message,
        });
        return;
      }

      socket.join(roomId);
      console.log(`👥 ${username} joined room: ${roomId}`);

      // Notify both players with room_update event
      io.to(roomId).emit("room_update", {
        success: true,
        players: [
          { username: room.players.player1.username, playerId: "player1" },
          { username: room.players.player2?.username, playerId: "player2" },
        ],
        gameState: room.getGameState(),
      });
    });

    // PLAYER READY
    socket.on("player_ready", async (data) => {
      const { roomId } = data;
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      const playerId = room.getPlayerBySocketId(socket.id);
      if (!playerId) {
        socket.emit("error", { message: "Player not in room" });
        return;
      }

      const bothReady = room.setReady(playerId);

      if (bothReady) {
        // Game starts! Generate words using AI
        console.log(
          `🎮 Game starting in room: ${roomId} - Generating words...`
        );

        try {
          // Initialize game words (async with Gemini AI)
          const wordResult = await room.initializeGameWords();

          // Send initial words to each player
          const p1Socket = room.players.player1.socketId;
          const p2Socket = room.players.player2.socketId;

          io.to(p1Socket).emit("game_start", {
            gameState: room.getGameState(),
            words: room.players.player1.words,
            yourPlayerId: "player1",
            wordPoolMetadata: wordResult.wordPool.metadata,
          });

          io.to(p2Socket).emit("game_start", {
            gameState: room.getGameState(),
            words: room.players.player2.words,
            yourPlayerId: "player2",
            wordPoolMetadata: wordResult.wordPool.metadata,
          });

          console.log(`✅ Game initialized successfully in room: ${roomId}`);
        } catch (error) {
          console.error(`❌ Error starting game: ${error.message}`);
          io.to(roomId).emit("game_start_error", {
            message: "Failed to start game",
            error: error.message,
          });
        }
      } else {
        io.to(roomId).emit("player_ready_update", {
          gameState: room.getGameState(),
        });
      }
    });

    // SEND_ATTACK (FIREBALL)
    socket.on("send_attack", (data) => {
      const { roomId, attackType, typedWord } = data;
      const room = rooms.get(roomId);

      if (!room || !room.gameStarted) {
        socket.emit("error", { message: "Game not started" });
        return;
      }

      const playerId = room.getPlayerBySocketId(socket.id);
      if (!playerId) {
        socket.emit("error", { message: "Player not in room" });
        return;
      }

      // Validate attack type
      if (!["easy", "medium", "hard"].includes(attackType)) {
        socket.emit("error", { message: "Invalid attack type" });
        return;
      }

      // Launch attack
      const result = room.launchAttack(playerId, attackType);

      if (!result.success) {
        socket.emit("send_attack_error", { message: result.message });
        return;
      }

      console.log(`⚔️ ${playerId} launched ${attackType} attack in ${roomId}`);

      // Broadcast attack to both players
      io.to(roomId).emit("attack_launched", {
        attack: result.attack,
        from: playerId,
        ammoCount: result.ammoCount,
      });

      // Schedule impact resolution and broadcast
      setTimeout(() => {
        const impactResult = room.resolveAttack(result.attack.id);
        if (impactResult) {
          const targetPlayerId = result.attack.to;
          const targetSocket = room.players[targetPlayerId].socketId;

          // Send receive_attack event to target player
          io.to(targetSocket).emit("receive_attack", {
            attackId: result.attack.id,
            blocked: impactResult.blocked,
            damage: impactResult.damage,
            type: result.attack.type,
            targetHp: impactResult.targetHp,
          });

          // Broadcast to all in room
          io.to(roomId).emit("attack_impact", {
            attackId: result.attack.id,
            blocked: impactResult.blocked,
            damage: impactResult.damage,
            targetPlayerId: result.attack.to,
            targetHp: impactResult.targetHp,
          });
        }
      }, result.attack.speed);
    });

    // ACTIVATE_SHIELD
    socket.on("activate_shield", (data) => {
      const { roomId, typedWord } = data;
      const room = rooms.get(roomId);

      if (!room || !room.gameStarted) {
        socket.emit("error", { message: "Game not started" });
        return;
      }

      const playerId = room.getPlayerBySocketId(socket.id);
      if (!playerId) {
        socket.emit("error", { message: "Player not in room" });
        return;
      }

      // Activate shield
      const result = room.activateShield(playerId);

      if (!result.success) {
        socket.emit("activate_shield_error", { message: result.message });
        return;
      }

      console.log(`🛡️ ${playerId} activated shield in ${roomId}`);

      // Notify opponent about shield activation
      const opponent = room.getOpponent(playerId);
      const opponentSocket = room.players[opponent].socketId;

      io.to(opponentSocket).emit("enemy_shield_active", {
        playerId,
        shield: result.shield,
        ammoCount: result.ammoCount,
      });

      // Notify all players
      io.to(roomId).emit("shield_activated", {
        playerId,
        shield: result.shield,
        ammoCount: result.ammoCount,
      });
    });

    // ATTACK IMPACT (called automatically by server after delay)
    // This is handled internally by gameLogic.js resolveAttack
    // We listen for it to broadcast the result
    socket.on("request_game_state", (data) => {
      const { roomId } = data;
      const room = rooms.get(roomId);

      if (room) {
        socket.emit("game_state_update", {
          gameState: room.getGameState(),
        });
      }
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);

      // Find and cleanup rooms where this player was
      for (const [roomId, room] of rooms.entries()) {
        const playerId = room.getPlayerBySocketId(socket.id);
        if (playerId) {
          console.log(`👋 ${playerId} left room ${roomId}`);

          // Notify other player
          io.to(roomId).emit("player_disconnected", {
            playerId,
            message: "Opponent disconnected",
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
  setInterval(async () => {
    for (const [roomId, room] of rooms.entries()) {
      if (!room.gameStarted) continue;

      // Check win condition
      const winCheck = room.checkWinCondition();

      if (winCheck.gameOver) {
        console.log(
          `🏆 Game over in ${roomId}: ${winCheck.winner} wins by ${winCheck.reason}`
        );

        // Get player info
        const player1Socket = room.players.player1.socketId;
        const player2Socket = room.players.player2.socketId;

        // Prepare player data for match saving
        const playerData = {
          player1: {
            socketId: player1Socket,
            userId: room.players.player1.userId,
            username: room.players.player1.username,
          },
          player2: {
            socketId: player2Socket,
            userId: room.players.player2.userId,
            username: room.players.player2.username,
          },
        };

        // Save match result to database
        const saveResult = await MatchService.saveMatchResult(
          roomId,
          { startTime: room.createdAt },
          room.getGameState(),
          playerData
        );

        // Emit match_result event per Software Design
        io.to(roomId).emit("match_result", {
          winner: winCheck.winner,
          reason: winCheck.reason,
          finalState: room.getGameState(),
          matchId: saveResult.success ? saveResult.matchId : null,
          timestamp: new Date().toISOString(),
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
