const { DisabledCommand } = require('../../models');
const { safeReply, escapeHtml } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const ENABLEABLE = new Set([
  'rules', 'notes', 'get', 'filters', 'id', 'info', 'ping', 'runs', 'echo', 'stats',
  'balance', 'daily', 'weekly', 'leaderboard', 'wordguess', 'gamew', 'guess', 'trivia',
  'adminlist', 'invitelink', 'report',
]);

const disable = requireAdmin(async (ctx) => {
  const args = (ctx.message.text || '').split(/\s+/).slice(1).map((s) => s.toLowerCase().replace(/^\//, '')).filter(Boolean);
  if (args.length === 0) return safeReply(ctx, '❌ Usage: <code>/disable &lt;command&gt;</code>');
  const ok = [];
  for (const c of args) {
    if (!ENABLEABLE.has(c)) continue;
    await DisabledCommand.findOneAndUpdate({ chatId: ctx.chat.id, command: c }, {}, { upsert: true });
    ok.push(c);
  }
  if (ok.length === 0) return safeReply(ctx, '❌ None of those commands are disableable. /disableable for the list.');
  await safeReply(ctx, `🔕 Disabled: <b>${ok.join(', ')}</b>`);
});

const enable = requireAdmin(async (ctx) => {
  const args = (ctx.message.text || '').split(/\s+/).slice(1).map((s) => s.toLowerCase().replace(/^\//, '')).filter(Boolean);
  if (args.length === 0) return safeReply(ctx, '❌ Usage: <code>/enable &lt;command&gt;</code>');
  let n = 0;
  for (const c of args) {
    const r = await DisabledCommand.deleteOne({ chatId: ctx.chat.id, command: c });
    n += r.deletedCount || 0;
  }
  await safeReply(ctx, `✅ Re-enabled <b>${n}</b> command(s).`);
});

const disabled = async (ctx) => {
  const list = await DisabledCommand.find({ chatId: ctx.chat.id }).lean();
  if (list.length === 0) return safeReply(ctx, 'No commands disabled here.');
  await safeReply(ctx, `🔕 <b>Disabled:</b>\n${list.map((d) => `• <code>${escapeHtml(d.command)}</code>`).join('\n')}`);
};

const disableable = async (ctx) => {
  await safeReply(ctx, `<b>Commands you can disable:</b>\n${[...ENABLEABLE].sort().map((c) => `• <code>${c}</code>`).join('\n')}`);
};

async function disabledMiddleware(ctx, next) {
  if (!ctx.message?.text || !ctx.chat || ctx.chat.type === 'private') return next();
  const m = ctx.message.text.match(/^\/(\w+)/);
  if (!m) return next();
  if (ctx.isAdmin) return next();
  const cmd = m[1].toLowerCase().split('@')[0];
  const d = await DisabledCommand.findOne({ chatId: ctx.chat.id, command: cmd });
  if (!d) return next();
  if (d.deleteMessage) { try { await ctx.deleteMessage(); } catch {} }
  return; // block
}

module.exports = { disable, enable, disabled, disableable, disabledMiddleware, ENABLEABLE };
