'use strict';
const { Model } = require('sequelize');

// Type Royale Match History Model
module.exports = (sequelize, DataTypes) => {
  class MatchHistory extends Model {
    static associate(models) {
      // Associations will be defined in index.js
    }
  }

  MatchHistory.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Players
  player1_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  player2_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  winner_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  },
  
  // Game Duration & Timing
  game_duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Game duration in seconds'
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  ended_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  
  // HP & Win Conditions
  player1_hp_start: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    comment: 'Starting HP for player 1'
  },
  player1_hp_final: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Final HP for player 1'
  },
  player2_hp_start: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    comment: 'Starting HP for player 2'
  },
  player2_hp_final: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Final HP for player 2'
  },
  
  // Win Condition
  win_condition: {
    type: DataTypes.ENUM('knockout', 'out_of_ammo', 'timeout'),
    allowNull: false,
    comment: 'How the game was won: HP=0, ammo exhausted, or timeout'
  },
  
  // Spell & Word Usage Statistics
  player1_spells_cast: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total spells cast by player 1'
  },
  player2_spells_cast: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total spells cast by player 2'
  },
  
  player1_words_used: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Words used from 50-word ammo pool'
  },
  player2_words_used: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Words used from 50-word ammo pool'
  },
  
  player1_ammo_remaining: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
    comment: 'Remaining words in ammo pool'
  },
  player2_ammo_remaining: {
    type: DataTypes.INTEGER,
    defaultValue: 50,
    comment: 'Remaining words in ammo pool'
  },
  
  // Typing Performance
  player1_avg_wpm: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    comment: 'Average words per minute for player 1'
  },
  player2_avg_wpm: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    comment: 'Average words per minute for player 2'
  },
  
  player1_accuracy: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    comment: 'Typing accuracy percentage for player 1'
  },
  player2_accuracy: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    comment: 'Typing accuracy percentage for player 2'
  },
  
  // Spell Type Statistics
  player1_spell_stats: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Breakdown of spells used by type: {easy: 5, medium: 3, hard: 1, shield: 2}'
  },
  player2_spell_stats: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Breakdown of spells used by type'
  },
  
  // Damage Statistics
  player1_total_damage: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total damage dealt by player 1'
  },
  player2_total_damage: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total damage dealt by player 2'
  },
  
  player1_damage_blocked: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total damage blocked by shields'
  },
  player2_damage_blocked: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total damage blocked by shields'
  },
  
  // Game Settings
  game_mode: {
    type: DataTypes.ENUM('casual', 'ranked', 'tournament', 'practice'),
    defaultValue: 'casual'
  },
  topic_used: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Word topic used in this match'
  },
  
  // Detailed Match Data
  match_events: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Detailed sequence of game events, spells, timings etc.'
  },
  
  // Room/Session Info
  room_id: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Socket.IO room identifier'
  }
}, {
  sequelize,
  modelName: 'MatchHistory',
  tableName: 'match_history',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['player1_id'] },
    { fields: ['player2_id'] },
    { fields: ['winner_id'] },
    { fields: ['win_condition'] },
    { fields: ['game_mode'] },
    { fields: ['started_at'] },
    { fields: ['room_id'] }
  ]
});

// Instance methods
MatchHistory.prototype.getMatchSummary = function() {
  return {
    match_id: this.id,
    players: {
      player1: this.player1_id,
      player2: this.player2_id
    },
    winner: this.winner_id,
    duration: this.game_duration,
    win_condition: this.win_condition,
    final_hp: {
      player1: this.player1_hp_final,
      player2: this.player2_hp_final
    },
    performance: {
      player1_wpm: this.player1_avg_wpm,
      player2_wpm: this.player2_avg_wpm,
      player1_accuracy: this.player1_accuracy,
      player2_accuracy: this.player2_accuracy
    },
    spell_usage: {
      player1: this.player1_spell_stats,
      player2: this.player2_spell_stats
    }
  };
};

MatchHistory.prototype.getPlayerStats = function(playerId) {
  const isPlayer1 = this.player1_id === playerId;
  
  return {
    hp_final: isPlayer1 ? this.player1_hp_final : this.player2_hp_final,
    spells_cast: isPlayer1 ? this.player1_spells_cast : this.player2_spells_cast,
    words_used: isPlayer1 ? this.player1_words_used : this.player2_words_used,
    ammo_remaining: isPlayer1 ? this.player1_ammo_remaining : this.player2_ammo_remaining,
    avg_wpm: isPlayer1 ? this.player1_avg_wpm : this.player2_avg_wpm,
    accuracy: isPlayer1 ? this.player1_accuracy : this.player2_accuracy,
    spell_stats: isPlayer1 ? this.player1_spell_stats : this.player2_spell_stats,
    total_damage: isPlayer1 ? this.player1_total_damage : this.player2_total_damage,
    damage_blocked: isPlayer1 ? this.player1_damage_blocked : this.player2_damage_blocked,
    won: this.winner_id === playerId
  };
};

  return MatchHistory;
};