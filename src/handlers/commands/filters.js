const { Filter } = require('../../models');
const { safeReply, escapeHtml, renderTemplate } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

function detectMediaFromMessage(msg) {
  if (!msg) return { type: 'text', fileId: '' };
  if (msg.photo) return { type: 'photo', fileId: msg.photo.slice(-1)[0].file_id };
  if (msg.video) return { type: 'video', fileId: msg.video.file_id };
  if (msg.document) return { type: 'document', fileId: msg.document.file_id };
  if (msg.sticker) return { type: 'sticker', fileId: msg.sticker.file_id };
  if (msg.animation) return { type: 'animation', fileId: msg.animation.file_id };
  return { type: 'text', fileId: '' };
}

const filter = requireAdmin(async (ctx) => {
  const text = ctx.message.text || '';
  const m = text.match(/^\/filter\s+(?:"([^"]+)"|(\S+))(?:\s+([\s\S]+))?$/);
  const reply = ctx.message.reply_to_message;
  if (!m) return safeReply(ctx, '❌ Usage: <code>/filter &lt;trigger&gt; &lt;reply&gt;</code> or reply to a message.');
  const trigger = (m[1] || m[2]).toLowerCase();
  let body = (m[3] || '').trim();
  let media = { type: 'text', fileId: '' };
  if (reply) {
    media = detectMediaFromMessage(reply);
    if (!body) body = reply.text || reply.caption || '';
  }
  if (!body && media.type === 'text') return safeReply(ctx, '❌ Provide a reply, or reply to a message.');
  await Filter.findOneAndUpdate(
    { chatId: ctx.chat.id, trigger },
    { reply: body, fileId: media.fileId, type: media.type, createdBy: ctx.from.id },
    { upsert: true }
  );
  await safeReply(ctx, `✅ Filter on <code>${escapeHtml(trigger)}</code> saved.`);
});

const stop = requireAdmin(async (ctx) => {
  const trigger = (ctx.message.text || '').split(/\s+/).slice(1).join(' ').toLowerCase();
  if (!trigger) return safeReply(ctx, '❌ Usage: <code>/stop &lt;trigger&gt;</code>');
  const r = await Filter.deleteOne({ chatId: ctx.chat.id, trigger });
  if (r.deletedCount === 0) return safeReply(ctx, '❌ No such filter.');
  await safeReply(ctx, `🗑️ Filter <code>${escapeHtml(trigger)}</code> removed.`);
});

const stopall = requireAdmin(async (ctx) => {
  if (!ctx.isOwner) return safeReply(ctx, '❌ Owner only.');
  const r = await Filter.deleteMany({ chatId: ctx.chat.id });
  await safeReply(ctx, `🗑️ Removed <b>${r.deletedCount}</b> filters.`);
});

const filters = async (ctx) => {
  const list = await Filter.find({ chatId: ctx.chat.id }).sort({ trigger: 1 }).lean();
  if (list.length === 0) return safeReply(ctx, 'No filters here.');
  await safeReply(ctx, `🔍 <b>Filters:</b>\n${list.map((f) => `• <code>${escapeHtml(f.trigger)}</code>`).join('\n')}`);
};

async function filterMiddleware(ctx, next) {
  if (!ctx.message?.text || !ctx.chat || ctx.chat.type === 'private') return next();
  const text = ctx.message.text.toLowerCase();
  if (text.startsWith('/')) return next();
  const list = await Filter.find({ chatId: ctx.chat.id }).lean();
  for (const f of list) {
    const re = new RegExp(`(^|\\W)${f.trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`, 'i');
    if (re.test(text)) {
      try {
        const body = renderTemplate(f.reply, ctx);
        const extra = { parse_mode: 'HTML', reply_to_message_id: ctx.message.message_id };
        if (f.type === 'photo' && f.fileId) await ctx.replyWithPhoto(f.fileId, { caption: body, ...extra });
        else if (f.type === 'video' && f.fileId) await ctx.replyWithVideo(f.fileId, { caption: body, ...extra });
        else if (f.type === 'sticker' && f.fileId) await ctx.replyWithSticker(f.fileId, extra);
        else if (f.type === 'document' && f.fileId) await ctx.replyWithDocument(f.fileId, { caption: body, ...extra });
        else if (f.type === 'animation' && f.fileId) await ctx.replyWithAnimation(f.fileId, { caption: body, ...extra });
        else await ctx.reply(body, extra);
      } catch {}
      break;
    }
  }
  return next();
}

module.exports = { filter, stop, stopall, filters, filterMiddleware };
