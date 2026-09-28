const BotSettings = require('../models/BotSettings');
const config = require('../config/index');

let _cache = null;
let _cacheAt = 0;
const TTL = 30_000;

async function getSettings() {
  if (_cache && Date.now() - _cacheAt < TTL) return _cache;
  let s = await BotSettings.findById('global');
  if (!s) s = await BotSettings.create({ _id: 'global' });
  _cache = s;
  _cacheAt = Date.now();
  return s;
}

function invalidate() { _cache = null; }

async function isSudo(userId) {
  if (userId === config.ownerId) return true;
  if (config.sudoUsers.includes(userId)) return true;
  const s = await getSettings();
  return s.sudoUsers.includes(userId);
}

async function isOwner(userId) {
  return userId === config.ownerId;
}

async function isBotBanned(userId) {
  if (userId === config.ownerId) return false;
  const s = await getSettings();
  return s.botBanned.some((b) => b.userId === userId);
}

async function getLoggerGroupId() {
  if (config.loggerGroupId) return config.loggerGroupId;
  const s = await getSettings();
  return s.loggerGroupId || null;
}

module.exports = { getSettings, invalidate, isSudo, isOwner, isBotBanned, getLoggerGroupId };
