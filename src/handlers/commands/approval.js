const { Approval } = require('../../models');
const { extractTarget, mention, safeReply } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const approve = requireAdmin(async (ctx) => {
  const { user } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  await Approval.findOneAndUpdate({ chatId: ctx.chat.id, userId: user.id }, {}, { upsert: true });
  await safeReply(ctx, `✅ ${mention(user)} is now approved — bypasses anti-flood, blacklists, locks, and CAS.`);
});

const unapprove = requireAdmin(async (ctx) => {
  const { user } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  await Approval.deleteOne({ chatId: ctx.chat.id, userId: user.id });
  await safeReply(ctx, `🔓 ${mention(user)} unapproved.`);
});

const approval = async (ctx) => {
  const { user } = await extractTarget(ctx);
  const target = user || ctx.from;
  const a = await Approval.findOne({ chatId: ctx.chat.id, userId: target.id });
  await safeReply(ctx, `${mention(target)} is ${a ? '<b>approved</b> ✅' : '<b>not approved</b> ❌'} in this chat.`);
};

const approved = async (ctx) => {
  const list = await Approval.find({ chatId: ctx.chat.id }).lean();
  if (list.length === 0) return safeReply(ctx, 'No approved users in this chat.');
  let txt = '<b>Approved users:</b>\n';
  for (const a of list.slice(0, 50)) {
    try {
      const m = await ctx.telegram.getChatMember(ctx.chat.id, a.userId);
      txt += `• ${mention(m.user)}\n`;
    } catch {
      txt += `• <code>${a.userId}</code>\n`;
    }
  }
  if (list.length > 50) txt += `…and ${list.length - 50} more`;
  await safeReply(ctx, txt);
};

const unapproveall = requireAdmin(async (ctx) => {
  if (!ctx.isOwner) return safeReply(ctx, '❌ Owner only.');
  const r = await Approval.deleteMany({ chatId: ctx.chat.id });
  await safeReply(ctx, `🔓 Unapproved <b>${r.deletedCount}</b> user(s).`);
});

async function isApproved(chatId, userId) {
  return !!(await Approval.findOne({ chatId, userId }).lean());
}

module.exports = { approve, unapprove, approval, approved, unapproveall, isApproved };
