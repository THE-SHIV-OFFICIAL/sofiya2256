const { Connection } = require('../../models');
const { safeReply, escapeHtml, isUserAdmin } = require('../../utils/helpers');

const connect = async (ctx) => {
  if (ctx.chat.type === 'private') {
    const arg = (ctx.message.text || '').split(/\s+/)[1];
    const chatId = parseInt(arg, 10);
    if (!chatId) return safeReply(ctx, '❌ Usage in PM: <code>/connect &lt;chatId&gt;</code>\nOr run /connect inside a group.');
    try {
      const m = await ctx.telegram.getChatMember(chatId, ctx.from.id);
      if (!['administrator', 'creator', 'member'].includes(m.status)) return safeReply(ctx, '❌ You\'re not in that chat.');
      const chat = await ctx.telegram.getChat(chatId);
      await Connection.findOneAndUpdate({ userId: ctx.from.id }, { chatId, chatTitle: chat.title }, { upsert: true });
      await safeReply(ctx, `✅ Connected to <b>${escapeHtml(chat.title)}</b>.`);
    } catch (e) {
      await safeReply(ctx, `❌ ${e.description || e.message}`);
    }
    return;
  }
  if (!(await isUserAdmin(ctx, ctx.from.id))) return safeReply(ctx, '❌ Group admins only can /connect from here.');
  await Connection.findOneAndUpdate({ userId: ctx.from.id }, { chatId: ctx.chat.id, chatTitle: ctx.chat.title }, { upsert: true });
  await safeReply(ctx, `✅ Connected. PM the bot and you can now manage <b>${escapeHtml(ctx.chat.title)}</b> from there.`);
};

const disconnect = async (ctx) => {
  await Connection.deleteOne({ userId: ctx.from.id });
  await safeReply(ctx, '🔌 Disconnected.');
};

const connection = async (ctx) => {
  const c = await Connection.findOne({ userId: ctx.from.id });
  if (!c) return safeReply(ctx, 'You are not connected to any chat.');
  await safeReply(ctx, `🔗 You are connected to <b>${escapeHtml(c.chatTitle || String(c.chatId))}</b> (<code>${c.chatId}</code>).`);
};

module.exports = { connect, disconnect, connection };
