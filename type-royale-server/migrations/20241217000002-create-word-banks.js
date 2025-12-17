'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('word_banks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      topic: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      spell_type: {
        type: Sequelize.ENUM('easy_fireball', 'medium_fireball', 'hard_fireball', 'shield'),
        allowNull: false
      },
      difficulty_level: {
        type: Sequelize.ENUM('easy', 'medium', 'hard', 'shield'),
        allowNull: false
      },
      words: {
        type: Sequelize.JSON,
        allowNull: false
      },
      word_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      ai_model: {
        type: Sequelize.STRING(50),
        defaultValue: 'gemini-pro'
      },
      prompt_used: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      generated_by_ai: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      damage_value: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      spell_speed: {
        type: Sequelize.ENUM('fast', 'normal', 'slow', 'instant'),
        defaultValue: 'normal'
      },
      usage_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      last_used_at: {
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

    // Add indexes for better performance
    await queryInterface.addIndex('word_banks', ['topic', 'spell_type', 'difficulty_level']);
    await queryInterface.addIndex('word_banks', ['spell_type']);
    await queryInterface.addIndex('word_banks', ['difficulty_level']);
    await queryInterface.addIndex('word_banks', ['is_active']);
    await queryInterface.addIndex('word_banks', ['topic']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('word_banks');
  }
};