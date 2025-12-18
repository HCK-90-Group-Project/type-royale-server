'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  // Production: Use DATABASE_URL with SSL
  sequelize = new Sequelize(process.env[config.use_env_variable], {
    ...config,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Define Type Royale associations after all models loaded
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Type Royale specific associations
if (db.User && db.MatchHistory) {
  db.User.hasMany(db.MatchHistory, { 
    as: 'player1Matches', 
    foreignKey: 'player1_id',
    onDelete: 'CASCADE'
  });

  db.User.hasMany(db.MatchHistory, { 
    as: 'player2Matches', 
    foreignKey: 'player2_id',
    onDelete: 'CASCADE'
  });

  db.User.hasMany(db.MatchHistory, { 
    as: 'wonMatches', 
    foreignKey: 'winner_id',
    onDelete: 'SET NULL'
  });

  db.MatchHistory.belongsTo(db.User, { 
    as: 'player1', 
    foreignKey: 'player1_id'
  });

  db.MatchHistory.belongsTo(db.User, { 
    as: 'player2', 
    foreignKey: 'player2_id'
  });

  db.MatchHistory.belongsTo(db.User, { 
    as: 'winner', 
    foreignKey: 'winner_id'
  });
}

// WordBank doesn't have direct relationship with User/MatchHistory
// since it's used for spell word generation and supply to Socket Architect

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
