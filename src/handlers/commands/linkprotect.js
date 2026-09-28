/**
 * Link Protection
 * ─────────────────────────────────────────────────────────────────────────────
 * When enabled in a group, any message from a non-admin member that contains
 * a URL or Telegram link is deleted and the sender gets a warning message.
 *
 * Commands:
 *   /linkprotect on   — enable
 *   /linkprotect off  — disable
 *   /linkprotect      — show current status
 */

const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { safeReply } = require('../../utils/helpers');
const { logLinkRemoved } = require('../../services/loggingService');

// Matches http/https links, bare www. links, and t.me invite/profile links
const LINK_REGEX = /(?:https?:\/\/|www\.)[^\s<>]+|t\.me\/[^\s<>]+/i;

// ─── toggle command ──────────────────────────────────────────────────────────

const linkprotect = async (ctx) => {
  if (!ctx.isAdmin) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Admins only.', { parse_mode: 'HTML' });
  if (ctx.chat?.type === 'private') return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Only usable in groups.', { parse_mode: 'HTML' });

  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  const group = await getGroup(ctx.chat.id);

  if (!arg) {
    return safeReply(ctx,
      `<tg-emoji emoji-id="5350396951407895212">⚙️</tg-emoji> <b>Link Protection</b>\n\n` +
      `Current status: <b>${group.linkProtection ? '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> ON' : '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> OFF'}</b>\n\n` +
      `<code>/linkprotect on</code>  — delete links sent by members\n` +
      `<code>/linkprotect off</code> — allow links`,
      { parse_mode: 'HTML' }
    );
  }

  if (arg === 'on') {
    await updateGroup(ctx.chat.id, { linkProtection: true });
    return safeReply(ctx,
      `<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> <b>Link Protection: ON</b>\n` +
      `Any link sent by a non-admin will be automatically removed.`,
      { parse_mode: 'HTML' }
    );
  }

  if (arg === 'off') {
    await updateGroup(ctx.chat.id, { linkProtection: false });
    return safeReply(ctx, `<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> <b>Link Protection: OFF</b>\nMembers may now share links freely.`, { parse_mode: 'HTML' });
  }

  return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Usage: <code>/linkprotect on</code> or <code>/linkprotect off</code>', { parse_mode: 'HTML' });
};

// ─── middleware ──────────────────────────────────────────────────────────────

const linkProtectMiddleware = async (ctx, next) => {
  if (!ctx.message || !ctx.chat || ctx.chat.type === 'private') return next();
  if (ctx.from?.is_bot) return next();

  const text = ctx.message.text || ctx.message.caption || '';
  if (!text || !LINK_REGEX.test(text)) return next();

  // Admins and the bot itself are exempt
  if (ctx.isAdmin) return next();

  let group;
  try { group = await getGroup(ctx.chat.id); } catch { return next(); }
  if (!group.linkProtection) return next();

  // Check approved members (use Approval model if available)
  let isApproved = false;
  try {
    const Approval = require('../../models/Approval');
    const appr = await Approval.findOne({ chatId: ctx.chat.id, userId: ctx.from.id });
    if (appr) isApproved = true;
  } catch {}
  if (isApproved) return next();

  // Delete the offending message and log it
  try { await ctx.deleteMessage(); } catch {}
  logLinkRemoved(ctx).catch(() => {});

  const userTag = ctx.from.first_name
    ? `<a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>`
    : 'User';

  try {
    const warn = await ctx.reply(
      `<tg-emoji emoji-id="6267262260243076354">🛑</tg-emoji> <b>Links Not Allowed!</b>\n` +
      `${userTag}, promotions and links are not permitted in this group.\n` +
      `<i>Your message has been removed.</i>`,
      { parse_mode: 'HTML' }
    );
    // Auto-delete the warning after 10 seconds to keep chat clean
    setTimeout(async () => {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, warn.message_id); } catch {}
    }, 10_000);
  } catch {}

  // Stop further middleware so the message isn't processed further
};

module.exports = { linkprotect, linkProtectMiddleware };
