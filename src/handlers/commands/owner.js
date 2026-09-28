const { requireOwner, requireSudo } = require('../../middleware/admin');
const { getSettings, invalidate } = require('../../utils/botSettings');
const { Wallet, Group } = require('../../models');
const { safeReply, mention, escapeHtml } = require('../../utils/helpers');
const { logEvent } = require('../../services/loggingService');
const config = require('../../config/index');
const broadcastService = require('../../services/broadcastService');

async function getW(userId) {
  let w = await Wallet.findOne({ userId });
  if (!w) w = await Wallet.create({ userId });
  return w;
}

// ─── Coin Management (Owner only) ──────────────────────────────────────────

const addcoins = requireOwner(async (ctx) => {
  const target = ctx.message.reply_to_message?.from;
  const args = (ctx.message.text || '').split(/\s+/).slice(1);
  const amount = parseInt(args[0], 10);
  if (!target || !amount || amount < 1)
    return safeReply(ctx, '❌ Reply to a user: <code>/addcoins &lt;amount&gt;</code>');
  const w = await getW(target.id);
  w.coins += amount;
  await w.save();
  await safeReply(ctx, `💵 Added <b>${amount}</b> coins to ${mention(target)}\nNew balance: <b>${w.coins}</b>`);
  await logEvent('coins_give', { actor: ctx.from, target, amount });
});

const removecoins = requireOwner(async (ctx) => {
  const target = ctx.message.reply_to_message?.from;
  const args = (ctx.message.text || '').split(/\s+/).slice(1);
  const amount = parseInt(args[0], 10);
  if (!target || !amount || amount < 1)
    return safeReply(ctx, '❌ Reply to a user: <code>/removecoins &lt;amount&gt;</code>');
  const w = await getW(target.id);
  w.coins = Math.max(0, w.coins - amount);
  await w.save();
  await safeReply(ctx, `💸 Removed <b>${amount}</b> coins from ${mention(target)}\nNew balance: <b>${w.coins}</b>`);
  await logEvent('coins_take', { actor: ctx.from, target, amount });
});

const setcoins = requireOwner(async (ctx) => {
  const target = ctx.message.reply_to_message?.from;
  const args = (ctx.message.text || '').split(/\s+/).slice(1);
  const amount = parseInt(args[0], 10);
  if (!target || isNaN(amount))
    return safeReply(ctx, '❌ Reply to a user: <code>/setcoins &lt;amount&gt;</code>');
  const w = await getW(target.id);
  w.coins = amount;
  await w.save();
  await safeReply(ctx, `💰 Set ${mention(target)}'s coins to <b>${amount}</b>`);
});

// ─── Bot Ban (Owner only) ──────────────────────────────────────────────────

const botban = requireOwner(async (ctx) => {
  const target = ctx.message.reply_to_message?.from;
  const reason = (ctx.message.text || '').split(/\s+/).slice(1).join(' ') || 'No reason';
  if (!target) return safeReply(ctx, '❌ Reply to the user to bot-ban.');
  if (target.id === config.ownerId) return safeReply(ctx, '❌ Cannot ban the owner.');
  const s = await getSettings();
  if (s.botBanned.some((b) => b.userId === target.id))
    return safeReply(ctx, `⚠️ ${mention(target)} is already bot-banned.`);
  s.botBanned.push({ userId: target.id, reason });
  await s.save();
  invalidate();
  try { await ctx.telegram.sendMessage(target.id, `⛔️ You have been <b>banned</b> from using this bot.\nReason: ${escapeHtml(reason)}`, { parse_mode: 'HTML' }); } catch {}
  await safeReply(ctx, `⛔️ ${mention(target)} has been <b>bot-banned</b>.\nReason: ${escapeHtml(reason)}`);
  await logEvent('bot_ban', { actor: ctx.from, target, reason });
});

const botunban = requireOwner(async (ctx) => {
  const target = ctx.message.reply_to_message?.from;
  if (!target) return safeReply(ctx, '❌ Reply to the user to unban.');
  const s = await getSettings();
  const before = s.botBanned.length;
  s.botBanned = s.botBanned.filter((b) => b.userId !== target.id);
  if (s.botBanned.length === before) return safeReply(ctx, `⚠️ ${mention(target)} is not bot-banned.`);
  await s.save();
  invalidate();
  try { await ctx.telegram.sendMessage(target.id, '✅ You have been <b>unbanned</b> from this bot. Welcome back!', { parse_mode: 'HTML' }); } catch {}
  await safeReply(ctx, `✅ ${mention(target)} has been <b>unbanned</b>.`);
  await logEvent('unban', { actor: ctx.from, target });
});

const botbanned = requireOwner(async (ctx) => {
  const s = await getSettings();
  if (!s.botBanned.length) return safeReply(ctx, '✅ No bot-banned users.');
  let txt = '⛔️ <b>Bot-Banned Users</b>\n\n';
  for (const b of s.botBanned) {
    txt += `• <code>${b.userId}</code> — ${escapeHtml(b.reason)} (<i>${b.bannedAt ? new Date(b.bannedAt).toDateString() : 'unknown'}</i>)\n`;
  }
  await safeReply(ctx, txt);
});

// ─── Sudo Management (Owner only) ─────────────────────────────────────────

const addsudo = requireOwner(async (ctx) => {
  const target = ctx.message.reply_to_message?.from;
  if (!target) return safeReply(ctx, '❌ Reply to the user to add as sudo.');
  if (target.id === config.ownerId) return safeReply(ctx, '👑 That is the owner — already has all powers.');
  const s = await getSettings();
  if (s.sudoUsers.includes(target.id)) return safeReply(ctx, `⚠️ ${mention(target)} is already a sudo user.`);
  s.sudoUsers.push(target.id);
  await s.save();
  invalidate();
  try { await ctx.telegram.sendMessage(target.id, '🔑 You have been granted <b>sudo access</b> to ѕσƒιуα Bot!', { parse_mode: 'HTML' }); } catch {}
  await safeReply(ctx, `🔑 ${mention(target)} added as <b>sudo user</b>.`);
  await logEvent('sudo_add', { actor: ctx.from, target });
});

const removesudo = requireOwner(async (ctx) => {
  const target = ctx.message.reply_to_message?.from;
  if (!target) return safeReply(ctx, '❌ Reply to the user to remove sudo.');
  const s = await getSettings();
  const before = s.sudoUsers.length;
  s.sudoUsers = s.sudoUsers.filter((id) => id !== target.id);
  if (s.sudoUsers.length === before) return safeReply(ctx, `⚠️ ${mention(target)} is not a sudo user.`);
  await s.save();
  invalidate();
  try { await ctx.telegram.sendMessage(target.id, '🔑 Your <b>sudo access</b> to ѕσƒιуα Bot has been removed.', { parse_mode: 'HTML' }); } catch {}
  await safeReply(ctx, `🔑 Removed sudo from ${mention(target)}.`);
  await logEvent('sudo_remove', { actor: ctx.from, target });
});

const sudolist = requireSudo(async (ctx) => {
  const s = await getSettings();
  const dbSudos = s.sudoUsers;
  const envSudos = config.sudoUsers;
  let txt = `👑 <b>Owner</b>: <code>${config.ownerId}</code>\n\n`;
  txt += `🔑 <b>Sudo Users</b>\n`;
  const all = [...new Set([...envSudos, ...dbSudos])];
  if (!all.length) { txt += 'None\n'; }
  for (const id of all) {
    const tag = id === config.ownerId ? ' 👑' : envSudos.includes(id) ? ' (env)' : '';
    txt += `• <code>${id}</code>${tag}\n`;
  }
  await safeReply(ctx, txt);
});

// ─── Logger Group (Owner only) ────────────────────────────────────────────

const setloggergroup = requireOwner(async (ctx) => {
  const arg = (ctx.message.text || '').split(/\s+/)[1];
  const chatId = arg ? parseInt(arg, 10) : ctx.chat?.id;
  if (!chatId || isNaN(chatId)) return safeReply(ctx, '❌ Usage: <code>/setloggergroup &lt;chatId&gt;</code>\nOr run inside the logger group itself.');
  const s = await getSettings();
  s.loggerGroupId = chatId;
  await s.save();
  invalidate();
  await safeReply(ctx, `📡 Logger group set to <code>${chatId}</code>`);
  await logEvent('setlog', { actor: ctx.from, extra: `Logger group → ${chatId}` });
});

// ─── Broadcast (Owner / Sudo) ─────────────────────────────────────────────

const broadcast = requireSudo(async (ctx) => {
  const raw = (ctx.message.text || '').split(/\s+/).slice(1).join(' ');
  const { flags, text } = broadcastService.parseFlags(raw);
  const replied = ctx.message.reply_to_message;

  if (!text && !replied) {
    const c = await broadcastService.counts();
    return safeReply(ctx,
      '📣 <b>Broadcast</b>\n\n' +
      '<code>/broadcast &lt;message&gt;</code>\n' +
      'or reply to any message (photo / video / sticker / text) with <code>/broadcast</code>\n\n' +
      '<b>Flags</b>\n' +
      '<code>-users</code> only DM users\n' +
      '<code>-groups</code> only groups\n' +
      '<code>-all</code> both (default)\n' +
      '<code>-forward</code> forward instead of copy\n' +
      '<code>-pin</code> pin after sending\n' +
      '<code>-silent</code> send without notification\n\n' +
      `<b>Reach:</b> ${c.users} users • ${c.groups} groups`);
  }

  let payload;
  if (replied) {
    payload = {
      mode: flags.forward ? 'forward' : 'copy',
      fromChatId: ctx.chat.id,
      messageId: replied.message_id,
    };
  } else {
    payload = {
      mode: 'text',
      html: `📣 <b>Broadcast from ${escapeHtml(config.botName || 'Sofiya')}</b>\n\n${escapeHtml(text)}`,
    };
  }

  const status = await safeReply(ctx, '📣 Broadcast starting…');
  const editStatus = async (t) => {
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, t, { parse_mode: 'HTML' });
    } catch {}
  };

  const stats = await broadcastService.run(ctx, payload, flags, async (s, total) => {
    await editStatus(`📣 <b>Broadcasting…</b>\n\nSent: <b>${s.ok}</b> / ${total}\nFailed: <b>${s.fail}</b>`);
  });

  if (!stats.total) return editStatus('⚠️ No targets found yet. Users must DM the bot at least once.');

  await editStatus(
    '📣 <b>Broadcast complete!</b>\n\n' +
    `✅ Delivered: <b>${stats.ok}</b> / ${stats.total}\n` +
    `👤 Users: <b>${stats.users}</b>\n` +
    `👥 Groups: <b>${stats.groups}</b>\n` +
    `❌ Failed: <b>${stats.fail}</b>\n` +
    `🧹 Cleaned (blocked/removed): <b>${stats.removed}</b>`);

  await logEvent('broadcast', { actor: ctx.from, extra: `${stats.ok}/${stats.total} delivered` });
});

const broadcastStats = requireSudo(async (ctx) => {
  const c = await broadcastService.counts();
  await safeReply(ctx,
    '📊 <b>Broadcast Reach</b>\n\n' +
    `👤 DM-able users: <b>${c.users}</b>\n` +
    `👥 Active groups: <b>${c.groups}</b>\n` +
    `🚫 Users who blocked: <b>${c.blocked}</b>\n` +
    `💤 Inactive groups: <b>${c.deadGroups}</b>`);
});

// ─── Owner Info ────────────────────────────────────────────────────────────

const ownerinfo = requireSudo(async (ctx) => {
  const s = await getSettings();
  await safeReply(ctx,
    `👑 <b>ѕσƒιуα Owner Panel</b>\n\n` +
    `Owner ID  : <code>${config.ownerId}</code>\n` +
    `Sudo users: <b>${[...new Set([...config.sudoUsers, ...s.sudoUsers])].length}</b>\n` +
    `Bot-banned: <b>${s.botBanned.length}</b>\n` +
    `Logger group: <code>${s.loggerGroupId || config.loggerGroupId || 'not set'}</code>\n\n` +
    `<b>Owner commands:</b>\n` +
    `/addcoins /removecoins /setcoins\n` +
    `/botban /botunban /botbanned\n` +
    `/addsudo /removesudo /sudolist\n` +
    `/setloggergroup /broadcast /bstats`);
});

module.exports = {
  addcoins, removecoins, setcoins,
  botban, botunban, botbanned,
  addsudo, removesudo, sudolist,
  setloggergroup, broadcast, broadcastStats, ownerinfo,
};
