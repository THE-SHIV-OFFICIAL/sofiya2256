const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { safeReply } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const cleancommand = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!['on', 'off'].includes(arg)) {
    const g = await getGroup(ctx.chat.id);
    return safeReply(ctx, `Clean command: <b>${g.cleanCommand ? 'on' : 'off'}</b>.\nUsage: <code>/cleancommand on|off</code>`);
  }
  await updateGroup(ctx.chat.id, { cleanCommand: arg === 'on' });
  await safeReply(ctx, `✅ Clean command ${arg}.`);
});

async function cleanCommandMiddleware(ctx, next) {
  if (!ctx.message?.text || !ctx.chat || ctx.chat.type === 'private') return next();
  if (!ctx.message.text.startsWith('/')) return next();
  const g = await getGroup(ctx.chat.id);
  await next();
  if (g.cleanCommand) { try { await ctx.deleteMessage(); } catch {} }
}

module.exports = { cleancommand, cleanCommandMiddleware };
