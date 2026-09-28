const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { safeReply } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const logchannel = async (ctx) => {
  const g = await getGroup(ctx.chat.id);
  if (!g.logChannel) return safeReply(ctx, 'No log channel configured.');
  try {
    const c = await ctx.telegram.getChat(g.logChannel);
    await safeReply(ctx, `📡 Log channel: <b>${c.title || c.id}</b> (<code>${c.id}</code>)`);
  } catch {
    await safeReply(ctx, `📡 Log channel ID: <code>${g.logChannel}</code>`);
  }
};

const setlog = requireAdmin(async (ctx) => {
  const arg = (ctx.message.text || '').split(/\s+/)[1];
  let id = parseInt(arg, 10);
  if (!arg) {
    if (!ctx.message.reply_to_message?.forward_from_chat?.id) {
      return safeReply(ctx, '❌ Forward a message from your log channel here, then run <code>/setlog</code>.');
    }
    id = ctx.message.reply_to_message.forward_from_chat.id;
  }
  if (isNaN(id)) return safeReply(ctx, '❌ Invalid channel ID.');
  await updateGroup(ctx.chat.id, { logChannel: id });
  await safeReply(ctx, `✅ Log channel set to <code>${id}</code>. Make sure the bot is admin there.`);
});

const unsetlog = requireAdmin(async (ctx) => {
  await updateGroup(ctx.chat.id, { logChannel: null });
  await safeReply(ctx, '✅ Log channel removed.');
});

async function logEvent(ctx, html) {
  try {
    const g = await getGroup(ctx.chat.id);
    if (!g.logChannel) return;
    await ctx.telegram.sendMessage(g.logChannel, html, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch {}
}

module.exports = { logchannel, setlog, unsetlog, logEvent };
