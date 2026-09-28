const { Markup } = require('telegraf');
const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { safeReply, mention } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const pending = new Map(); // chatId:userId -> { timeout }

const captcha = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!['on', 'off'].includes(arg)) {
    const g = await getGroup(ctx.chat.id);
    return safeReply(ctx, `CAPTCHA: <b>${g.captcha.enabled ? 'on' : 'off'}</b>, mode: <b>${g.captcha.mode}</b>.\nUsage: <code>/captcha on|off</code>`);
  }
  await updateGroup(ctx.chat.id, { 'captcha.enabled': arg === 'on' });
  await safeReply(ctx, `✅ CAPTCHA ${arg}.`);
});

const captchamode = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!['button', 'math', 'text'].includes(arg)) return safeReply(ctx, '❌ Usage: <code>/captchamode button|math|text</code>');
  await updateGroup(ctx.chat.id, { 'captcha.mode': arg });
  await safeReply(ctx, `✅ CAPTCHA mode set to <b>${arg}</b>.`);
});

async function captchaJoinHandler(ctx, next) {
  if (!ctx.message?.new_chat_members) return next();
  const g = await getGroup(ctx.chat.id);
  if (!g.captcha.enabled) return next();
  for (const u of ctx.message.new_chat_members) {
    if (u.is_bot) continue;
    try {
      await ctx.restrictChatMember(u.id, { permissions: { can_send_messages: false } });
      const kb = Markup.inlineKeyboard([Markup.button.callback('🤖 I\'m human', `captcha:${u.id}`)]);
      const m = await ctx.reply(`🛡️ ${mention(u)}, prove you're not a bot — tap the button within ${g.captcha.timeout}s.`, { parse_mode: 'HTML', ...kb });
      const key = `${ctx.chat.id}:${u.id}`;
      const timeout = setTimeout(async () => {
        try {
          await ctx.banChatMember(u.id);
          await ctx.unbanChatMember(u.id);
          try { await ctx.deleteMessage(m.message_id); } catch {}
        } catch {}
        pending.delete(key);
      }, g.captcha.timeout * 1000);
      pending.set(key, { timeout, msgId: m.message_id });
    } catch {}
  }
  return next();
}

async function captchaCallback(ctx) {
  const data = ctx.callbackQuery?.data || '';
  const m = data.match(/^captcha:(\d+)$/);
  if (!m) return false;
  const userId = parseInt(m[1], 10);
  if (ctx.from.id !== userId) {
    await ctx.answerCbQuery('❌ This is not for you.');
    return true;
  }
  try {
    await ctx.restrictChatMember(userId, {
      permissions: {
        can_send_messages: true, can_send_audios: true, can_send_documents: true,
        can_send_photos: true, can_send_videos: true, can_send_video_notes: true,
        can_send_voice_notes: true, can_send_polls: true, can_send_other_messages: true,
        can_add_web_page_previews: true, can_invite_users: true,
      },
    });
  } catch {}
  const key = `${ctx.chat.id}:${userId}`;
  const p = pending.get(key);
  if (p) { clearTimeout(p.timeout); pending.delete(key); try { await ctx.deleteMessage(p.msgId); } catch {} }
  await ctx.answerCbQuery('✅ Welcome!');
  return true;
}

module.exports = { captcha, captchamode, captchaJoinHandler, captchaCallback };
