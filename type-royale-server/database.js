const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Load database configuration from config.json
const configPath = path.resolve(__dirname, 'config', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Database configuration
const sequelize = new Sequelize({
  host: dbConfig.host,
  port: dbConfig.port || 5432,
  database: dbConfig.database,
  username: dbConfig.username,
  password: dbConfig.password,
  dialect: dbConfig.dialect,
  logging: env === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    freezeTableName: true,
    timestamps: true,
    underscored: true
  }
});

// Test database connection
export const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection established successfully');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to PostgreSQL:', error.message);
    return false;
  }
};

// Sync database
export const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    console.log(`✅ Database synced${force ? ' (forced)' : ''}`);
    return true;
  } catch (error) {
    console.error('❌ Error syncing database:', error);
    return false;
  }
};

module.exports = sequelize;
module.exports.testConnection = testConnection;
module.exports.syncDatabase = syncDatabase;