const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { safeReply, renderTemplate, mention, escapeHtml } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const lastWelcome = new Map();

const setwelcome = requireAdmin(async (ctx) => {
  const text = (ctx.message.text || '').split(/\s+/).slice(1).join(' ').trim()
    || ctx.message.reply_to_message?.text
    || ctx.message.reply_to_message?.caption;
  if (!text) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Usage: <code>/setwelcome &lt;text&gt;</code>\nSupports {first} {last} {mention} {username} {chatname} {count}', { parse_mode: 'HTML' });
  await updateGroup(ctx.chat.id, { 'welcome.text': text, 'welcome.enabled': true });
  await safeReply(ctx, '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Welcome message set.', { parse_mode: 'HTML' });
});

const resetwelcome = requireAdmin(async (ctx) => {
  await updateGroup(ctx.chat.id, { 'welcome.text': 'Welcome, {mention}, to <b>{chatname}</b>!' });
  await safeReply(ctx, '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Welcome reset to default.', { parse_mode: 'HTML' });
});

const welcome = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  const g = await getGroup(ctx.chat.id);
  if (!arg) {
    return safeReply(ctx,
      `<tg-emoji emoji-id="5350396951407895212">⚙️</tg-emoji> <b>Welcome settings</b>\nEnabled: <b>${g.welcome.enabled}</b>\nClean: <b>${g.welcome.clean}</b>\n\nText:\n<pre>${escapeHtml(g.welcome.text)}</pre>`, { parse_mode: 'HTML' });
  }
  if (['on', 'yes'].includes(arg)) { await updateGroup(ctx.chat.id, { 'welcome.enabled': true }); return safeReply(ctx, '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Welcomes enabled.', { parse_mode: 'HTML' }); }
  if (['off', 'no'].includes(arg)) { await updateGroup(ctx.chat.id, { 'welcome.enabled': false }); return safeReply(ctx, '<tg-emoji emoji-id="5350332462473944452">🔇</tg-emoji> Welcomes disabled.', { parse_mode: 'HTML' }); }
  return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Usage: <code>/welcome on|off</code>', { parse_mode: 'HTML' });
});

const cleanwelcome = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!['on', 'off'].includes(arg)) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Usage: <code>/cleanwelcome on|off</code>', { parse_mode: 'HTML' });
  await updateGroup(ctx.chat.id, { 'welcome.clean': arg === 'on' });
  await safeReply(ctx, `<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Clean welcome ${arg}.`, { parse_mode: 'HTML' });
});

const setgoodbye = requireAdmin(async (ctx) => {
  const text = (ctx.message.text || '').split(/\s+/).slice(1).join(' ').trim()
    || ctx.message.reply_to_message?.text;
  if (!text) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Usage: <code>/setgoodbye &lt;text&gt;</code>', { parse_mode: 'HTML' });
  await updateGroup(ctx.chat.id, { 'goodbye.text': text, 'goodbye.enabled': true });
  await safeReply(ctx, '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Goodbye message set.', { parse_mode: 'HTML' });
});

const resetgoodbye = requireAdmin(async (ctx) => {
  await updateGroup(ctx.chat.id, { 'goodbye.text': '{first} has left the group.' });
  await safeReply(ctx, '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Goodbye reset to default.', { parse_mode: 'HTML' });
});

const goodbye = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  const g = await getGroup(ctx.chat.id);
  if (!arg) {
    return safeReply(ctx, `<tg-emoji emoji-id="5350396951407895212">⚙️</tg-emoji> <b>Goodbye settings</b>\nEnabled: <b>${g.goodbye.enabled}</b>\n\nText:\n<pre>${escapeHtml(g.goodbye.text)}</pre>`, { parse_mode: 'HTML' });
  }
  if (['on', 'yes'].includes(arg)) { await updateGroup(ctx.chat.id, { 'goodbye.enabled': true }); return safeReply(ctx, '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Goodbyes enabled.', { parse_mode: 'HTML' }); }
  if (['off', 'no'].includes(arg)) { await updateGroup(ctx.chat.id, { 'goodbye.enabled': false }); return safeReply(ctx, '<tg-emoji emoji-id="5350332462473944452">🔇</tg-emoji> Goodbyes disabled.', { parse_mode: 'HTML' }); }
  return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Usage: <code>/goodbye on|off</code>', { parse_mode: 'HTML' });
});

async function newMemberHandler(ctx, next) {
  if (!ctx.message?.new_chat_members) return next();
  const g = await getGroup(ctx.chat.id);
  if (!g.welcome.enabled) return next();
  for (const u of ctx.message.new_chat_members) {
    if (u.is_bot && u.id === ctx.botInfo.id) continue;
    try {
      const text = renderTemplate(g.welcome.text, ctx, u);
      const sent = await ctx.reply(text || `Welcome, ${mention(u)}!`, { parse_mode: 'HTML' });
      if (g.welcome.clean) {
        const prev = lastWelcome.get(ctx.chat.id);
        if (prev) { try { await ctx.deleteMessage(prev); } catch {} }
        lastWelcome.set(ctx.chat.id, sent.message_id);
      }
    } catch {}
  }
  return next();
}

async function leftMemberHandler(ctx, next) {
  if (!ctx.message?.left_chat_member) return next();
  const u = ctx.message.left_chat_member;
  if (u.id === ctx.botInfo.id) return next();
  const g = await getGroup(ctx.chat.id);
  if (!g.goodbye.enabled) return next();
  try {
    const text = renderTemplate(g.goodbye.text, ctx, u);
    await ctx.reply(text || `${u.first_name} has left.`, { parse_mode: 'HTML' });
  } catch {}
  return next();
}

async function cleanServiceMiddleware(ctx, next) {
  const m = ctx.message;
  if (!m || !ctx.chat || ctx.chat.type === 'private') return next();
  const isService = m.new_chat_members || m.left_chat_member || m.new_chat_title || m.new_chat_photo
    || m.delete_chat_photo || m.group_chat_created || m.pinned_message;
  if (!isService) return next();
  const g = await getGroup(ctx.chat.id);
  if (g.cleanService) { try { await ctx.deleteMessage(); } catch {} }
  return next();
}

const cleanservice = requireAdmin(async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  if (!['on', 'off'].includes(arg)) {
    const g = await getGroup(ctx.chat.id);
    return safeReply(ctx, `<tg-emoji emoji-id="5350396951407895212">⚙️</tg-emoji> Clean service: <b>${g.cleanService ? 'on' : 'off'}</b>.\nUsage: <code>/cleanservice on|off</code>`, { parse_mode: 'HTML' });
  }
  await updateGroup(ctx.chat.id, { cleanService: arg === 'on' });
  await safeReply(ctx, `<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Clean service ${arg}.`, { parse_mode: 'HTML' });
});

module.exports = {
  setwelcome, resetwelcome, welcome, cleanwelcome,
  setgoodbye, resetgoodbye, goodbye,
  newMemberHandler, leftMemberHandler,
  cleanservice, cleanServiceMiddleware,
};
