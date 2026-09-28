const { safeReply } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');
const { getGroup, updateGroup } = require('../../utils/groupSettings');

const pin = requireAdmin(async (ctx) => {
  if (!ctx.message.reply_to_message) return safeReply(ctx, '❌ Reply to the message to pin.');
  const args = ((ctx.message.text || '').split(/\s+/).slice(1).join(' ') || '').toLowerCase();
  const silent = args.includes('silent') || args.includes('quiet');
  try {
    await ctx.pinChatMessage(ctx.message.reply_to_message.message_id, { disable_notification: silent });
    await safeReply(ctx, silent ? '📌 Pinned silently.' : '📌 Pinned.');
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const unpin = requireAdmin(async (ctx) => {
  try {
    if (ctx.message.reply_to_message) {
      await ctx.unpinChatMessage(ctx.message.reply_to_message.message_id);
    } else {
      await ctx.unpinChatMessage();
    }
    await safeReply(ctx, '📍 Unpinned.');
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const unpinall = requireAdmin(async (ctx) => {
  try {
    await ctx.telegram.unpinAllChatMessages(ctx.chat.id);
    await safeReply(ctx, '🧹 All messages unpinned.');
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const antichannelpin = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!['on', 'off'].includes(arg)) {
    const g = await getGroup(ctx.chat.id);
    return safeReply(ctx, `Anti-channel-pin: <b>${g.antiChannelPin ? 'on' : 'off'}</b>.\nUsage: <code>/antichannelpin on|off</code>`);
  }
  await updateGroup(ctx.chat.id, { antiChannelPin: arg === 'on' });
  await safeReply(ctx, `✅ Anti-channel-pin ${arg}.`);
});

async function antiChannelPinMiddleware(ctx, next) {
  if (!ctx.message || ctx.message.sender_chat?.type !== 'channel') return next();
  const g = await getGroup(ctx.chat.id);
  if (!g.antiChannelPin) return next();
  try { await ctx.deleteMessage(); } catch {}
  return; // block
}

module.exports = { pin, unpin, unpinall, antichannelpin, antiChannelPinMiddleware };
