/**
 * Sofiya Bot — Global Activity Logger
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends all bot activity to the configured logger group using Telegram's
 * expandable <blockquote> HTML tag for a clean, sequential, folded look.
 *
 * Every event message has:
 *   • Icon + bold title header (outside quote — always visible)
 *   • expandable <blockquote> block with details — chat, actor, target, reason, time
 */

const { getLoggerGroupId } = require('../utils/botSettings');
const logger = require('../utils/logger');
const { emoji } = require('../utils/premiumEmoji');

let _bot = null;
function init(bot) { _bot = bot; }
const inviteCache = new Map();

// ─── icon map ─────────────────────────────────────────────────────────────────

const ICONS = {
  ban: 'danger', unban: 'success', kick: 'danger', mute: 'danger',
  unmute: 'success', warn: 'warning', warn_limit: 'danger',
  warn_remove: 'danger', warn_reset: 'primary', nsfw: 'danger',
  flood: 'warning', blacklist: 'danger', link_removed: 'warning',
  join: 'join', leave: 'leave', promote: 'success', demote: 'warning',
  note: 'note', filter: 'search', pin: 'pin', unpin: 'pin',
  lock: 'lock', unlock: 'success', captcha_fail: 'danger',
  captcha_pass: 'success', raid: 'danger', fed_ban: 'danger',
  bot_ban: 'danger', kill: 'danger', rob: 'money', protect: 'protect',
  broadcast: 'primary', sudo_add: 'success', sudo_remove: 'danger',
  coins_give: 'money', coins_take: 'danger', setlog: 'primary',
  connection: 'primary', topic: 'primary', purge: 'danger',
  delete_msg: 'danger', clean: 'primary', chatbot: 'bot',
  daily: 'success', weekly: 'primary', leaderboard: 'success',
  approval: 'success', unapproval: 'danger', rules: 'primary',
  start: 'start', help: 'primary', info: 'primary', error: 'danger',
  stats: 'primary', bot_added: 'join', bot_removed: 'leave',
  nsfw_toggle: 'protect', game: 'success',
  ddos_alert: 'danger', ddos_toggle: 'protect', ddos_warning: 'warning',
};

function icon(type) {
  return emoji(ICONS[type] || 'primary');
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function esc(t) {
  return String(t || '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function userLink(u) {
  if (!u) return '—';
  const name = esc([u.first_name, u.last_name].filter(Boolean).join(' ') || u.id);
  const username = u.username ? ` @${esc(u.username)}` : '';
  return `<b><a href="tg://user?id=${u.id}">${name}</a></b>${username} (<code>${u.id}</code>)`;
}

function chatName(c) {
  if (!c) return '—';
  return `<b>${esc(c.title || c.id)}</b> (<code>${c.id}</code>)`;
}

function now() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  }) + ' IST';
}

function chatLink(c, inviteLink) {
  if (!c) return '—';
  if (c.username) return `<a href="https://t.me/${esc(c.username)}">https://t.me/${esc(c.username)}</a>`;
  if (inviteLink) return `<a href="${esc(inviteLink)}">${esc(inviteLink)}</a>`;
  return '<i>Private chat (invite link unavailable)</i>';
}

async function resolveInviteLink(chat) {
  if (!_bot || !chat || chat.type === 'private') return null;
  if (inviteCache.has(chat.id)) return inviteCache.get(chat.id);
  try {
    const info = await _bot.telegram.getChat(chat.id);
    if (info.username) {
      const link = `https://t.me/${info.username}`;
      inviteCache.set(chat.id, link);
      return link;
    }
    const invite = await _bot.telegram.createChatInviteLink(chat.id, { name: 'Sofiya logger' });
    const link = invite?.invite_link || null;
    if (link) inviteCache.set(chat.id, link);
    return link;
  } catch {
    return null;
  }
}

async function actorAdmin(chat, actor) {
  if (!chat || !actor || chat.type === 'private' || !_bot) return false;
  try {
    const member = await _bot.telegram.getChatMember(chat.id, actor.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch {
    return false;
  }
}

// ─── core send ────────────────────────────────────────────────────────────────

async function _send(html) {
  const groupId = await getLoggerGroupId();
  if (!groupId || !_bot) return;
  try {
    await _bot.telegram.sendMessage(groupId, html, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (e) {
    logger.warn(`Logger send error: ${e.message}`);
  }
}

// ─── build a fancy expandable/folded log message ──────────────────────────────
//
//  Header (outside quote, always visible):
//    🔨 <b>BAN</b>  •  GroupName
//
//  <blockquote>
//    👤 By:  …
//    🎯 On:  …
//    📝 Reason: …
//    ⏳ Duration: …
//    💰 Amount: …
//    📎 Extra: …
//    🕐 12:30:45 IST
//  </blockquote>

async function logEvent(type, data = {}) {
  const ic   = icon(type);
  const title = ({
    join: 'ADD',
    leave: 'REMOVE',
    bot_added: 'ADD BOT',
    bot_removed: 'REMOVE BOT',
    start: 'START',
  })[type] || type.toUpperCase().replace(/_/g, ' ');
  const prefix = ['join', 'leave', 'bot_added', 'bot_removed', 'add', 'remove'].includes(type)
    ? '# '
    : type === 'start' ? '$ ' : '';

  const headerChat = data.chat ? `  •  ${esc(data.chat.title || data.chat.id)}` : '';
  const header = `${prefix}${ic ? `${ic} ` : ''}<b>${title}</b>${headerChat}`;

  const rows = [];
  if (data.chat)     rows.push(`<b>Chat:</b> ${chatName(data.chat)}`);
  if (data.actor)    rows.push(`<b>By:</b> ${userLink(data.actor)}`);
  if (data.actorAdmin != null) rows.push(`<b>Actor admin:</b> ${data.actorAdmin ? 'YES' : 'NO'}`);
  if (data.target)   rows.push(`<b>On:</b> ${userLink(data.target)}`);
  if (data.chatUrl)  rows.push(`<b>Chat link:</b> ${data.chatUrl}`);
  if (data.reason)   rows.push(`<b>Reason:</b> ${esc(data.reason)}`);
  if (data.duration) rows.push(`<b>Duration:</b> <code>${esc(data.duration)}</code>`);
  if (data.amount != null) rows.push(`<b>Amount:</b> <b>${esc(String(data.amount))}</b>`);
  if (data.chatLog) {
    rows.push(`<b>User:</b> ${userLink(data.actor)}`);
    rows.push(`<b>Message:</b> ${esc(data.chatLog.message)}`);
    rows.push(`<b>Reply:</b> ${esc(data.chatLog.reply)}`);
  }
  if (data.extra)    rows.push(`<b>Extra:</b> ${esc(String(data.extra))}`);
  rows.push(`<i>Time: ${now()}</i>`);

  const html = `${header}\n<blockquote expandable>${rows.join('\n')}</blockquote>`;
  await _send(html);
}

// ─── specialised log helpers (used directly by handlers) ──────────────────────

async function logCommand(type, ctx, extra = {}) {
  await logEvent(type, {
    chat:   ctx.chat,
    actor:  ctx.from,
    target: extra.target,
    reason: extra.reason,
    duration: extra.duration,
    amount: extra.amount,
    extra:  extra.note,
  });
}

async function logMemberEvent(type, ctx, target, extra = {}) {
  const chat = ctx.chat;
  const inviteLink = extra.chatUrl || await resolveInviteLink(chat);
  const admin = extra.actorAdmin != null ? extra.actorAdmin : await actorAdmin(chat, ctx.from);
  return logEvent(type, {
    chat,
    actor: ctx.from,
    target,
    actorAdmin: admin,
    chatUrl: chatLink(chat, inviteLink),
    extra: extra.note || (target?.username ? `@${target.username}` : ''),
  });
}

async function logNsfw(ctx, reason) {
  await logEvent('nsfw', {
    chat:   ctx.chat,
    target: ctx.from,
    reason: `Prohibited ${reason} content removed`,
  });
}

async function logLinkRemoved(ctx) {
  await logEvent('link_removed', {
    chat:   ctx.chat,
    target: ctx.from,
    reason: 'Sent a link — link protection is ON',
  });
}

async function logChatbot(ctx, reply) {
  await logEvent('chatbot', {
    chat:  ctx.chat,
    actor: ctx.from,
    chatLog: {
      message: `${String(ctx.message?.text || '').slice(0, 500)}${String(ctx.message?.text || '').length > 500 ? '…' : ''}`,
      reply: `${String(reply).slice(0, 500)}${String(reply).length > 500 ? '…' : ''}`,
    },
  });
}

async function logError(error, ctx, extra = '') {
  const message = error?.message || String(error);
  const stack = String(error?.stack || '').slice(0, 1200);
  return logEvent('error', {
    chat: ctx?.chat,
    actor: ctx?.from,
    reason: message,
    extra: [extra, stack].filter(Boolean).join('\n'),
  });
}

// backward-compat stub
function logModeration(chatId, userId, action, reason) {
  logger.info(`[MOD] Chat:${chatId} User:${userId} Action:${action} Reason:${reason}`);
}

module.exports = {
  init,
  logEvent,
  logCommand,
  logMemberEvent,
  logNsfw,
  logLinkRemoved,
  logChatbot,
  logError,
  logModeration,
};
