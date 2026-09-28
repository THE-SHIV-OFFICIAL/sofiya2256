const { Group } = require('../models');

const cache = new Map();
const TTL = 30_000;

async function normalizeDdosDefault(doc) {
  // Older builds used `enabled: true` as the implicit default. Treat those
  // records as unconfigured once, so DDoS is genuinely opt-in after upgrade.
  if (doc?.ddosProtection?.enabled === true && doc.ddosProtection.configured !== true) {
    doc.ddosProtection.enabled = false;
    doc.ddosProtection.configured = true;
    await doc.save();
  }
  return doc;
}

async function getGroup(chatId) {
  const cached = cache.get(chatId);
  if (cached && cached.at > Date.now() - TTL) {
    return normalizeDdosDefault(cached.doc);
  }
  let doc = await Group.findOne({ chatId });
  if (!doc) doc = await Group.create({ chatId });
  doc = await normalizeDdosDefault(doc);
  cache.set(chatId, { doc, at: Date.now() });
  return doc;
}

function invalidate(chatId) { cache.delete(chatId); }

async function updateGroup(chatId, update) {
  const doc = await Group.findOneAndUpdate({ chatId }, update, { new: true, upsert: true });
  cache.set(chatId, { doc, at: Date.now() });
  return doc;
}

module.exports = { getGroup, updateGroup, invalidate };
