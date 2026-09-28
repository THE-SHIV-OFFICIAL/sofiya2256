const crypto = require('crypto');
const { Federation } = require('../../models');
const { extractTarget, mention, safeReply, escapeHtml } = require('../../utils/helpers');
const { requireOwner } = require('../../middleware/admin');

const newfed = async (ctx) => {
  const name = (ctx.message.text || '').split(/\s+/).slice(1).join(' ').trim();
  if (!name) return safeReply(ctx, '❌ Usage: <code>/newfed &lt;name&gt;</code>');
  const exists = await Federation.findOne({ ownerId: ctx.from.id });
  if (exists) return safeReply(ctx, `❌ You already own a fed: <b>${escapeHtml(exists.name)}</b>`);
  const fedId = crypto.randomUUID();
  await Federation.create({ fedId, name, ownerId: ctx.from.id });
  await safeReply(ctx, `🌐 Federation <b>${escapeHtml(name)}</b> created.\nID: <code>${fedId}</code>`);
};

const delfed = async (ctx) => {
  const r = await Federation.deleteOne({ ownerId: ctx.from.id });
  if (r.deletedCount === 0) return safeReply(ctx, '❌ You don\'t own any fed.');
  await safeReply(ctx, '🗑️ Federation deleted.');
};

const joinfed = requireOwner(async (ctx) => {
  const fedId = (ctx.message.text || '').split(/\s+/)[1];
  if (!fedId) return safeReply(ctx, '❌ Usage: <code>/joinfed &lt;fedId&gt;</code> in your group.');
  const fed = await Federation.findOne({ fedId });
  if (!fed) return safeReply(ctx, '❌ Fed not found.');
  if (fed.chats.includes(ctx.chat.id)) return safeReply(ctx, '❌ Already joined.');
  fed.chats.push(ctx.chat.id);
  await fed.save();
  await safeReply(ctx, `✅ Group joined fed <b>${escapeHtml(fed.name)}</b>.`);
});

const leavefed = requireOwner(async (ctx) => {
  const fed = await Federation.findOne({ chats: ctx.chat.id });
  if (!fed) return safeReply(ctx, '❌ Not in any fed.');
  fed.chats = fed.chats.filter((c) => c !== ctx.chat.id);
  await fed.save();
  await safeReply(ctx, '✅ Group left the fed.');
});

const fedinfo = async (ctx) => {
  const arg = (ctx.message.text || '').split(/\s+/)[1];
  let fed;
  if (arg) fed = await Federation.findOne({ fedId: arg });
  else fed = await Federation.findOne({ chats: ctx.chat.id }) || await Federation.findOne({ ownerId: ctx.from.id });
  if (!fed) return safeReply(ctx, '❌ No federation found.');
  await safeReply(ctx,
    `🌐 <b>${escapeHtml(fed.name)}</b>\nID: <code>${fed.fedId}</code>\nOwner: <code>${fed.ownerId}</code>\nChats: <b>${fed.chats.length}</b>\nBans: <b>${fed.bans.length}</b>`);
};

const fban = async (ctx) => {
  const fed = await Federation.findOne({ ownerId: ctx.from.id });
  if (!fed) return safeReply(ctx, '❌ You don\'t own a fed.');
  const { user, reason } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  if (fed.bans.find((b) => b.userId === user.id)) return safeReply(ctx, '❌ Already fbanned.');
  fed.bans.push({ userId: user.id, reason, by: ctx.from.id });
  await fed.save();
  let banned = 0;
  for (const c of fed.chats) {
    try { await ctx.telegram.banChatMember(c, user.id); banned++; } catch {}
  }
  await safeReply(ctx, `🌐 ${mention(user)} fbanned in <b>${banned}</b>/${fed.chats.length} chats.${reason ? `\nReason: ${escapeHtml(reason)}` : ''}`);
};

const unfban = async (ctx) => {
  const fed = await Federation.findOne({ ownerId: ctx.from.id });
  if (!fed) return safeReply(ctx, '❌ You don\'t own a fed.');
  const { user } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  fed.bans = fed.bans.filter((b) => b.userId !== user.id);
  await fed.save();
  let n = 0;
  for (const c of fed.chats) {
    try { await ctx.telegram.unbanChatMember(c, user.id, { only_if_banned: true }); n++; } catch {}
  }
  await safeReply(ctx, `🌐 ${mention(user)} unfbanned in ${n}/${fed.chats.length} chats.`);
};

async function fedJoinCheck(ctx, next) {
  if (!ctx.message?.new_chat_members) return next();
  const fed = await Federation.findOne({ chats: ctx.chat.id });
  if (!fed) return next();
  for (const u of ctx.message.new_chat_members) {
    if (fed.bans.find((b) => b.userId === u.id)) {
      try {
        await ctx.banChatMember(u.id);
        await ctx.reply(`🌐 ${mention(u)} is fbanned in <b>${escapeHtml(fed.name)}</b> — removed.`, { parse_mode: 'HTML' });
      } catch {}
    }
  }
  return next();
}

module.exports = { newfed, delfed, joinfed, leavefed, fedinfo, fban, unfban, fedJoinCheck };
