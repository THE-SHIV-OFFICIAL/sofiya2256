const { extractTarget, mention, parseDuration, formatDuration, safeReply, isUserAdmin } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');
const { logEvent } = require('../../services/loggingService');

const mutedPerms = {
  can_send_messages: false,
  can_send_audios: false,
  can_send_documents: false,
  can_send_photos: false,
  can_send_videos: false,
  can_send_video_notes: false,
  can_send_voice_notes: false,
  can_send_polls: false,
  can_send_other_messages: false,
  can_add_web_page_previews: false,
  can_change_info: false,
  can_invite_users: false,
  can_pin_messages: false,
};

const unmutedPerms = {
  can_send_messages: true,
  can_send_audios: true,
  can_send_documents: true,
  can_send_photos: true,
  can_send_videos: true,
  can_send_video_notes: true,
  can_send_voice_notes: true,
  can_send_polls: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true,
  can_invite_users: true,
};

const mute = requireAdmin(async (ctx) => {
  const { user, reason } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  if (await isUserAdmin(ctx, user.id)) return safeReply(ctx, '❌ Cannot mute an admin.');
  try {
    await ctx.restrictChatMember(user.id, { permissions: mutedPerms });
    await safeReply(ctx, `🔇 ${mention(user)} has been muted.${reason ? `\n<b>Reason:</b> ${reason}` : ''}`);
    logEvent('mute', { chat: ctx.chat, actor: ctx.from, target: user, reason }).catch(() => {});
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const smute = requireAdmin(async (ctx) => {
  const { user } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  if (await isUserAdmin(ctx, user.id)) return;
  try {
    await ctx.restrictChatMember(user.id, { permissions: mutedPerms });
    try { await ctx.deleteMessage(); } catch {}
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const dmute = requireAdmin(async (ctx) => {
  if (!ctx.message.reply_to_message) return safeReply(ctx, '❌ Reply to the message you want deleted.');
  const { user, reason } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  if (await isUserAdmin(ctx, user.id)) return safeReply(ctx, '❌ Cannot mute an admin.');
  try {
    await ctx.restrictChatMember(user.id, { permissions: mutedPerms });
    try { await ctx.deleteMessage(ctx.message.reply_to_message.message_id); } catch {}
    await safeReply(ctx, `🔇 ${mention(user)} muted, message deleted.${reason ? `\n<b>Reason:</b> ${reason}` : ''}`);
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const tmute = requireAdmin(async (ctx) => {
  const parts = (ctx.message.text || '').split(/\s+/).slice(1);
  let duration = ctx.message.reply_to_message ? parseDuration(parts[0]) : parseDuration(parts[1]);
  if (!duration) return safeReply(ctx, '❌ Usage: <code>/tmute &lt;user&gt; &lt;duration&gt; [reason]</code>');
  const { user, reason } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  if (await isUserAdmin(ctx, user.id)) return safeReply(ctx, '❌ Cannot mute an admin.');
  const until = Math.floor(Date.now() / 1000) + duration;
  try {
    await ctx.restrictChatMember(user.id, { permissions: mutedPerms, until_date: until });
    await safeReply(ctx, `🔇 ${mention(user)} muted for <b>${formatDuration(duration)}</b>.${reason ? `\n<b>Reason:</b> ${reason}` : ''}`);
    logEvent('mute', { chat: ctx.chat, actor: ctx.from, target: user, reason, duration: formatDuration(duration) }).catch(() => {});
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const unmute = requireAdmin(async (ctx) => {
  const { user } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  try {
    await ctx.restrictChatMember(user.id, { permissions: unmutedPerms });
    await safeReply(ctx, `🔊 ${mention(user)} has been unmuted.`);
    logEvent('unmute', { chat: ctx.chat, actor: ctx.from, target: user }).catch(() => {});
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

module.exports = { mute, smute, dmute, tmute, unmute };
