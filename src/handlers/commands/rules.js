const { Markup } = require('telegraf');
const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { safeReply, escapeHtml } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const setrules = requireAdmin(async (ctx) => {
  const text = (ctx.message.text || '').split(/\s+/).slice(1).join(' ').trim();
  if (!text) return safeReply(ctx, '❌ Usage: <code>/setrules &lt;rules text&gt;</code>');
  await updateGroup(ctx.chat.id, { rules: text });
  await safeReply(ctx, '✅ Rules updated.');
});

const clearrules = requireAdmin(async (ctx) => {
  await updateGroup(ctx.chat.id, { rules: '' });
  await safeReply(ctx, '🗑️ Rules cleared.');
});

const rules = async (ctx) => {
  const g = await getGroup(ctx.chat.id);
  const r = g.rules || 'No rules have been set for this chat.';
  if (g.privateRules && ctx.chat.type !== 'private') {
    const me = ctx.botInfo?.username || (await ctx.telegram.getMe()).username;
    const kb = Markup.inlineKeyboard([[Markup.button.url('📜 Read Rules', `https://t.me/${me}?start=rules_${ctx.chat.id}`)]]);
    return ctx.reply('📜 Rules are private — tap below to read in PM.', kb);
  }
  await safeReply(ctx, `📜 <b>Rules for ${escapeHtml(ctx.chat.title || 'this chat')}</b>:\n\n${escapeHtml(r)}`);
};

const privaterules = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!['on', 'off', 'yes', 'no'].includes(arg)) {
    const g = await getGroup(ctx.chat.id);
    return safeReply(ctx, `Private rules: <b>${g.privateRules ? 'on' : 'off'}</b>.\nUsage: <code>/privaterules on|off</code>`);
  }
  const v = ['on', 'yes'].includes(arg);
  await updateGroup(ctx.chat.id, { privateRules: v });
  await safeReply(ctx, `✅ Private rules ${v ? 'enabled' : 'disabled'}.`);
});

module.exports = { setrules, clearrules, rules, privaterules };
