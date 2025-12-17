'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcrypt');

// Type Royale User Model - Spellcaster Profile
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Associations will be defined in index.js
    }
  }

  User.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      notEmpty: true,
      isAlphanumeric: {
        msg: 'Username must contain only letters and numbers'
      }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: { msg: 'Must be a valid email address' },
      notEmpty: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: { args: [6, 255], msg: 'Password must be at least 6 characters long' }
    }
  },
  
  // Game Statistics for Type Royale
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: { min: 1, max: 100 }
  },
  experience: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { min: 0 }
  },
  total_matches: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_wins: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_losses: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  win_rate: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    validate: { min: 0.0, max: 100.0 }
  },
  
  // Typing Statistics
  average_wpm: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  highest_wpm: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  
  // Spell Statistics (Game-specific)
  total_spells_cast: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  favorite_spell_type: {
    type: DataTypes.ENUM('easy_fireball', 'medium_fireball', 'hard_fireball', 'shield'),
    allowNull: true
  },
  total_hp_dealt: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total damage dealt across all matches'
  },
  total_hp_blocked: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total damage blocked by shields'
  },
  
  // Account Info
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  sequelize,
  modelName: 'User', 
  tableName: 'users',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Instance methods
User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

  // Instance methods
  User.prototype.calculateWinRate = function() {
    if (this.total_matches === 0) return 0.0;
    return Math.round((this.total_wins / this.total_matches) * 10000) / 100;
  };

  User.prototype.updateMatchStats = async function(matchResult) {
    this.total_matches += 1;
    
    // Update win/loss stats
    if (matchResult.won) {
      this.total_wins += 1;
      this.experience += matchResult.experience || 50;
    } else {
      this.total_losses += 1;
      this.experience += matchResult.experience || 25;
    }
    
    this.win_rate = this.calculateWinRate();
    
    // Update WPM statistics
    if (matchResult.wpm) {
      const totalWPMScore = this.average_wpm * (this.total_matches - 1);
      this.average_wpm = Math.round(((totalWPMScore + matchResult.wpm) / this.total_matches) * 100) / 100;
      
      if (matchResult.wpm > this.highest_wpm) {
        this.highest_wpm = matchResult.wpm;
      }
    }
    
    // Update spell statistics
    if (matchResult.spells_cast) {
      this.total_spells_cast += matchResult.spells_cast;
    }
    
    if (matchResult.hp_dealt) {
      this.total_hp_dealt += matchResult.hp_dealt;
    }
    
    if (matchResult.hp_blocked) {
      this.total_hp_blocked += matchResult.hp_blocked;
    }
    
    if (matchResult.favorite_spell) {
      this.favorite_spell_type = matchResult.favorite_spell;
    }
    
    // Level up logic
    const newLevel = Math.floor(this.experience / 1000) + 1;
    if (newLevel > this.level && newLevel <= 100) {
      this.level = newLevel;
    }
    
    await this.save();
  };

  User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.password;
    return values;
  };

  return User;
};