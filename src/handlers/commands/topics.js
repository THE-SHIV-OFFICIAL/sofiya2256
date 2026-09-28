const { safeReply, escapeHtml } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const topic = requireAdmin(async (ctx) => {
  if (!ctx.chat?.is_forum) return safeReply(ctx, '❌ This chat is not a forum.');
  const text = (ctx.message.text || '').split(/\s+/).slice(1).join(' ').trim();
  if (!text) return safeReply(ctx, '❌ Usage: <code>/topic &lt;name&gt;</code>');
  try {
    const t = await ctx.telegram.callApi('createForumTopic', { chat_id: ctx.chat.id, name: text });
    await safeReply(ctx, `✅ Topic <b>${escapeHtml(text)}</b> created (id <code>${t.message_thread_id}</code>).`);
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const closetopic = requireAdmin(async (ctx) => {
  const tid = ctx.message.message_thread_id;
  if (!tid) return safeReply(ctx, '❌ Run this inside a topic.');
  try {
    await ctx.telegram.callApi('closeForumTopic', { chat_id: ctx.chat.id, message_thread_id: tid });
    await safeReply(ctx, '🔒 Topic closed.');
  } catch (e) { await safeReply(ctx, `❌ ${e.description || e.message}`); }
});

const opentopic = requireAdmin(async (ctx) => {
  const tid = ctx.message.message_thread_id;
  if (!tid) return safeReply(ctx, '❌ Run this inside a topic.');
  try {
    await ctx.telegram.callApi('reopenForumTopic', { chat_id: ctx.chat.id, message_thread_id: tid });
    await safeReply(ctx, '🔓 Topic reopened.');
  } catch (e) { await safeReply(ctx, `❌ ${e.description || e.message}`); }
});

const renametopic = requireAdmin(async (ctx) => {
  const tid = ctx.message.message_thread_id;
  if (!tid) return safeReply(ctx, '❌ Run this inside a topic.');
  const name = (ctx.message.text || '').split(/\s+/).slice(1).join(' ').trim();
  if (!name) return safeReply(ctx, '❌ Usage: <code>/renametopic &lt;new name&gt;</code>');
  try {
    await ctx.telegram.callApi('editForumTopic', { chat_id: ctx.chat.id, message_thread_id: tid, name });
    await safeReply(ctx, '✅ Topic renamed.');
  } catch (e) { await safeReply(ctx, `❌ ${e.description || e.message}`); }
});

const deletetopic = requireAdmin(async (ctx) => {
  const tid = ctx.message.message_thread_id;
  if (!tid) return safeReply(ctx, '❌ Run this inside a topic.');
  try {
    await ctx.telegram.callApi('deleteForumTopic', { chat_id: ctx.chat.id, message_thread_id: tid });
  } catch (e) { await safeReply(ctx, `❌ ${e.description || e.message}`); }
});

module.exports = { topic, closetopic, opentopic, renametopic, deletetopic };
