const { rooms, GameRoom } = require("./gameLogic");
const { v4: uuidv4 } = require("uuid");
const MatchService = require("../services/MatchService");

// Track disconnection timeouts for each player to allow reconnection
const disconnectTimeouts = new Map();
// Track which userId is mapped to which roomId for quick reconnection
const userRoomMap = new Map();

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

      // Track user to room mapping for quick reconnection
      userRoomMap.set(userId, roomId);

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

      // Clear any pending disconnect timeout for this user
      const timeoutKey = `${roomId}_${userId}`;
      if (disconnectTimeouts.has(timeoutKey)) {
        clearTimeout(disconnectTimeouts.get(timeoutKey).notifyTimeout);
        clearTimeout(disconnectTimeouts.get(timeoutKey).cleanupTimeout);
        disconnectTimeouts.delete(timeoutKey);
        console.log(`⏹️ Cleared disconnect timeout for ${username}`);
      }

      // Check if player is reconnecting (same username or userId)
      let playerId = null;
      if (
        room.players.player1?.username === username ||
        room.players.player1?.userId === userId
      ) {
        playerId = "player1";
        console.log(`🔄 ${username} reconnecting as player1 in room ${roomId}`);
        // Update socket ID for reconnection
        room.players.player1.socketId = socket.id;
        room.players.player1.disconnected = false;
      } else if (
        room.players.player2?.username === username ||
        room.players.player2?.userId === userId
      ) {
        playerId = "player2";
        console.log(`🔄 ${username} reconnecting as player2 in room ${roomId}`);
        // Update socket ID for reconnection
        room.players.player2.socketId = socket.id;
        room.players.player2.disconnected = false;
      } else {
        // New player joining
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
        playerId = "player2";
        console.log(`👥 ${username} joined room: ${roomId}`);
      }

      socket.join(roomId);

      // Track user to room mapping
      userRoomMap.set(userId, roomId);

      // Send current game state to the player
      const gameState = room.getGameState();

      // If game is already started, send game_start event to reconnecting player
      if (room.gameStarted) {
        const playerWords = room.players[playerId].words;
        socket.emit("game_start", {
          gameState: gameState,
          words: playerWords,
          yourPlayerId: playerId,
          wordPoolMetadata: room.wordPool?.metadata,
        });
      }

      // Notify both players with room_update event
      io.to(roomId).emit("room_update", {
        success: true,
        players: [
          { username: room.players.player1.username, playerId: "player1" },
          { username: room.players.player2?.username, playerId: "player2" },
        ],
        gameState: gameState,
      });
    });

    // PLAYER READY (Host starts the game)
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

      // Only host (player1) can start the game
      if (playerId !== "player1") {
        socket.emit("error", { message: "Only the host can start the game" });
        return;
      }

      // Check if both players are in the room
      if (!room.players.player2) {
        socket.emit("error", { message: "Waiting for opponent to join" });
        return;
      }

      // Mark both players as ready and start the game
      room.setReady("player1");
      room.setReady("player2");

      // Game starts! Generate words using AI
      console.log(`🎮 Game starting in room: ${roomId} - Generating words...`);

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

    // REQUEST GAME STATE
    socket.on("request_game_state", (data) => {
      const { roomId } = data;
      const room = rooms.get(roomId);

      if (room) {
        socket.emit("game_state_update", {
          gameState: room.getGameState(),
        });
      }
    });

    // LEAVE ROOM (intentional leave)
    socket.on("leave_room", (data) => {
      const { roomId } = data;
      const room = rooms.get(roomId);

      if (!room) return;

      const playerId = room.getPlayerBySocketId(socket.id);
      if (!playerId) return;

      const player = room.players[playerId];
      const userId = player?.userId;
      const username = player?.username;

      console.log(`🚪 ${username} intentionally left room ${roomId}`);

      // Clear any pending disconnect timeouts
      const timeoutKey = `${roomId}_${userId}`;
      if (disconnectTimeouts.has(timeoutKey)) {
        clearTimeout(disconnectTimeouts.get(timeoutKey).notifyTimeout);
        clearTimeout(disconnectTimeouts.get(timeoutKey).cleanupTimeout);
        disconnectTimeouts.delete(timeoutKey);
      }

      // Remove from user-room mapping
      userRoomMap.delete(userId);

      // Leave the socket room
      socket.leave(roomId);

      // Notify opponent immediately
      const opponent = room.getOpponent(playerId);
      if (opponent && room.players[opponent]?.socketId) {
        io.to(room.players[opponent].socketId).emit("player_disconnected", {
          playerId,
          message: "Opponent left the game",
        });
      }

      // If game was in progress, declare winner
      if (room.gameStarted && opponent && !room.players[opponent]?.disconnected) {
        io.to(roomId).emit("match_result", {
          winner: opponent,
          reason: "opponent_left",
          finalState: room.getGameState(),
          timestamp: new Date().toISOString(),
        });
      }

      // Clean up room
      setTimeout(() => {
        rooms.delete(roomId);
        console.log(`🗑️ Room ${roomId} deleted (player left)`);
      }, 5000);
    });

    // REJOIN ROOM (for page refresh)
    socket.on("rejoin_room", (data) => {
      const { roomId, username, userId, gameStatus } = data;

      console.log(`🔄 Rejoin attempt: ${username} trying to rejoin ${roomId}`);

      const room = rooms.get(roomId);

      if (!room) {
        console.log(`❌ Room ${roomId} not found for rejoin`);
        socket.emit("rejoin_failed", {
          success: false,
          message: "Room not found or expired",
        });
        return;
      }

      // Clear any pending disconnect timeout for this user
      const timeoutKey = `${roomId}_${userId}`;
      if (disconnectTimeouts.has(timeoutKey)) {
        clearTimeout(disconnectTimeouts.get(timeoutKey).notifyTimeout);
        clearTimeout(disconnectTimeouts.get(timeoutKey).cleanupTimeout);
        disconnectTimeouts.delete(timeoutKey);
        console.log(`⏹️ Cleared disconnect timeout for ${username} on rejoin`);
      }

      // Find which player is trying to rejoin
      let playerId = null;
      if (
        room.players.player1?.username === username ||
        room.players.player1?.userId === userId
      ) {
        playerId = "player1";
        room.players.player1.socketId = socket.id;
        room.players.player1.disconnected = false;
        console.log(`✅ ${username} rejoined as player1 in room ${roomId}`);
      } else if (
        room.players.player2?.username === username ||
        room.players.player2?.userId === userId
      ) {
        playerId = "player2";
        room.players.player2.socketId = socket.id;
        room.players.player2.disconnected = false;
        console.log(`✅ ${username} rejoined as player2 in room ${roomId}`);
      }

      if (!playerId) {
        console.log(`❌ Player ${username} not found in room ${roomId}`);
        socket.emit("rejoin_failed", {
          success: false,
          message: "Player not found in room",
        });
        return;
      }

      socket.join(roomId);

      // Update user-room mapping
      userRoomMap.set(userId, roomId);

      const gameState = room.getGameState();
      const opponent = room.getOpponent(playerId);

      // Send rejoin success with current game state
      socket.emit("rejoin_success", {
        success: true,
        roomId,
        playerId,
        gameState: {
          status: room.gameStarted ? "playing" : "lobby",
          players: [
            { username: room.players.player1.username, playerId: "player1" },
            room.players.player2
              ? { username: room.players.player2.username, playerId: "player2" }
              : null,
          ].filter(Boolean),
        },
        playerState: gameState[playerId]
          ? {
              hp: gameState[playerId].hp,
              ammo: gameState[playerId].ammoCount,
              shield: gameState[playerId].shield,
            }
          : null,
        enemyState:
          opponent && gameState[opponent]
            ? {
                hp: gameState[opponent].hp,
                shield: gameState[opponent].shield,
                username: room.players[opponent]?.username,
              }
            : null,
      });

      // If game is in progress, also send game_start event with words
      if (room.gameStarted) {
        const playerWords = room.players[playerId].words;
        socket.emit("game_start", {
          gameState: gameState,
          words: playerWords,
          yourPlayerId: playerId,
          wordPoolMetadata: room.wordPool?.metadata,
        });
      }

      // Notify opponent about reconnection
      if (opponent && room.players[opponent]?.socketId) {
        io.to(room.players[opponent].socketId).emit("player_reconnected", {
          playerId,
          username,
        });
      }
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);

      // Find and handle rooms where this player was
      for (const [roomId, room] of rooms.entries()) {
        const playerId = room.getPlayerBySocketId(socket.id);
        if (playerId) {
          const player = room.players[playerId];
          const userId = player?.userId;
          const username = player?.username;

          console.log(`👋 ${username} (${playerId}) temporarily disconnected from room ${roomId}`);

          // Mark player as disconnected (but don't remove yet)
          player.disconnected = true;
          player.disconnectedAt = Date.now();

          // Create a unique key for this disconnect timeout
          const timeoutKey = `${roomId}_${userId}`;

          // Don't create new timeout if one already exists
          if (disconnectTimeouts.has(timeoutKey)) {
            console.log(`⏳ Disconnect timeout already exists for ${username}`);
            continue;
          }

          // Notify opponent after a short delay (they might just be refreshing)
          const notifyTimeout = setTimeout(() => {
            // Check if player is still disconnected
            const currentRoom = rooms.get(roomId);
            if (currentRoom && currentRoom.players[playerId]?.disconnected) {
              const opponent = currentRoom.getOpponent(playerId);
              if (opponent && currentRoom.players[opponent]?.socketId) {
                io.to(currentRoom.players[opponent].socketId).emit("player_temporarily_disconnected", {
                  playerId,
                  username,
                  message: "Opponent is reconnecting...",
                });
              }
            }
          }, 2000); // 2 second delay before notifying

          // Clean up after grace period if player doesn't reconnect
          const cleanupTimeout = setTimeout(() => {
            const currentRoom = rooms.get(roomId);
            if (!currentRoom) {
              disconnectTimeouts.delete(timeoutKey);
              return;
            }

            // Check if player is still disconnected
            if (currentRoom.players[playerId]?.disconnected) {
              console.log(`⏰ Grace period expired for ${username} in room ${roomId}`);

              // Notify opponent that player has left permanently
              io.to(roomId).emit("player_disconnected", {
                playerId,
                message: "Opponent disconnected",
              });

              // If game hasn't started, delete room
              if (!currentRoom.gameStarted) {
                rooms.delete(roomId);
                userRoomMap.delete(userId);
                console.log(`🗑️ Room ${roomId} deleted (game not started)`);
              } else {
                // If game was in progress, declare the remaining player as winner
                const opponent = currentRoom.getOpponent(playerId);
                if (opponent && !currentRoom.players[opponent]?.disconnected) {
                  io.to(roomId).emit("match_result", {
                    winner: opponent,
                    reason: "opponent_disconnected",
                    finalState: currentRoom.getGameState(),
                    timestamp: new Date().toISOString(),
                  });

                  // Clean up room after showing results
                  setTimeout(() => {
                    rooms.delete(roomId);
                    userRoomMap.delete(userId);
                    console.log(`🗑️ Room ${roomId} deleted (opponent left)`);
                  }, 10000);
                }
              }
            }

            disconnectTimeouts.delete(timeoutKey);
          }, 30000); // 30 second grace period for reconnection

          disconnectTimeouts.set(timeoutKey, {
            notifyTimeout,
            cleanupTimeout,
          });
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
