const { User, MatchHistory } = require("../models/index.js");

class MatchService {
  /**
   * Find user ID by username
   * Returns the database ID (integer) or null if not found
   */
  async getUserIdByUsername(username) {
    try {
      const user = await User.findOne({ where: { username } });
      return user ? user.id : null;
    } catch (error) {
      console.error(`Error finding user ${username}:`, error.message);
      return null;
    }
  }

  /**
   * Save match result to database
   * Called when game_over event is triggered
   */
  async saveMatchResult(roomId, gameState, finalState, players) {
    try {
      console.log(`💾 Saving match result for room ${roomId}...`);

      const player1Data = finalState.player1;
      const player2Data = finalState.player2;

      // Get actual database user IDs by username
      const player1DbId = await this.getUserIdByUsername(
        players.player1.username
      );
      const player2DbId = await this.getUserIdByUsername(
        players.player2.username
      );

      // If either player is not registered, skip saving to database
      if (!player1DbId || !player2DbId) {
        console.log(
          `⚠️ Skipping match save - players not registered (guest mode)`
        );
        console.log(
          `   Player1 (${players.player1.username}): ${
            player1DbId ? "registered" : "guest"
          }`
        );
        console.log(
          `   Player2 (${players.player2.username}): ${
            player2DbId ? "registered" : "guest"
          }`
        );
        return {
          success: true,
          matchId: null,
          winnerId: null,
          message: "Match not saved - guest players",
        };
      }

      // Determine winner
      let winnerDbId = null;
      let winCondition = "knockout";

      if (player1Data.hp <= 0 && player2Data.hp > 0) {
        winnerDbId = player2DbId;
        winCondition = "knockout";
      } else if (player2Data.hp <= 0 && player1Data.hp > 0) {
        winnerDbId = player1DbId;
        winCondition = "knockout";
      } else if (player1Data.ammoCount <= 0 && player2Data.ammoCount <= 0) {
        // Draw or higher HP wins
        if (player1Data.hp > player2Data.hp) {
          winnerDbId = player1DbId;
        } else if (player2Data.hp > player1Data.hp) {
          winnerDbId = player2DbId;
        }
        winCondition = "out_of_ammo";
      }

      // Calculate game duration
      const now = new Date();
      const gameDuration = Math.floor(
        (now - new Date(gameState.startTime)) / 1000
      );

      // Create match history record
      const matchHistory = await MatchHistory.create({
        player1_id: player1DbId,
        player2_id: player2DbId,
        winner_id: winnerDbId,
        game_duration: gameDuration,
        started_at: new Date(gameState.startTime),
        ended_at: now,

        // HP statistics
        player1_hp_start: 100,
        player1_hp_final: player1Data.hp,
        player2_hp_start: 100,
        player2_hp_final: player2Data.hp,

        // Win condition
        win_condition: winCondition,

        // Ammo statistics
        player1_ammo_remaining: player1Data.ammoCount,
        player2_ammo_remaining: player2Data.ammoCount,

        // Room info
        room_id: roomId,
        topic_used: gameState.topic || "fantasy_battle",
        game_mode: "casual",
      });

      // Update player statistics
      if (winnerDbId) {
        const winnerUsername =
          winnerDbId === player1DbId
            ? players.player1.username
            : players.player2.username;
        const loserDbId =
          winnerDbId === player1DbId ? player2DbId : player1DbId;

        await this.updatePlayerStats(winnerDbId, true, matchHistory);
        await this.updatePlayerStats(loserDbId, false, matchHistory);
      }

      console.log(
        `✅ Match result saved: ${
          winnerDbId ? "Player ID " + winnerDbId + " won" : "Draw"
        }`
      );
      return {
        success: true,
        matchId: matchHistory.id,
        winnerId: winnerDbId,
      };
    } catch (error) {
      console.error(`❌ Error saving match result: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update player statistics after match
   */
  async updatePlayerStats(userId, won, matchHistory) {
    try {
      const user = await User.findByPk(userId);
      if (!user) return;

      // Prepare match result
      const playerStats = matchHistory.getPlayerStats(userId);
      const matchResult = {
        won: won,
        experience: won ? 50 : 25,
        spells_cast: 0, // TODO: Collect from match events
        hp_dealt:
          matchHistory.player1_id === userId
            ? matchHistory.player1_total_damage
            : matchHistory.player2_total_damage,
        hp_blocked:
          matchHistory.player1_id === userId
            ? matchHistory.player1_damage_blocked
            : matchHistory.player2_damage_blocked,
        wpm:
          matchHistory.player1_id === userId
            ? matchHistory.player1_avg_wpm
            : matchHistory.player2_avg_wpm,
        favorite_spell: null, // TODO: Determine from match events
      };

      // Update user stats using model method
      await user.updateMatchStats(matchResult);

      console.log(
        `✅ Updated stats for player ${userId}: ${won ? "Win" : "Loss"}`
      );
      return true;
    } catch (error) {
      console.error(`❌ Error updating player stats: ${error.message}`);
      return false;
    }
  }

  /**
   * Get match details
   */
  async getMatchDetails(matchId) {
    try {
      const match = await MatchHistory.findByPk(matchId, {
        include: [
          { association: "player1", attributes: ["username", "level"] },
          { association: "player2", attributes: ["username", "level"] },
          { association: "winner", attributes: ["username", "level"] },
        ],
      });

      if (!match) {
        return { success: false, message: "Match not found" };
      }

      return {
        success: true,
        data: match.getMatchSummary(),
      };
    } catch (error) {
      console.error(`❌ Error getting match details: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get player's recent matches
   */
  async getPlayerMatches(userId, limit = 10) {
    try {
      const matches = await MatchHistory.findAll({
        where: {
          [require("sequelize").Op.or]: [
            { player1_id: userId },
            { player2_id: userId },
          ],
        },
        include: [
          { association: "player1", attributes: ["username"] },
          { association: "player2", attributes: ["username"] },
          { association: "winner", attributes: ["username"] },
        ],
        order: [["started_at", "DESC"]],
        limit: limit,
      });

      return {
        success: true,
        data: matches.map((m) => ({
          matchId: m.id,
          opponent:
            m.player1_id === userId ? m.player2.username : m.player1.username,
          result:
            m.winner_id === userId ? "win" : m.winner_id ? "loss" : "draw",
          duration: m.game_duration,
          date: m.started_at,
        })),
      };
    } catch (error) {
      console.error(`❌ Error getting player matches: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MatchService();
