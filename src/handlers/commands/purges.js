const { safeReply } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const purge = requireAdmin(async (ctx) => {
  if (!ctx.message.reply_to_message) return safeReply(ctx, '❌ Reply to the message you want to start the purge from.');
  const fromId = ctx.message.reply_to_message.message_id;
  const toId = ctx.message.message_id;
  let deleted = 0;
  for (let id = fromId; id <= toId; id++) {
    try { await ctx.deleteMessage(id); deleted++; } catch {}
    if (deleted % 50 === 0) await new Promise((r) => setTimeout(r, 500));
  }
  const m = await ctx.reply(`🧹 Purged <b>${deleted}</b> messages.`, { parse_mode: 'HTML' });
  setTimeout(() => ctx.deleteMessage(m.message_id).catch(() => {}), 3000);
});

const del = requireAdmin(async (ctx) => {
  if (!ctx.message.reply_to_message) return safeReply(ctx, '❌ Reply to the message you want to delete.');
  try {
    await ctx.deleteMessage(ctx.message.reply_to_message.message_id);
    try { await ctx.deleteMessage(); } catch {}
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const purgefrom = requireAdmin(async (ctx) => {
  if (!ctx.message.reply_to_message) return safeReply(ctx, '❌ Reply to the start message.');
  ctx.session = ctx.session || {};
  global.__purgeFrom = global.__purgeFrom || new Map();
  global.__purgeFrom.set(`${ctx.chat.id}:${ctx.from.id}`, ctx.message.reply_to_message.message_id);
  await safeReply(ctx, '✅ Purge start point set. Reply <code>/purgeto</code> to the end message.');
});

const purgeto = requireAdmin(async (ctx) => {
  if (!ctx.message.reply_to_message) return safeReply(ctx, '❌ Reply to the end message.');
  global.__purgeFrom = global.__purgeFrom || new Map();
  const start = global.__purgeFrom.get(`${ctx.chat.id}:${ctx.from.id}`);
  if (!start) return safeReply(ctx, '❌ Use <code>/purgefrom</code> first.');
  const end = ctx.message.reply_to_message.message_id;
  let deleted = 0;
  for (let id = Math.min(start, end); id <= Math.max(start, end); id++) {
    try { await ctx.deleteMessage(id); deleted++; } catch {}
    if (deleted % 50 === 0) await new Promise((r) => setTimeout(r, 500));
  }
  global.__purgeFrom.delete(`${ctx.chat.id}:${ctx.from.id}`);
  await safeReply(ctx, `🧹 Purged <b>${deleted}</b> messages.`);
});

module.exports = { purge, del, purgefrom, purgeto };
