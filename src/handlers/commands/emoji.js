'use strict';

const { safeReply } = require('../../utils/helpers');
const { PACK_LINKS, CATALOG } = require('../../utils/premiumEmoji');

/**
 * Telegram sends custom emoji IDs in message entities. Reply to a message
 * containing a premium/custom emoji with /emojiid to copy the IDs into .env.
 */
async function emojiId(ctx) {
  const replied = ctx.message?.reply_to_message;
  if (!replied) {
    return safeReply(ctx,
      `<b>Premium emoji ID helper</b>\n\n` +
      `Premium emoji wale message par reply karke <code>/emojiid</code> bhejo.\n` +
      `Telegram se milne wale numeric IDs ko <code>PREMIUM_EMOJI_IDS</code> mein map karo.`);
  }

  const entities = [
    ...(replied.entities || []),
    ...(replied.caption_entities || []),
  ].filter((entity) => entity.type === 'custom_emoji' && entity.custom_emoji_id);

  if (!entities.length) {
    return safeReply(ctx,
      `Is replied message mein custom emoji entity nahi mili.\n` +
      `Telegram Premium/custom emoji ko directly message mein send karke phir reply karo.`);
  }

  const unique = [...new Set(entities.map((entity) => entity.custom_emoji_id))];
  const lines = unique.map((id, index) => `emoji${index + 1}=${id}`);
  return safeReply(ctx,
    `<b>Custom emoji IDs</b>\n\n` +
    `<pre>${lines.join('\n')}</pre>\n\n` +
    `Example:\n<code>PREMIUM_EMOJI_IDS=chatbot=${unique[0]}</code>`);
}

async function emojiPacks(ctx) {
  return safeReply(ctx,
    `<b>Sofiya premium emoji library</b>\n\n` +
    `<b>${CATALOG.length}</b> unique custom emoji IDs are built in and grouped by mood/action for chatbot replies and logger events.\n\n` +
    PACK_LINKS.map((url, index) => `${index + 1}. ${url}`).join('\n') +
    `\n\n<code>/emojiid</code> se naye IDs bhi check kar sakte ho. Pack URL ko direct custom emoji ki tarah render nahi kiya ja sakta.`);
}

module.exports = { emojiId, emojiPacks };