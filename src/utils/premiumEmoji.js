'use strict';

/**
 * Telegram custom emoji are sent with an emoji-id, not with an addemoji URL.
 * The owner-supplied catalog is grouped by meaning below so the chatbot and
 * logger can choose an appropriate emoji instead of placing random symbols.
 * PREMIUM_EMOJI_IDS remains supported as an optional alias override.
 */

const CATALOG = require('../config/premiumEmojiCatalog');

const PACK_LINKS = Object.freeze([
  'https://t.me/addemoji/bellazpack_by_TgEmojis_bot',
  'https://t.me/addemoji/EVERYONExKSK_by_fStikBot',
  'https://t.me/addemoji/LoveDayEmoji',
  'https://t.me/addemoji/pack_eb01d_by_TgEmojis_bot',
  'https://t.me/addemoji/DSPSIR_by_TgEmojis_bot',
  'https://t.me/addemoji/sticks_787a5_by_TgEmodziBot',
  'https://t.me/addemoji/Callmejija_by_fStikBot',
  'https://t.me/addemoji/KripanshEmojis_by_fStikBot',
  'https://t.me/addemoji/DecorationEmojiPack',
  'https://t.me/addemoji/Combative_Olive_Parrotfish_by_fStikBot',
]);

function parseIds(value) {
  const ids = {};
  for (const item of String(value || '').split(',')) {
    const [alias, id] = item.split('=').map((part) => part?.trim());
    if (alias && /^\d+$/.test(id || '')) ids[alias] = id;
  }
  return ids;
}

const IDS = parseIds(process.env.PREMIUM_EMOJI_IDS);

const OFF_LIMITS_FOR_CHATBOT = new Set([
  '🖕', '🤮', '💩', '👅', '🫦', '🥵', '💀', '👹', '😡', '😾', '😒',
  '👎', '🛑', '⛔️', '🚩',
]);

const SAFE_CATALOG = CATALOG.filter((item) => !OFF_LIMITS_FOR_CHATBOT.has(item.fallback));
const cursors = new Map();

function hasOneOf(symbols) {
  return (item) => symbols.includes(item.fallback);
}

const POOLS = {
  love: CATALOG.filter(hasOneOf([
    '❤️', '❤', '🤍', '🩷', '💕', '💗', '💘', '💋', '😘', '🥰', '😍',
    '🌹', '🌸', '🌼', '💐', '🦋', '🎀', '💍', '🫂', '❣️', '🥺',
  ])),
  sad: CATALOG.filter(hasOneOf([
    '😭', '🥺', '💔', '😞', '💧', '🌧', '🥀', '🪫', '😢', '😶', '🖤',
  ])),
  fun: SAFE_CATALOG.filter(hasOneOf([
    '😂', '🤣', '😆', '😃', '😄', '😁', '😀', '😊', '😌', '😉', '😎',
    '😝', '💃', '🕺', '🎶', '🎵', '🐱', '🦕', '🦁', '🐝', '🆒', '🤙',
  ])),
  success: SAFE_CATALOG.filter(hasOneOf([
    '✔', '✔️', '✅', '👍', '⭐', '⭐️', '🌟', '✨', '💫', '👑', '🏅',
    '🎁', '🎀', '🔥', '🔝', '🥂', '💍', '🌹',
  ])),
  warning: SAFE_CATALOG.filter(hasOneOf([
    '⚠️', '❕', '🚨', '🔔', '📌', '📍', '❌', '⛔️', '🛑', '📣',
  ])),
  danger: SAFE_CATALOG.filter(hasOneOf([
    '⚠️', '❕', '🚨', '❌', '🔥', '⛔️', '🛑',
  ])),
  money: SAFE_CATALOG.filter(hasOneOf(['💲', '💵', '💳', '🎁', '🏅'])),
  bot: SAFE_CATALOG.filter(hasOneOf(['🧑‍💻', '⚙️', '🔋', '✨', '🌟', '💫'])),
  join: SAFE_CATALOG.filter(hasOneOf(['✅', '👍', '🎁', '🌟', '👑', '🫂'])),
  leave: SAFE_CATALOG.filter(hasOneOf(['💧', '🌙', '🖤', '🌧', '🦋'])),
  note: SAFE_CATALOG.filter(hasOneOf(['📝', '📌', '🔖', '✉', '💬'])),
  search: SAFE_CATALOG.filter(hasOneOf(['🔍', '📍', '🌀', '✨', '🌟'])),
  pin: SAFE_CATALOG.filter(hasOneOf(['📌', '🔖', '📍', '⭐', '🌟'])),
  lock: SAFE_CATALOG.filter(hasOneOf(['🔒', '🔇', '⚠️', '🛑', '⛔️'])),
  primary: SAFE_CATALOG,
  chatbot: SAFE_CATALOG.filter(hasOneOf([
    '❤️', '❤', '🤍', '🩷', '💕', '💗', '🌹', '🌸', '🌼', '💐', '🦋',
    '⭐', '⭐️', '🌟', '✨', '💫', '😊', '😌', '😉', '😎', '😃', '😄',
    '😁', '😀', '🥹', '🤩', '🥰', '😍', '👍', '🫂', '🎀', '🐱',
  ])),
};

function pick(alias, fallback = '✨') {
  const override = IDS[alias];
  if (override) return { id: override, fallback };

  const pool = POOLS[alias] || POOLS.chatbot;
  if (!pool.length) return null;
  const cursor = cursors.get(alias) || 0;
  const item = pool[cursor % pool.length];
  cursors.set(alias, cursor + 1);
  return item;
}

function has(alias) {
  return Boolean(IDS[alias] || POOLS[alias]?.length);
}

/**
 * Return a Telegram HTML custom-emoji entity. The supplied Unicode fallback
 * keeps the message readable in clients that do not render the entity.
 */
function emoji(alias, fallback = '') {
  const item = pick(alias, fallback);
  return item ? `<tg-emoji emoji-id="${item.id}">${item.fallback || fallback}</tg-emoji>` : '';
}

function decorate(text, alias = 'chatbot') {
  const prefix = emoji(alias);
  return prefix ? `${prefix} ${String(text || '')}` : String(text || '');
}

/**
 * Place premium (custom) emoji the way a real person types them: usually at
 * the end of the message, sometimes right after the first sentence, and never
 * as a stiff prefix on every single reply.
 */
function humanize(text, alias = 'chatbot', options = {}) {
  const body = String(text || '').trim();
  if (!body) return body;

  const chance = options.chance ?? 0.85;
  if (Math.random() > chance) return body;

  // Lists / long explanations read better with a single closing emoji only.
  const isList = /(^|\n)\s*(?:[-•*]|\d+[.)])\s/.test(body);
  const sentences = body.split(/(?<=[.!?…])\s+/).filter(Boolean);

  let out = body;

  if (!isList && sentences.length >= 2 && Math.random() < 0.28) {
    const mid = emoji(alias);
    if (mid) {
      sentences[0] = `${sentences[0]} ${mid}`;
      out = sentences.join(' ');
    }
  }

  const tail = emoji(alias);
  if (!tail) return out;

  // Humans stack two emoji once in a while when they are excited.
  const doubled = !isList && Math.random() < 0.12 ? ` ${emoji(alias)}` : '';
  return `${out} ${tail}${doubled}`.replace(/\s+$/, '');
}

module.exports = {
  PACK_LINKS,
  CATALOG,
  IDS,
  has,
  emoji,
  decorate,
  humanize,
  pick,
};
