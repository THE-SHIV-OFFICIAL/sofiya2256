const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { safeReply, mention, isUserAdmin } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const reports = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!['on', 'off'].includes(arg)) {
    const g = await getGroup(ctx.chat.id);
    return safeReply(ctx, `Reports: <b>${g.reports ? 'on' : 'off'}</b>.\nUsage: <code>/reports on|off</code>`);
  }
  await updateGroup(ctx.chat.id, { reports: arg === 'on' });
  await safeReply(ctx, `✅ Reports ${arg}.`);
});

const report = async (ctx) => {
  if (!ctx.chat || ctx.chat.type === 'private') return;
  if (!ctx.message.reply_to_message) return safeReply(ctx, '❌ Reply to the offending message with /report.');
  const g = await getGroup(ctx.chat.id);
  if (!g.reports) return;
  const offender = ctx.message.reply_to_message.from;
  if (await isUserAdmin(ctx, offender.id)) return safeReply(ctx, '❌ Cannot report an admin.');
  try {
    const admins = await ctx.getChatAdministrators();
    let pings = '';
    for (const a of admins) {
      if (a.user.is_bot) continue;
      pings += `<a href="tg://user?id=${a.user.id}">\u200B</a>`;
    }
    await ctx.reply(
      `${pings}🚨 <b>Report</b>: ${mention(ctx.from)} reported ${mention(offender)}.`,
      { parse_mode: 'HTML', reply_to_message_id: ctx.message.reply_to_message.message_id }
    );
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
};

module.exports = { report, reports };
