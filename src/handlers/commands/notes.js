const { Note } = require('../../models');
const { safeReply, escapeHtml, renderTemplate } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

function detectMediaFromMessage(msg) {
  if (!msg) return { type: 'text', fileId: '' };
  if (msg.photo) return { type: 'photo', fileId: msg.photo.slice(-1)[0].file_id };
  if (msg.video) return { type: 'video', fileId: msg.video.file_id };
  if (msg.document) return { type: 'document', fileId: msg.document.file_id };
  if (msg.sticker) return { type: 'sticker', fileId: msg.sticker.file_id };
  if (msg.voice) return { type: 'voice', fileId: msg.voice.file_id };
  if (msg.audio) return { type: 'audio', fileId: msg.audio.file_id };
  if (msg.animation) return { type: 'animation', fileId: msg.animation.file_id };
  return { type: 'text', fileId: '' };
}

const save = requireAdmin(async (ctx) => {
  const parts = (ctx.message.text || '').split(/\s+/).slice(1);
  const name = (parts[0] || '').toLowerCase();
  if (!name) return safeReply(ctx, '❌ Usage: <code>/save &lt;name&gt; &lt;content&gt;</code> or reply to a message.');
  const reply = ctx.message.reply_to_message;
  let content = parts.slice(1).join(' ');
  let media = { type: 'text', fileId: '' };
  if (reply) {
    media = detectMediaFromMessage(reply);
    if (!content) content = reply.text || reply.caption || '';
  }
  if (!content && media.type === 'text') return safeReply(ctx, '❌ Provide content or reply to a message.');
  await Note.findOneAndUpdate(
    { chatId: ctx.chat.id, name },
    { content, fileId: media.fileId, type: media.type, createdBy: ctx.from.id },
    { upsert: true, new: true }
  );
  await safeReply(ctx, `✅ Note <code>#${escapeHtml(name)}</code> saved.`);
});

const clear = requireAdmin(async (ctx) => {
  const name = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!name) return safeReply(ctx, '❌ Usage: <code>/clear &lt;name&gt;</code>');
  const r = await Note.deleteOne({ chatId: ctx.chat.id, name });
  if (r.deletedCount === 0) return safeReply(ctx, '❌ No note with that name.');
  await safeReply(ctx, `🗑️ Note <code>#${escapeHtml(name)}</code> removed.`);
});

const clearall = requireAdmin(async (ctx) => {
  if (!ctx.isOwner) return safeReply(ctx, '❌ Only the chat owner can clear all notes.');
  const r = await Note.deleteMany({ chatId: ctx.chat.id });
  await safeReply(ctx, `🗑️ Removed <b>${r.deletedCount}</b> notes.`);
});

const notes = async (ctx) => {
  const list = await Note.find({ chatId: ctx.chat.id }).sort({ name: 1 }).lean();
  if (list.length === 0) return safeReply(ctx, 'No notes saved here yet.');
  const text = `📝 <b>Notes in this chat:</b>\n${list.map((n) => `• <code>#${escapeHtml(n.name)}</code>`).join('\n')}`;
  await safeReply(ctx, text);
};

async function sendNote(ctx, note, replyTo) {
  const text = renderTemplate(note.content, ctx);
  const extra = { parse_mode: note.parseMode || 'HTML' };
  if (replyTo) extra.reply_to_message_id = replyTo;
  try {
    if (note.type === 'photo' && note.fileId) return ctx.replyWithPhoto(note.fileId, { caption: text, ...extra });
    if (note.type === 'video' && note.fileId) return ctx.replyWithVideo(note.fileId, { caption: text, ...extra });
    if (note.type === 'document' && note.fileId) return ctx.replyWithDocument(note.fileId, { caption: text, ...extra });
    if (note.type === 'sticker' && note.fileId) return ctx.replyWithSticker(note.fileId, extra);
    if (note.type === 'voice' && note.fileId) return ctx.replyWithVoice(note.fileId, { caption: text, ...extra });
    if (note.type === 'audio' && note.fileId) return ctx.replyWithAudio(note.fileId, { caption: text, ...extra });
    if (note.type === 'animation' && note.fileId) return ctx.replyWithAnimation(note.fileId, { caption: text, ...extra });
    return ctx.reply(text, extra);
  } catch {
    return ctx.reply(text.replace(/<[^>]+>/g, ''));
  }
}

const get = async (ctx) => {
  const name = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!name) return safeReply(ctx, '❌ Usage: <code>/get &lt;name&gt;</code>');
  const note = await Note.findOne({ chatId: ctx.chat.id, name });
  if (!note) return safeReply(ctx, '❌ Note not found.');
  await sendNote(ctx, note);
};

async function hashtagMiddleware(ctx, next) {
  if (!ctx.message?.text || !ctx.chat || ctx.chat.type === 'private') return next();
  const m = ctx.message.text.match(/^#(\w+)/);
  if (!m) return next();
  const note = await Note.findOne({ chatId: ctx.chat.id, name: m[1].toLowerCase() });
  if (note) await sendNote(ctx, note, ctx.message.message_id);
  return next();
}

module.exports = { save, clear, clearall, notes, get, hashtagMiddleware };
