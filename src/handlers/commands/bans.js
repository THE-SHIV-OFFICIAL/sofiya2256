const { extractTarget, mention, parseDuration, formatDuration, safeReply, isUserAdmin } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');
const { logEvent } = require('../../services/loggingService');

async function doBan(ctx, until = 0) {
  const { user, reason } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply to a user, mention them, or pass an ID/username.');
  if (await isUserAdmin(ctx, user.id)) return safeReply(ctx, '❌ Cannot ban an admin.');
  try {
    await ctx.banChatMember(user.id, until || undefined);
  } catch (e) {
    return safeReply(ctx, `❌ Could not ban: ${e.description || e.message}`);
  }
  return { user, reason };
}

const ban = requireAdmin(async (ctx) => {
  const r = await doBan(ctx);
  if (!r) return;
  await safeReply(ctx, `🔨 ${mention(r.user)} has been banned.${r.reason ? `\n<b>Reason:</b> ${r.reason}` : ''}`);
  logEvent('ban', { chat: ctx.chat, actor: ctx.from, target: r.user, reason: r.reason }).catch(() => {});
});

const sban = requireAdmin(async (ctx) => {
  const r = await doBan(ctx);
  if (!r) return;
  try { await ctx.deleteMessage(); } catch {}
  if (ctx.message.reply_to_message) {
    try { await ctx.deleteMessage(ctx.message.reply_to_message.message_id); } catch {}
  }
});

const dban = requireAdmin(async (ctx) => {
  if (!ctx.message.reply_to_message) return safeReply(ctx, '❌ Reply to the message you want deleted.');
  const r = await doBan(ctx);
  if (!r) return;
  try { await ctx.deleteMessage(ctx.message.reply_to_message.message_id); } catch {}
  await safeReply(ctx, `🔨 ${mention(r.user)} has been banned and message deleted.`);
  logEvent('ban', { chat: ctx.chat, actor: ctx.from, target: r.user, reason: r.reason, extra: 'message deleted' }).catch(() => {});
});

const tban = requireAdmin(async (ctx) => {
  const parts = (ctx.message.text || '').split(/\s+/).slice(1);
  let duration = null;
  if (ctx.message.reply_to_message) {
    duration = parseDuration(parts[0]);
  } else {
    duration = parseDuration(parts[1]);
  }
  if (!duration) return safeReply(ctx, '❌ Usage: <code>/tban &lt;user&gt; &lt;duration&gt; [reason]</code>\nDurations: 30s, 5m, 2h, 1d, 1w');
  const until = Math.floor(Date.now() / 1000) + duration;
  const r = await doBan(ctx, until);
  if (!r) return;
  await safeReply(ctx, `⏳ ${mention(r.user)} banned for <b>${formatDuration(duration)}</b>.${r.reason ? `\n<b>Reason:</b> ${r.reason}` : ''}`);
  logEvent('ban', { chat: ctx.chat, actor: ctx.from, target: r.user, reason: r.reason, duration: formatDuration(duration) }).catch(() => {});
});

const unban = requireAdmin(async (ctx) => {
  const { user } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply to a user, mention them, or pass an ID.');
  try {
    await ctx.unbanChatMember(user.id, { only_if_banned: false });
    await safeReply(ctx, `✅ ${mention(user)} has been unbanned.`);
    logEvent('unban', { chat: ctx.chat, actor: ctx.from, target: user }).catch(() => {});
  } catch (e) {
    await safeReply(ctx, `❌ Could not unban: ${e.description || e.message}`);
  }
});

const kick = requireAdmin(async (ctx) => {
  const { user, reason } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply to a user, mention them, or pass an ID.');
  if (await isUserAdmin(ctx, user.id)) return safeReply(ctx, '❌ Cannot kick an admin.');
  try {
    await ctx.banChatMember(user.id);
    await ctx.unbanChatMember(user.id);
    await safeReply(ctx, `👢 ${mention(user)} has been kicked.${reason ? `\n<b>Reason:</b> ${reason}` : ''}`);
    logEvent('kick', { chat: ctx.chat, actor: ctx.from, target: user, reason }).catch(() => {});
  } catch (e) {
    await safeReply(ctx, `❌ Could not kick: ${e.description || e.message}`);
  }
});

const skick = requireAdmin(async (ctx) => {
  const { user } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  if (await isUserAdmin(ctx, user.id)) return safeReply(ctx, '❌ Cannot kick an admin.');
  try {
    await ctx.banChatMember(user.id);
    await ctx.unbanChatMember(user.id);
    try { await ctx.deleteMessage(); } catch {}
  } catch (e) {
    await safeReply(ctx, `❌ Could not kick: ${e.description || e.message}`);
  }
});

const kickme = async (ctx) => {
  if (!ctx.chat || ctx.chat.type === 'private') return;
  if (await isUserAdmin(ctx, ctx.from.id)) return safeReply(ctx, '😏 You are an admin, you can leave on your own.');
  try {
    await ctx.banChatMember(ctx.from.id);
    await ctx.unbanChatMember(ctx.from.id);
    await safeReply(ctx, `👋 Goodbye, ${mention(ctx.from)}!`);
  } catch (e) {
    await safeReply(ctx, `❌ Could not kick you: ${e.description || e.message}`);
  }
};

const banme = async (ctx) => {
  if (!ctx.chat || ctx.chat.type === 'private') return;
  if (await isUserAdmin(ctx, ctx.from.id)) return safeReply(ctx, '😏 Admins cannot ban themselves with this.');
  try {
    await ctx.banChatMember(ctx.from.id);
    await safeReply(ctx, `🔨 ${mention(ctx.from)} banned themselves. F.`);
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
};

module.exports = { ban, sban, dban, tban, unban, kick, skick, kickme, banme };
