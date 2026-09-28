const { safeReply } = require('../../utils/helpers');
const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { requireAdmin } = require('../../middleware/admin');
const { logEvent } = require('../../services/loggingService');

const formathelp = async (ctx) => {
  await safeReply(ctx,
    `<b>📐 Formatting</b>\n\nNotes / welcome / filters use <b>HTML</b>.\n` +
    `<code>&lt;b&gt;bold&lt;/b&gt; &lt;i&gt;italic&lt;/i&gt; &lt;u&gt;underline&lt;/u&gt; &lt;s&gt;strike&lt;/s&gt;</code>\n` +
    `<code>&lt;code&gt;mono&lt;/code&gt; &lt;pre&gt;code-block&lt;/pre&gt;</code>\n` +
    `<code>&lt;a href="https://example.com"&gt;link&lt;/a&gt;</code>\n\n` +
    `<b>Placeholders</b>: {first} {last} {fullname} {username} {mention} {id} {chatname} {count}`);
};

const markdownhelp = formathelp;

const setlang = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!arg) {
    const g = await getGroup(ctx.chat.id);
    return safeReply(ctx, `Current language: <b>${g.language}</b>.\nUsage: <code>/setlang en</code> (only English supported for now)`);
  }
  if (arg !== 'en') return safeReply(ctx, '⚠️ Only <code>en</code> is supported right now.');
  await updateGroup(ctx.chat.id, { language: arg });
  await safeReply(ctx, `✅ Language set to <b>${arg}</b>.`);
});

const privacy = async (ctx) => {
  await safeReply(ctx,
    `<b>🔐 Privacy</b>\n\n` +
    `• AI moderation sends only the visible message text to NVIDIA AI's API for classification.\n` +
    `• Classifier results are cached in memory for 5 minutes, never written to disk.\n` +
    `• AI chatbot stores up to 12 recent messages per user/chat in MongoDB.\n` +
    `• You can clear chat memory by talking to the bot owner.\n` +
    `• No content is sold or shared with third parties.`);
};

const importchat = requireAdmin(async (ctx) => {
  await safeReply(ctx, '📥 Import is coming soon. Reply to a previously /export-ed JSON to restore.');
});

const exportchat = requireAdmin(async (ctx) => {
  const { Note, Filter, Blacklist, Lock, DisabledCommand } = require('../../models');
  const g = await getGroup(ctx.chat.id);
  const data = {
    chatId: ctx.chat.id,
    title: ctx.chat.title,
    settings: g.toObject(),
    notes: await Note.find({ chatId: ctx.chat.id }).lean(),
    filters: await Filter.find({ chatId: ctx.chat.id }).lean(),
    blacklist: await Blacklist.find({ chatId: ctx.chat.id }).lean(),
    locks: await Lock.find({ chatId: ctx.chat.id }).lean(),
    disabled: await DisabledCommand.find({ chatId: ctx.chat.id }).lean(),
    exportedAt: new Date().toISOString(),
  };
  const json = JSON.stringify(data, null, 2);
  try {
    await ctx.replyWithDocument({ source: Buffer.from(json), filename: `sofiya-export-${ctx.chat.id}.json` });
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const protection = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  const g = await getGroup(ctx.chat.id);
  if (!arg) {
    return safeReply(ctx,
      `🛡 <b>NSFW / Abuse Protection</b>\n` +
      `Status     : <b>${g.nsfwProtection !== false ? '🟢 ON (default)' : '🔴 OFF'}</b>\n` +
      `Strict mode: <b>${g.strictMode ? 'ON' : 'OFF'}</b>\n\n` +
      `Auto-removes prohibited <b>text, images, videos, GIFs, stickers, emojis & captions</b> ` +
      `(porn, drugs, abuse, gore, scams, hate). Applies to <b>everyone — including admins</b>.\n\n` +
      `<code>/protection on|off</code>\n` +
      `<code>/strictmode on|off</code> — also temporarily mutes non-admin offenders for 1h.`);
  }
  if (!['on', 'off'].includes(arg)) return safeReply(ctx, '❌ Usage: <code>/protection on|off</code>');
  await updateGroup(ctx.chat.id, { nsfwProtection: arg === 'on' });
  logEvent('nsfw_toggle', {
    chat: ctx.chat,
    actor: ctx.from,
    reason: `NSFW protection ${arg}`,
  }).catch(() => {});
  await safeReply(ctx, `✅ Protection ${arg === 'on' ? '🟢 enabled' : '🔴 disabled'}.`);
});

const strictmode = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!['on', 'off'].includes(arg)) {
    const g = await getGroup(ctx.chat.id);
    return safeReply(ctx, `Strict mode: <b>${g.strictMode ? 'ON' : 'OFF'}</b>.\nUsage: <code>/strictmode on|off</code>`);
  }
  await updateGroup(ctx.chat.id, { strictMode: arg === 'on' });
  logEvent('nsfw_toggle', {
    chat: ctx.chat,
    actor: ctx.from,
    reason: `Strict mode ${arg}`,
  }).catch(() => {});
  await safeReply(ctx, `✅ Strict mode ${arg}.`);
});

module.exports = { formathelp, markdownhelp, setlang, privacy, importchat, exportchat, protection, strictmode };
