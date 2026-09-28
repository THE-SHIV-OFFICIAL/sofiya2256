const mongoose = require('mongoose');
const config = require('../config/index');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

mongoose.connect(config.mongoUri)
  .then(() => logger.info('✅ MongoDB Connected'))
  .catch(err => logger.error('MongoDB Connection Error', err));

mongoose.connection.on('disconnected', () => logger.warn('⚠️ MongoDB disconnected'));
mongoose.connection.on('reconnected', () => logger.info('🔁 MongoDB reconnected'));

module.exports = {
  User: require('./User'),
  Group: require('./Group'),
  Wallet: require('./Wallet'),
  ChatMemory: require('./ChatMemory'),
  Warning: require('./Warning'),
  Note: require('./Note'),
  Filter: require('./Filter'),
  Blacklist: require('./Blacklist'),
  Approval: require('./Approval'),
  Lock: require('./Lock'),
  DisabledCommand: require('./DisabledCommand'),
  Connection: require('./Connection'),
  Federation: require('./Federation'),
  BotSettings: require('./BotSettings'),
};
