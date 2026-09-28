const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { safeReply, parseDuration, formatDuration, mention } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const antiraid = requireAdmin(async (ctx) => {
  const parts = (ctx.message.text || '').split(/\s+/).slice(1);
  const arg = (parts[0] || '').toLowerCase();
  if (!arg) {
    const g = await getGroup(ctx.chat.id);
    return safeReply(ctx, `Anti-raid: <b>${g.antiRaid.enabled ? 'on' : 'off'}</b>, action duration: <b>${formatDuration(g.antiRaid.actionDuration)}</b>.\nUsage: <code>/antiraid on|off [duration]</code>`);
  }
  if (arg === 'on') {
    const d = parts[1] ? parseDuration(parts[1]) : null;
    const update = { 'antiRaid.enabled': true };
    if (d) update['antiRaid.actionDuration'] = d;
    await updateGroup(ctx.chat.id, update);
    return safeReply(ctx, `🛡️ Anti-raid <b>enabled</b>${d ? ` for ${formatDuration(d)}` : ''}.`);
  }
  if (arg === 'off') {
    await updateGroup(ctx.chat.id, { 'antiRaid.enabled': false });
    return safeReply(ctx, '🛡️ Anti-raid disabled.');
  }
  return safeReply(ctx, '❌ Usage: <code>/antiraid on|off [duration]</code>');
});

async function antiRaidJoinMiddleware(ctx, next) {
  if (!ctx.message?.new_chat_members) return next();
  const g = await getGroup(ctx.chat.id);
  if (!g.antiRaid.enabled) return next();
  for (const u of ctx.message.new_chat_members) {
    if (u.is_bot) continue;
    try {
      const until = Math.floor(Date.now() / 1000) + g.antiRaid.actionDuration;
      await ctx.banChatMember(u.id, until);
      await ctx.reply(`🛡️ Anti-raid: ${mention(u)} blocked for ${formatDuration(g.antiRaid.actionDuration)}.`, { parse_mode: 'HTML' });
    } catch {}
  }
  return next();
}

module.exports = { antiraid, antiRaidJoinMiddleware };
