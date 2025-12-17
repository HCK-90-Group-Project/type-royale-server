'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      username: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      level: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      experience: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_matches: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_wins: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_losses: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      win_rate: {
        type: Sequelize.FLOAT,
        defaultValue: 0.0
      },
      average_wpm: {
        type: Sequelize.FLOAT,
        defaultValue: 0.0
      },
      highest_wpm: {
        type: Sequelize.FLOAT,
        defaultValue: 0.0
      },
      total_spells_cast: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      favorite_spell_type: {
        type: Sequelize.ENUM('easy_fireball', 'medium_fireball', 'hard_fireball', 'shield'),
        allowNull: true
      },
      total_hp_dealt: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_hp_blocked: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
  }
};