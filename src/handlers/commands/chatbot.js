'use strict';

/**
 * AI chatbot handler + group on/off controls.
 *
 *  DM     : always ON, smooth free chat.
 *  Groups : OFF by default — admins turn it on with `/chatbot on`.
 *           When ON it replies to a mention, a reply to the bot, or its name.
 */

const { getSofiyaReply, clearMemory, detectMood } = require('../../services/chatbotService');
const stickerReply = require('../../utils/stickerReply');
const { logChatbot } = require('../../services/loggingService');
const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { safeReply } = require('../../utils/helpers');
const logger = require('../../utils/logger');
const config = require('../../config/index');

const NAME_TRIGGER = new RegExp(`\\b(${(config.botName || 'Sofiya')}|sofiya|sofiya)\\b`, 'i');

async function isChatbotOn(chatId) {
  try {
    const g = await getGroup(chatId);
    return !!g?.chatbot?.enabled;
  } catch (e) {
    logger.warn(`chatbot setting read failed: ${e.message}`);
    return false;
  }
}

// ── /chatbot on|off|status ────────────────────────────────────────────────────

const chatbotCommand = async (ctx) => {
  const arg = (ctx.message?.text || '').split(/\s+/)[1]?.toLowerCase();

  if (ctx.chat?.type === 'private') {
    return safeReply(ctx, '💬 DM me chatbot hamesha ON rehta hai — bas message bhejo!\n\n<i>Group me use karne ke liye wahan</i> <code>/chatbot on</code> <i>likho.</i>');
  }

  if (!arg || !['on', 'off', 'status'].includes(arg)) {
    const on = await isChatbotOn(ctx.chat.id);
    return safeReply(ctx,
      `🤖 <b>AI Chatbot</b>: ${on ? '✅ ON' : '❌ OFF'}\n\n` +
      `<code>/chatbot on</code> — enable in this group\n` +
      `<code>/chatbot off</code> — disable in this group\n` +
      `<code>/resetmemory</code> — forget your saved chat memory`);
  }

  if (arg === 'status') {
    const on = await isChatbotOn(ctx.chat.id);
    return safeReply(ctx, `🤖 AI Chatbot is currently <b>${on ? 'ON ✅' : 'OFF ❌'}</b> here.`);
  }

  if (!ctx.isAdmin && !ctx.isOwner) {
    return safeReply(ctx, '🚫 Sirf group admins chatbot on/off kar sakte hain.');
  }

  const enabled = arg === 'on';
  await updateGroup(ctx.chat.id, { 'chatbot.enabled': enabled });
  return safeReply(ctx, enabled
    ? '✅ AI Chatbot <b>ON</b>! Mujhe reply karo ya naam lo, main baat karungi 🌸'
    : '❌ AI Chatbot <b>OFF</b>. Group me main chup rahungi.');
};

const resetMemory = async (ctx) => {
  await clearMemory(ctx.from.id, ctx.chat.id);
  return safeReply(ctx, '🧹 Aapki chat memory clear kar di. Fresh start! 🌸');
};

// ── message middleware ────────────────────────────────────────────────────────

async function chatbotHandler(ctx, next) {
  const text = ctx.message?.text || ctx.message?.caption;
  if (!text || text.startsWith('/')) return next ? next() : null;
  if (!ctx.from || ctx.from.is_bot) return next ? next() : null;

  const isPM = ctx.chat?.type === 'private';

  if (!isPM) {
    if (!(await isChatbotOn(ctx.chat.id))) return next ? next() : null;

    const replyToBot = ctx.message.reply_to_message?.from?.id === ctx.botInfo?.id;
    const mentionsMe = NAME_TRIGGER.test(text)
      || (ctx.botInfo?.username && new RegExp(`@${ctx.botInfo.username}\\b`, 'i').test(text));

    if (!replyToBot && !mentionsMe) return next ? next() : null;
  }

  try {
    await ctx.sendChatAction('typing').catch(() => {});
    const reply = await getSofiyaReply(ctx.from.id, ctx.chat.id, text, {
      isPrivate: isPM,
      from: ctx.from,
    });

    if (reply) {
      // Human-like typing pause: short messages land fast, longer ones take
      // a beat, capped so the chat never feels laggy.
      const think = Math.min(2200, 350 + String(reply).length * 18);
      await ctx.sendChatAction('typing').catch(() => {});
      await new Promise((r) => setTimeout(r, think));

      await ctx.reply(reply, {
        reply_to_message_id: ctx.message.message_id,
        allow_sending_without_reply: true,
        parse_mode: 'HTML',
      });

      // Like a real girl chats: sometimes a sticker follows the text.
      // Not every message, and matched to the mood of the conversation.
      if (stickerReply.isConfigured()) {
        await stickerReply.init(ctx.telegram); // loads packs once, then cached
        const detected = detectMood(text);
        const mood = detected === 'romantic' ? 'love' : detected;
        if (stickerReply.shouldSendSticker(mood)) {
          const stickerId = stickerReply.pickSticker(mood);
          if (stickerId) {
            await new Promise((r) => setTimeout(r, 400 + Math.random() * 800));
            await ctx.sendSticker(stickerId).catch((e) =>
              logger.warn(`sticker send failed: ${e.message}`));
          }
        }
      }

      logChatbot(ctx, reply).catch(() => {});
    }
  } catch (e) {
    logger.warn(`chatbot error: ${e.message}`);
  }

  return next ? next() : null;
}

module.exports = chatbotHandler;
module.exports.chatbotHandler = chatbotHandler;
module.exports.chatbotCommand = chatbotCommand;
module.exports.resetMemory = resetMemory;
module.exports.isChatbotOn = isChatbotOn;
