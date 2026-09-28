const { User, Group } = require('../models');
const logger = require('../utils/logger');

/**
 * Tracks every user and group the bot sees, so /broadcast can reach them.
 * Writes are throttled with an in-memory cache to keep Mongo load low.
 */

const seen = new Map();          // key -> last write timestamp
const WRITE_TTL = 6 * 60 * 60 * 1000; // re-write at most every 6h

function fresh(key) {
  const at = seen.get(key);
  if (at && at > Date.now() - WRITE_TTL) return true;
  seen.set(key, Date.now());
  return false;
}

async function track(ctx, next) {
  try {
    const from = ctx.from;
    if (from && !from.is_bot && !fresh(`u:${from.id}`)) {
      await User.updateOne(
        { userId: from.id },
        {
          $set: {
            username: from.username || '',
            firstName: from.first_name || '',
            lastName: from.last_name || '',
            lastSeen: new Date(),
            ...(ctx.chat?.type === 'private' ? { canDm: true, dmBlocked: false } : {}),
          },
          $setOnInsert: { userId: from.id },
        },
        { upsert: true }
      );
    }

    const chat = ctx.chat;
    if (chat && (chat.type === 'group' || chat.type === 'supergroup') && !fresh(`g:${chat.id}`)) {
      await Group.updateOne(
        { chatId: chat.id },
        {
          $set: { title: chat.title || '', active: true, lastSeen: new Date() },
          $setOnInsert: { chatId: chat.id },
        },
        { upsert: true }
      );
    }
  } catch (e) {
    logger.warn(`track middleware: ${e.message}`);
  }
  return next();
}

module.exports = track;
