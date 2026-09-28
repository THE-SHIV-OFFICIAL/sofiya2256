'use strict';

/**
 * Mood-based sticker replies for the chatbot.
 *
 * The owner only provides sticker PACK names — the bot loads every sticker
 * from those packs itself through the Telegram API and sorts them by mood
 * using each sticker's associated emoji. No file_ids needed.
 *
 *   STICKER_PACKS=PackNameOne,PackNameTwo
 *
 * (Pack name = the part after t.me/addstickers/ in the pack link.)
 *
 * Manual override still works: STICKER_IDS=mood=file_id,... entries are
 * merged into the matching mood pools.
 */

const logger = require('./logger');

// Emoji → mood buckets, same idea as the premium-emoji catalog.
const MOOD_EMOJI = {
  love: new Set(['❤️', '❤', '🤍', '🩷', '💕', '💗', '💘', '💋', '😘', '🥰', '😍', '🌹', '🌸', '💐', '🦋', '🎀', '💍', '🫂', '❣️', '💝', '💖', '💓', '💞', '💟', '😚', '🤗']),
  sad: new Set(['😭', '🥺', '💔', '😞', '💧', '🌧', '🥀', '😢', '😶', '🖤', '😔', '😟', '😩', '😫', '☔', '🌧️']),
  fun: new Set(['😂', '🤣', '😆', '😃', '😄', '😁', '😀', '😊', '😌', '😉', '😎', '😝', '😜', '🤪', '💃', '🕺', '🎶', '🎵', '🐱', '🆒', '🤙', '✌️', '😹', '🙃', '😋']),
  angry: new Set(['😠', '😤', '🙄', '😒', '👿', '💢', '😾', '🤨', '😑', '🫤']),
  sleep: new Set(['😴', '💤', '🌙', '🛌', '😪', '🥱', '🌃', '⭐', '✨']),
  hi: new Set(['👋', '🙋', '🙋‍♀️', '💁', '💁‍♀️', '🤝', '🫶', '👏', '🙌']),
};

const pools = { love: [], sad: [], fun: [], angry: [], sleep: [], hi: [], chatbot: [] };
const cursors = new Map();
let loaded = false;
let loading = null;

function addToPool(mood, id) {
  if (id && !pools[mood].includes(id)) pools[mood].push(id);
}

function bucketEmoji(emoji) {
  if (!emoji) return 'chatbot';
  for (const [mood, set] of Object.entries(MOOD_EMOJI)) {
    if (set.has(emoji)) return mood;
  }
  return 'chatbot';
}

/** Merge manual STICKER_IDS=mood=file_id overrides into the pools. */
function loadManualIds() {
  for (const item of String(process.env.STICKER_IDS || '').split(',')) {
    const [mood, id] = item.split('=').map((p) => p?.trim());
    if (mood && id && id.length > 10 && pools[mood]) addToPool(mood, id);
  }
}

/**
 * Fetch every configured sticker pack through the Telegram API and sort the
 * stickers into mood pools by their emoji. Runs once, then cached in memory.
 * Safe to call on every message — after the first run it returns instantly.
 */
async function init(telegram) {
  if (loaded || loading) return loading;
  loading = (async () => {
    loadManualIds();

    const names = String(process.env.STICKER_PACKS || '')
      .split(',')
      .map((s) => s.trim().replace(/^https?:\/\/t\.me\/addstickers\//, ''))
      .filter(Boolean);

    for (const name of names) {
      try {
        const set = await telegram.getStickerSet(name);
        for (const st of set.stickers || []) {
          if (st.is_video || st.is_animated) continue; // static stickers send most reliably
          addToPool(bucketEmoji(st.emoji), st.file_id);
        }
        logger.info(`Sticker pack "${name}" loaded: ${(set.stickers || []).length} stickers.`);
      } catch (e) {
        logger.warn(`Sticker pack "${name}" load failed: ${e.message}`);
      }
    }

    loaded = true;
  })();
  return loading;
}

function isConfigured() {
  return Object.values(pools).some((p) => p.length > 0)
    || !!String(process.env.STICKER_PACKS || '').trim();
}

/** Pick a sticker for a mood, rotating so it never repeats back-to-back. */
function pickSticker(mood = 'chatbot') {
  const pool = pools[mood]?.length ? pools[mood] : pools.chatbot;
  if (!pool || !pool.length) return null;
  if (pool.length === 1) return pool[0];

  let idx = (cursors.get(mood) ?? -1) + 1 + Math.floor(Math.random() * 2);
  idx %= pool.length;
  cursors.set(mood, idx);
  return pool[idx];
}

/**
 * Should this reply get a sticker too? Girls don't send a sticker with every
 * message — roughly one in three, more when the mood is strong.
 */
function shouldSendSticker(mood) {
  const chance = mood === 'love' || mood === 'sad' ? 0.4 : mood === 'fun' ? 0.35 : 0.25;
  return Math.random() < chance;
}

module.exports = { init, isConfigured, pickSticker, shouldSendSticker };
