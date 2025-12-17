'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('match_history', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      player1_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      player2_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      winner_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      game_duration: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      ended_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      player1_hp_start: {
        type: Sequelize.INTEGER,
        defaultValue: 100
      },
      player1_hp_final: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      player2_hp_start: {
        type: Sequelize.INTEGER,
        defaultValue: 100
      },
      player2_hp_final: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      win_condition: {
        type: Sequelize.ENUM('knockout', 'out_of_ammo', 'timeout'),
        allowNull: false
      },
      player1_spells_cast: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      player2_spells_cast: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      player1_words_used: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      player2_words_used: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      player1_ammo_remaining: {
        type: Sequelize.INTEGER,
        defaultValue: 50
      },
      player2_ammo_remaining: {
        type: Sequelize.INTEGER,
        defaultValue: 50
      },
      player1_avg_wpm: {
        type: Sequelize.FLOAT,
        defaultValue: 0.0
      },
      player2_avg_wpm: {
        type: Sequelize.FLOAT,
        defaultValue: 0.0
      },
      player1_accuracy: {
        type: Sequelize.FLOAT,
        defaultValue: 0.0
      },
      player2_accuracy: {
        type: Sequelize.FLOAT,
        defaultValue: 0.0
      },
      player1_spell_stats: {
        type: Sequelize.JSON,
        allowNull: true
      },
      player2_spell_stats: {
        type: Sequelize.JSON,
        allowNull: true
      },
      player1_total_damage: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      player2_total_damage: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      player1_damage_blocked: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      player2_damage_blocked: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      game_mode: {
        type: Sequelize.ENUM('casual', 'ranked', 'tournament', 'practice'),
        defaultValue: 'casual'
      },
      topic_used: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      match_events: {
        type: Sequelize.JSON,
        allowNull: true
      },
      room_id: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('match_history', ['player1_id']);
    await queryInterface.addIndex('match_history', ['player2_id']);
    await queryInterface.addIndex('match_history', ['winner_id']);
    await queryInterface.addIndex('match_history', ['win_condition']);
    await queryInterface.addIndex('match_history', ['game_mode']);
    await queryInterface.addIndex('match_history', ['started_at']);
    await queryInterface.addIndex('match_history', ['room_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('match_history');
  }
};