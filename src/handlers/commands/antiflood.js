const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { safeReply, mention, parseDuration, formatDuration, isUserAdmin } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const counters = new Map(); // key: chatId:userId -> { count, last, msgIds:[] }

const setflood = requireAdmin(async (ctx) => {
  const arg = (ctx.message.text || '').split(/\s+/)[1];
  const n = parseInt(arg, 10);
  if (!arg || (arg !== 'off' && (isNaN(n) || n < 0))) {
    return safeReply(ctx, '❌ Usage: <code>/setflood &lt;number&gt;</code> or <code>/setflood off</code>');
  }
  if (arg === 'off' || n === 0) {
    await updateGroup(ctx.chat.id, { 'flood.enabled': false });
    return safeReply(ctx, '🔕 Anti-flood disabled.');
  }
  await updateGroup(ctx.chat.id, { 'flood.enabled': true, 'flood.limit': n });
  await safeReply(ctx, `✅ Anti-flood limit set to <b>${n}</b> consecutive messages.`);
});

const flood = async (ctx) => {
  const g = await getGroup(ctx.chat.id);
  await safeReply(ctx,
    `<b>Anti-flood</b>\nEnabled: <b>${g.flood.enabled}</b>\nLimit: <b>${g.flood.limit}</b>\nMode: <b>${g.flood.mode}</b>${g.flood.mode === 'tmute' ? ` (${formatDuration(g.flood.duration)})` : ''}`);
};

const floodmode = requireAdmin(async (ctx) => {
  const parts = (ctx.message.text || '').split(/\s+/).slice(1);
  const mode = (parts[0] || '').toLowerCase();
  if (!['mute', 'kick', 'ban', 'tmute'].includes(mode)) {
    return safeReply(ctx, '❌ Usage: <code>/floodmode mute|kick|ban|tmute &lt;duration&gt;</code>');
  }
  const update = { 'flood.mode': mode };
  if (mode === 'tmute') {
    const d = parseDuration(parts[1]);
    if (!d) return safeReply(ctx, '❌ For tmute, supply a duration (e.g. 10m).');
    update['flood.duration'] = d;
  }
  await updateGroup(ctx.chat.id, update);
  await safeReply(ctx, `✅ Flood mode set to <b>${mode}</b>.`);
});

async function antifloodMiddleware(ctx, next) {
  if (!ctx.message || !ctx.chat || ctx.chat.type === 'private') return next();
  const g = await getGroup(ctx.chat.id);
  if (!g.flood.enabled) return next();
  if (await isUserAdmin(ctx, ctx.from.id)) return next();

  const key = `${ctx.chat.id}:${ctx.from.id}`;
  const now = Date.now();
  let entry = counters.get(key);
  if (!entry || now - entry.last > 5000) entry = { count: 0, last: now, msgIds: [] };
  entry.count += 1;
  entry.last = now;
  entry.msgIds.push(ctx.message.message_id);
  counters.set(key, entry);

  if (entry.count >= g.flood.limit) {
    counters.delete(key);
    try {
      if (g.flood.mode === 'mute') {
        await ctx.restrictChatMember(ctx.from.id, { permissions: { can_send_messages: false } });
      } else if (g.flood.mode === 'tmute') {
        await ctx.restrictChatMember(ctx.from.id, { permissions: { can_send_messages: false }, until_date: Math.floor(Date.now() / 1000) + g.flood.duration });
      } else if (g.flood.mode === 'kick') {
        await ctx.banChatMember(ctx.from.id);
        await ctx.unbanChatMember(ctx.from.id);
      } else if (g.flood.mode === 'ban') {
        await ctx.banChatMember(ctx.from.id);
      }
      await ctx.reply(`🌊 ${mention(ctx.from)} flooding → action: <b>${g.flood.mode}</b>.`, { parse_mode: 'HTML' });
    } catch {}
  }
  return next();
}

module.exports = { setflood, flood, floodmode, antifloodMiddleware };
