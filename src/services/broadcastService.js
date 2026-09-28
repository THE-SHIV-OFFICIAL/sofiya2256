'use strict';

/**
 * Broadcast engine — sends to BOTH users (DM) and groups.
 *
 *  • Text broadcast  : /broadcast <message>
 *  • Media broadcast : reply to any message (photo/video/sticker/doc/audio) + /broadcast
 *  • Flags           : -users  -groups  -all  -pin  -forward  -silent
 *
 * Reliability:
 *  • Batched sending with concurrency + delay (Telegram friendly)
 *  • 429 flood-wait handling with automatic retry
 *  • Auto-cleanup: blocked users / deleted chats are flagged so future
 *    broadcasts skip them (this is what made the old one look "dead")
 */

const { User, Group } = require('../models');
const logger = require('../utils/logger');

const CONCURRENCY = 15;
const BATCH_DELAY = 350;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseFlags(raw) {
  const flags = { users: false, groups: false, pin: false, forward: false, silent: false };
  const words = [];
  for (const w of String(raw || '').split(/\s+/)) {
    const f = w.toLowerCase();
    if (f === '-users' || f === '-u') flags.users = true;
    else if (f === '-groups' || f === '-g') flags.groups = true;
    else if (f === '-all' || f === '-a') { flags.users = true; flags.groups = true; }
    else if (f === '-pin' || f === '-p') flags.pin = true;
    else if (f === '-forward' || f === '-f') flags.forward = true;
    else if (f === '-silent' || f === '-s') flags.silent = true;
    else if (w) words.push(w);
  }
  if (!flags.users && !flags.groups) { flags.users = true; flags.groups = true; }
  return { flags, text: words.join(' ').trim() };
}

async function collectTargets(flags) {
  const targets = [];
  if (flags.groups) {
    const groups = await Group.find({ active: { $ne: false } }, { chatId: 1 }).lean();
    for (const g of groups) targets.push({ id: g.chatId, kind: 'group' });
  }
  if (flags.users) {
    const users = await User.find(
      { canDm: true, dmBlocked: { $ne: true }, isBanned: { $ne: true } },
      { userId: 1 }
    ).lean();
    for (const u of users) targets.push({ id: u.userId, kind: 'user' });
  }
  return targets;
}

function deadError(msg) {
  const m = String(msg || '').toLowerCase();
  return (
    m.includes('bot was blocked') ||
    m.includes('user is deactivated') ||
    m.includes('chat not found') ||
    m.includes('bot was kicked') ||
    m.includes('group chat was upgraded') ||
    m.includes('peer_id_invalid') ||
    m.includes("bot can't initiate conversation") ||
    m.includes('forbidden')
  );
}

async function markDead(target) {
  try {
    if (target.kind === 'user') await User.updateOne({ userId: target.id }, { $set: { dmBlocked: true } });
    else await Group.updateOne({ chatId: target.id }, { $set: { active: false } });
  } catch {}
}

async function deliver(ctx, target, payload, flags) {
  const opts = { disable_notification: !!flags.silent };
  let sent;

  if (payload.mode === 'forward') {
    sent = await ctx.telegram.forwardMessage(target.id, payload.fromChatId, payload.messageId, opts);
  } else if (payload.mode === 'copy') {
    sent = await ctx.telegram.copyMessage(target.id, payload.fromChatId, payload.messageId, opts);
  } else {
    sent = await ctx.telegram.sendMessage(target.id, payload.html, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...opts,
    });
  }

  if (flags.pin && sent?.message_id) {
    try { await ctx.telegram.pinChatMessage(target.id, sent.message_id, { disable_notification: true }); } catch {}
  }
  return sent;
}

async function sendOne(ctx, target, payload, flags, stats, attempt = 0) {
  try {
    await deliver(ctx, target, payload, flags);
    stats.ok++;
    stats[target.kind === 'user' ? 'users' : 'groups']++;
  } catch (e) {
    const retryAfter =
      e?.parameters?.retry_after ||
      e?.response?.parameters?.retry_after ||
      (e?.code === 429 ? 3 : 0);

    if (retryAfter && attempt < 2) {
      await sleep((retryAfter + 1) * 1000);
      return sendOne(ctx, target, payload, flags, stats, attempt + 1);
    }

    const msg = e?.description || e?.message || '';
    if (deadError(msg)) {
      stats.removed++;
      await markDead(target);
    }
    stats.fail++;
    logger.warn(`broadcast → ${target.kind} ${target.id} failed: ${String(msg).slice(0, 120)}`);
  }
}

/**
 * @param {object} ctx      Telegraf context of the owner/sudo issuing the command
 * @param {object} payload  { mode: 'text'|'copy'|'forward', html?, fromChatId?, messageId? }
 * @param {object} flags    parsed flags
 * @param {function} onProgress  optional (stats, total) => void
 */
async function run(ctx, payload, flags, onProgress) {
  const targets = await collectTargets(flags);
  const stats = { ok: 0, fail: 0, removed: 0, users: 0, groups: 0, total: targets.length };
  if (!targets.length) return stats;

  let lastTick = 0;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((t) => sendOne(ctx, t, payload, flags, stats)));

    if (onProgress && Date.now() - lastTick > 4000) {
      lastTick = Date.now();
      try { await onProgress(stats, targets.length); } catch {}
    }
    if (i + CONCURRENCY < targets.length) await sleep(BATCH_DELAY);
  }
  return stats;
}

async function counts() {
  const [groups, users, blocked, deadGroups] = await Promise.all([
    Group.countDocuments({ active: { $ne: false } }),
    User.countDocuments({ canDm: true, dmBlocked: { $ne: true } }),
    User.countDocuments({ dmBlocked: true }),
    Group.countDocuments({ active: false }),
  ]);
  return { groups, users, blocked, deadGroups };
}

module.exports = { run, parseFlags, counts };
