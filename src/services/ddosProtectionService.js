'use strict';

/**
 * Behavioural DDoS protection for Telegram groups.
 *
 * Telegram does not expose network/IP information to bots, so this protects
 * the part a bot can actually control: message bursts, mass joins and mass
 * voice-chat invitations. Suspicious users are contained, the group can be
 * briefly locked for new messages, and every alert is sent privately to the
 * group admins and creator.
 */

const config = require('../config/index');
const { getGroup } = require('../utils/groupSettings');
const { escapeHtml } = require('../utils/helpers');
const { logEvent } = require('./loggingService');
const logger = require('../utils/logger');

const windows = new Map();
const alertCache = new Map();
const lockdowns = new Map();
const warningState = new Map();

const DEFAULTS = {
  windowMs: 10_000,
  messageLimit: 14,
  groupLimit: 45,
  uniqueLimit: 8,
  joinWindowMs: 30_000,
  joinLimit: 8,
  vcWindowMs: 20_000,
  vcInviteLimit: 5,
  warningLimit: 3,
  actionSeconds: 300,
  lockdownSeconds: 60,
  warningWindowMs: 15 * 60_000,
  warningCooldownMs: 10_000,
};

function stateFor(chatId) {
  let state = windows.get(chatId);
  if (!state) {
    state = { messages: [], joins: [], vcInvites: [] };
    windows.set(chatId, state);
  }
  return state;
}

function prune(list, cutoff) {
  while (list.length && list[0].at < cutoff) list.shift();
}

function compactState(chatId) {
  const state = windows.get(chatId);
  if (!state) return;
  const now = Date.now();
  prune(state.messages, now - DEFAULTS.windowMs * 2);
  prune(state.joins, now - DEFAULTS.joinWindowMs * 2);
  prune(state.vcInvites, now - DEFAULTS.vcWindowMs * 2);
  if (!state.messages.length && !state.joins.length && !state.vcInvites.length) {
    windows.delete(chatId);
  }
}

function messageSignature(message) {
  const text = message?.text || message?.caption || '';
  if (text) return text.trim().toLowerCase().slice(0, 160);
  if (message?.sticker) return `sticker:${message.sticker.file_unique_id || message.sticker.file_id}`;
  if (message?.photo) return `photo:${message.photo.at(-1)?.file_unique_id || ''}`;
  if (message?.animation) return `animation:${message.animation.file_unique_id || ''}`;
  if (message?.video) return `video:${message.video.file_unique_id || ''}`;
  return message?.message_id ? `message:${message.message_id}` : 'media';
}

function rememberMessage(chatId, userId, message) {
  const state = stateFor(chatId);
  const now = Date.now();
  prune(state.messages, now - DEFAULTS.windowMs);
  state.messages.push({
    at: now,
    userId,
    messageId: message.message_id,
    signature: messageSignature(message),
  });
  const userMessages = state.messages.filter((item) => item.userId === userId);
  const signature = state.messages.at(-1).signature;
  const sameMessages = state.messages.filter((item) => item.userId === userId && item.signature === signature);
  const uniqueUsers = new Set(state.messages.map((item) => item.userId)).size;
  return {
    userCount: userMessages.length,
    sameCount: sameMessages.length,
    groupCount: state.messages.length,
    uniqueUsers,
    messageIds: userMessages.map((item) => item.messageId).filter(Boolean).slice(-25),
  };
}

function rememberJoin(chatId, users) {
  const state = stateFor(chatId);
  const now = Date.now();
  prune(state.joins, now - DEFAULTS.joinWindowMs);
  for (const user of users) state.joins.push({ at: now, userId: user.id });
  return state.joins.length;
}

function rememberVcInvites(chatId, users) {
  const state = stateFor(chatId);
  const now = Date.now();
  prune(state.vcInvites, now - DEFAULTS.vcWindowMs);
  for (const user of users) state.vcInvites.push({ at: now, userId: user.id });
  return state.vcInvites.length;
}

function isProtectedActor(ctx, userId) {
  return !userId || userId === ctx.botInfo?.id || userId === config.ownerId
    || (ctx.isAdmin && userId === ctx.from?.id);
}

function userLabel(user) {
  if (!user) return 'Unknown user';
  const name = escapeHtml([user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.id);
  return `<b><a href="tg://user?id=${user.id}">${name}</a></b>${user.username ? ` (@${escapeHtml(user.username)})` : ''}`;
}

function chatLabel(chat) {
  const name = escapeHtml(chat?.title || chat?.id || 'Group');
  const link = chat?.username ? `https://t.me/${escapeHtml(chat.username)}` : '';
  return link ? `<a href="${link}"><b>${name}</b></a>` : `<b>${name}</b>`;
}

function canAlert(key) {
  const last = alertCache.get(key) || 0;
  if (Date.now() - last < 60_000) return false;
  alertCache.set(key, Date.now());
  if (alertCache.size > 5000) {
    for (const [cacheKey, at] of alertCache) {
      if (Date.now() - at > 120_000) alertCache.delete(cacheKey);
    }
  }
  return true;
}

function warningFor(chatId, userId) {
  const key = `${chatId}:${userId}`;
  const now = Date.now();
  const previous = warningState.get(key);
  if (!previous || now - previous.firstAt > DEFAULTS.warningWindowMs) {
    const current = { count: 0, firstAt: now, lastAt: 0 };
    warningState.set(key, current);
    if (warningState.size > 5000) {
      for (const [warningKey, value] of warningState) {
        if (now - value.lastAt > DEFAULTS.warningWindowMs * 2) warningState.delete(warningKey);
      }
    }
    return current;
  }
  return previous;
}

async function alertAdmins(
  ctx,
  reason,
  details,
  action = 'automatic protection applied',
  alertKey = reason,
  subject = null
) {
  const chat = ctx.chat;
  const key = `${chat?.id}:${alertKey}`;
  if (!chat || !canAlert(key)) return;

  let admins = [];
  try {
    admins = await ctx.telegram.getChatAdministrators(chat.id);
  } catch (error) {
    logger.warn(`DDoS admin lookup failed: ${error.message}`);
  }

  const recipients = new Set(
    admins
      .map((member) => member.user)
      .filter((user) => user && !user.is_bot)
      .map((user) => user.id)
  );
  if (config.ownerId) recipients.add(config.ownerId);

  const body =
    `<b>⚠️ DDoS protection alert</b>\n` +
    `<blockquote expandable>` +
    `<b>Group:</b> ${chatLabel(chat)}\n` +
    `<b>Reason:</b> ${escapeHtml(reason)}\n` +
    `${details || ''}\n` +
    `<b>Action:</b> ${escapeHtml(action)}\n` +
    `<i>Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</i>` +
    `</blockquote>`;

  await Promise.allSettled([...recipients].map((userId) =>
    ctx.telegram.sendMessage(userId, body, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })
  ));

  logEvent('ddos_alert', {
    chat,
    actor: ctx.from,
    target: subject,
    reason,
    extra: details ? details.replace(/<[^>]+>/g, '') : 'Automatic protection applied',
  }).catch(() => {});
}

async function deleteMessages(ctx, messageIds) {
  const ids = [...new Set(messageIds)].filter(Boolean).slice(-25);
  if (!ids.length) return;
  try {
    if (typeof ctx.telegram.deleteMessages === 'function') {
      await ctx.telegram.deleteMessages(ctx.chat.id, ids);
      return;
    }
  } catch {}
  await Promise.allSettled(ids.map((messageId) =>
    ctx.telegram.deleteMessage(ctx.chat.id, messageId)
  ));
}

async function containUser(ctx, user, reason, messageIds = [], notify = true) {
  if (!user || isProtectedActor(ctx, user.id)) return false;
  try {
    await ctx.telegram.restrictChatMember(ctx.chat.id, user.id, {
      permissions: {
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
      },
      until_date: Math.floor(Date.now() / 1000) + DEFAULTS.actionSeconds,
    });
  } catch (error) {
    logger.warn(`DDoS user restriction failed: ${error.message}`);
  }
  await deleteMessages(ctx, messageIds);
  if (notify) {
    await alertAdmins(
      ctx,
      reason,
      `<b>User:</b> ${userLabel(user)}\n<b>Group ID:</b> <code>${ctx.chat.id}</code>\n` +
      `<b>Duration:</b> ${DEFAULTS.actionSeconds / 60} minutes`,
      `User muted for ${DEFAULTS.actionSeconds / 60} minutes`,
      `${reason}:${user.id}`,
      user
    );
  }
  return true;
}

async function warnSuspiciousUser(ctx, user, reason, messageIds = []) {
  if (!user || isProtectedActor(ctx, user.id)) return false;
  const state = warningFor(ctx.chat.id, user.id);
  const now = Date.now();
  if (now - state.lastAt < DEFAULTS.warningCooldownMs) return false;

  state.count += 1;
  state.lastAt = now;
  await deleteMessages(ctx, messageIds);

  const warningText =
    `<b>⚠️ DDoS protection warning ${state.count}/${DEFAULTS.warningLimit}</b>\n` +
    `${userLabel(user)}, suspicious activity detected.\n` +
    `<i>Warning ${state.count} of ${DEFAULTS.warningLimit}. After the third warning, you will be muted for 5 minutes. No ban will be applied.</i>`;
  try {
    await ctx.telegram.sendMessage(ctx.chat.id, warningText, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch {}

  const groupInfo =
    `<b>User:</b> ${userLabel(user)}\n` +
    `<b>User ID:</b> <code>${user.id}</code>\n` +
    `<b>Group:</b> ${chatLabel(ctx.chat)}\n` +
    `<b>Group ID:</b> <code>${ctx.chat.id}</code>\n` +
    `<b>Warning:</b> ${state.count}/${DEFAULTS.warningLimit}`;

  if (state.count >= DEFAULTS.warningLimit) {
    await containUser(ctx, user, reason, [], false);
    await alertAdmins(
      ctx,
      reason,
      groupInfo,
      `Third warning reached — user muted for ${DEFAULTS.actionSeconds / 60} minutes`,
      `mute:${ctx.chat.id}:${user.id}`,
      user
    );
    warningState.delete(`${ctx.chat.id}:${user.id}`);
  } else {
    await alertAdmins(
      ctx,
      reason,
      groupInfo,
      `Warning ${state.count}/${DEFAULTS.warningLimit}; no mute yet`,
      `warning:${ctx.chat.id}:${user.id}:${state.count}`,
      user
    );
  }
  return true;
}

async function lockdownGroup(ctx, reason, detail) {
  const chatId = ctx.chat.id;
  const current = lockdowns.get(chatId);
  if (current?.until > Date.now()) return;

  let previous = null;
  try {
    const chat = await ctx.telegram.getChat(chatId);
    previous = chat.permissions || null;
    await ctx.telegram.setChatPermissions(chatId, {
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
    });
  } catch (error) {
    logger.warn(`DDoS group lockdown failed: ${error.message}`);
    return;
  }

  const until = Date.now() + DEFAULTS.lockdownSeconds * 1000;
  lockdowns.set(chatId, { until, previous });
  await alertAdmins(ctx, reason, `${detail || ''}\n<b>Group lockdown:</b> ${DEFAULTS.lockdownSeconds} seconds`);

  setTimeout(async () => {
    const lock = lockdowns.get(chatId);
    if (!lock || lock.until !== until) return;
    try {
      await ctx.telegram.setChatPermissions(chatId, lock.previous || {
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
      });
    } catch (error) {
      logger.warn(`DDoS group unlock failed: ${error.message}`);
    } finally {
      lockdowns.delete(chatId);
    }
  }, DEFAULTS.lockdownSeconds * 1000 + 1000).unref?.();
}

async function protectJoinBurst(ctx, users) {
  const count = rememberJoin(ctx.chat.id, users);
  const group = await getGroup(ctx.chat.id);
  const threshold = group.ddosProtection?.joinLimit || DEFAULTS.joinLimit;
  if (count < threshold) return;

  const activeUsers = users.filter((user) => !user.is_bot && !isProtectedActor(ctx, user.id));
  await Promise.allSettled(activeUsers.map((user) =>
    warnSuspiciousUser(ctx, user, 'Mass join burst detected', [])
  ));
  await alertAdmins(
    ctx,
    'Mass join burst detected',
    `<b>New members in window:</b> ${count}\n<b>Users warned:</b> ${activeUsers.length}\n` +
    `<b>Group ID:</b> <code>${ctx.chat.id}</code>`,
    `Mass join alert sent; users receive 3 warnings before a 5-minute mute`,
    `mass-join:${ctx.chat.id}`
  );
  await lockdownGroup(ctx, 'Mass join burst detected', `<b>New members:</b> ${count}`);
}

async function protectVoiceInviteBurst(ctx, invitedUsers) {
  const count = rememberVcInvites(ctx.chat.id, invitedUsers);
  const group = await getGroup(ctx.chat.id);
  const threshold = group.ddosProtection?.vcInviteLimit || DEFAULTS.vcInviteLimit;
  if (invitedUsers.length < threshold && count < threshold) return;

  await warnSuspiciousUser(
    ctx,
    ctx.from,
    'Voice-chat mass invite burst detected',
    [ctx.message?.message_id]
  );
  await alertAdmins(
    ctx,
    'Voice-chat mass invite burst detected',
    `<b>Invites in window:</b> ${count}\n<b>Invited users in update:</b> ${invitedUsers.length}\n` +
    `<b>Group ID:</b> <code>${ctx.chat.id}</code>\n` +
    `<i>Telegram Bot API cannot end a voice chat; the inviter receives 3 warnings before a 5-minute mute.</i>`,
    `VC mass-invite warning sent; no ban`,
    `vc-alert:${ctx.chat.id}`
  );
}

async function ddosMiddleware(ctx, next) {
  if (!ctx.message || !ctx.chat || ctx.chat.type === 'private' || ctx.from?.is_bot) return next();

  let group;
  try {
    group = await getGroup(ctx.chat.id);
  } catch {
    return next();
  }
  if (group.ddosProtection?.enabled !== true) return next();

  const invited = ctx.message.video_chat_participants_invited?.users || [];
  if (invited.length) await protectVoiceInviteBurst(ctx, invited);

  if (ctx.message.new_chat_members?.length) {
    await protectJoinBurst(ctx, ctx.message.new_chat_members);
  }

  if (!ctx.message.new_chat_members?.length && !invited.length && ctx.message.message_id) {
    const stats = rememberMessage(ctx.chat.id, ctx.from.id, ctx.message);
    const userLimit = group.ddosProtection?.messageLimit || DEFAULTS.messageLimit;
    const groupLimit = group.ddosProtection?.groupLimit || DEFAULTS.groupLimit;
    const userAttack = stats.userCount >= userLimit || stats.sameCount >= Math.max(6, Math.floor(userLimit / 2));
    const groupAttack = stats.groupCount >= groupLimit && stats.uniqueUsers >= DEFAULTS.uniqueLimit;

    if (userAttack && !isProtectedActor(ctx, ctx.from.id)) {
      await warnSuspiciousUser(
        ctx,
        ctx.from,
        'User message flood detected',
        stats.messageIds
      );
    }
    if (groupAttack) {
      await lockdownGroup(
        ctx,
        'Group-wide message burst detected',
        `<b>Messages:</b> ${stats.groupCount}\n<b>Active users:</b> ${stats.uniqueUsers}`
      );
    }
  }

  compactState(ctx.chat.id);
  return next();
}

async function chatMemberHandler(ctx, next) {
  const update = ctx.update?.chat_member;
  const member = update?.new_chat_member;
  const oldStatus = update?.old_chat_member?.status;
  const isNewMember = member?.user && !['member', 'administrator', 'creator', 'restricted'].includes(oldStatus)
    && ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
  if (isNewMember && update.chat && member.user.id !== ctx.botInfo?.id) {
    try {
      const group = await getGroup(update.chat.id);
      if (group.ddosProtection?.enabled === true) {
        await protectJoinBurst(ctx, [member.user]);
      }
    } catch (error) {
      logger.warn(`DDoS chat member check failed: ${error.message}`);
    }
  }
  return next();
}

function resetState() {
  windows.clear();
  alertCache.clear();
  lockdowns.clear();
  warningState.clear();
}

module.exports = {
  ddosMiddleware,
  chatMemberHandler,
  resetState,
  messageSignature,
};