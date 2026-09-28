'use strict';

const { logMemberEvent } = require('../services/loggingService');
const logger = require('../utils/logger');

// Telegram can emit both a chat_member update and a service message for the
// same action. Keep a short-lived dedupe window so the logger stays readable.
const recent = new Map();
const DEDUPE_MS = 15_000;

function shouldLog(chatId, userId, action) {
  const key = `${chatId}:${userId}:${action}`;
  const last = recent.get(key) || 0;
  const now = Date.now();
  recent.set(key, now);
  if (recent.size > 5000) {
    for (const [k, at] of recent) {
      if (at < now - DEDUPE_MS) recent.delete(k);
    }
  }
  return now - last > DEDUPE_MS;
}

function isMember(status) {
  return ['member', 'administrator', 'creator', 'restricted'].includes(status);
}

async function logTransition(ctx, action, target, note = '') {
  if (!ctx.chat || !target || !shouldLog(ctx.chat.id, target.id, action)) return;
  try {
    await logMemberEvent(action, ctx, target, { note });
  } catch (error) {
    logger.warn(`member activity log failed: ${error.message}`);
  }
}

async function chatMemberHandler(ctx, next) {
  const update = ctx.update?.chat_member;
  if (update?.chat && update.new_chat_member?.user) {
    const oldStatus = update.old_chat_member?.status;
    const newStatus = update.new_chat_member.status;
    if (!isMember(oldStatus) && isMember(newStatus)) {
      await logTransition(ctx, 'join', update.new_chat_member.user, 'Member added');
    } else if (isMember(oldStatus) && ['left', 'kicked'].includes(newStatus)) {
      await logTransition(ctx, 'leave', update.new_chat_member.user, `Member ${newStatus}`);
    }
  }
  return next();
}

async function serviceMessageHandler(ctx, next) {
  const message = ctx.message;
  if (message?.new_chat_members?.length) {
    for (const user of message.new_chat_members) {
      if (user.id === ctx.botInfo?.id) continue;
      await logTransition(ctx, 'join', user, 'Service message: member added');
    }
  }
  if (message?.left_chat_member) {
    if (message.left_chat_member.id === ctx.botInfo?.id) return next();
    await logTransition(ctx, 'leave', message.left_chat_member, 'Service message: member left/removed');
  }
  return next();
}

async function botStatusHandler(ctx, next) {
  const update = ctx.update?.my_chat_member;
  if (update?.chat && update.new_chat_member?.user?.id === ctx.botInfo?.id) {
    const oldStatus = update.old_chat_member?.status;
    const newStatus = update.new_chat_member.status;
    if (!isMember(oldStatus) && isMember(newStatus)) {
      await logTransition(ctx, 'bot_added', update.new_chat_member.user, 'Sofiya was added to the chat');
    } else if (isMember(oldStatus) && ['left', 'kicked'].includes(newStatus)) {
      await logTransition(ctx, 'bot_removed', update.new_chat_member.user, `Sofiya was ${newStatus}`);
    }
  }
  return next();
}

module.exports = { chatMemberHandler, serviceMessageHandler, botStatusHandler };