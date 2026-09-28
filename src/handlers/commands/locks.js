const { Lock } = require('../../models');
const { safeReply, escapeHtml } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const LOCK_TYPES = [
  'sticker', 'photo', 'video', 'animation', 'audio', 'voice', 'document',
  'url', 'forward', 'mention', 'hashtag', 'email', 'phone', 'cashtag',
  'bot', 'invitelink', 'rtl', 'emoji', 'poll', 'contact', 'location', 'game',
  'all', 'media', 'messages',
];

const lock = requireAdmin(async (ctx) => {
  const args = (ctx.message.text || '').split(/\s+/).slice(1).map((s) => s.toLowerCase()).filter(Boolean);
  if (args.length === 0) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Usage: <code>/lock &lt;type&gt; [type ...]</code>\n/locktypes for the list.', { parse_mode: 'HTML' });
  
  const added = [];
  for (const t of args) {
    if (!LOCK_TYPES.includes(t)) continue;
    await Lock.findOneAndUpdate({ chatId: ctx.chat.id, type: t }, {}, { upsert: true });
    added.push(t);
  }
  
  if (added.length === 0) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Unknown lock type. /locktypes for the list.', { parse_mode: 'HTML' });
  await safeReply(ctx, `<tg-emoji emoji-id="5213415377593185638">⛔️</tg-emoji> Locked: <b>${added.join(', ')}</b>`, { parse_mode: 'HTML' });
});

const unlock = requireAdmin(async (ctx) => {
  const args = (ctx.message.text || '').split(/\s+/).slice(1).map((s) => s.toLowerCase()).filter(Boolean);
  if (args.length === 0) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Usage: <code>/unlock &lt;type&gt;</code>', { parse_mode: 'HTML' });
  
  const removed = [];
  for (const t of args) {
    const r = await Lock.deleteOne({ chatId: ctx.chat.id, type: t });
    if (r.deletedCount) removed.push(t);
  }
  
  if (removed.length === 0) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> None of those were locked.', { parse_mode: 'HTML' });
  await safeReply(ctx, `<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Unlocked: <b>${removed.join(', ')}</b>`, { parse_mode: 'HTML' });
});

const locks = async (ctx) => {
  const list = await Lock.find({ chatId: ctx.chat.id }).lean();
  if (list.length === 0) return safeReply(ctx, '<tg-emoji emoji-id="5350444080084033572">✨</tg-emoji> No locks here.', { parse_mode: 'HTML' });
  await safeReply(ctx, `<tg-emoji emoji-id="5213415377593185638">⛔️</tg-emoji> <b>Active locks:</b>\n${list.map((l) => `<tg-emoji emoji-id="5215486050046062421">📌</tg-emoji> ${escapeHtml(l.type)}`).join('\n')}`, { parse_mode: 'HTML' });
};

const locktypes = async (ctx) => {
  await safeReply(ctx, `<tg-emoji emoji-id="5350396951407895212">⚙️</tg-emoji> <b>Available lock types:</b>\n${LOCK_TYPES.map((t) => `<tg-emoji emoji-id="5215486050046062421">📌</tg-emoji> <code>${t}</code>`).join('\n')}`, { parse_mode: 'HTML' });
};

function detectLockType(msg) {
  if (!msg) return null;
  if (msg.sticker) return 'sticker';
  if (msg.photo) return 'photo';
  if (msg.video) return 'video';
  if (msg.animation) return 'animation';
  if (msg.audio) return 'audio';
  if (msg.voice) return 'voice';
  if (msg.document) return 'document';
  if (msg.poll) return 'poll';
  if (msg.contact) return 'contact';
  if (msg.location) return 'location';
  if (msg.game) return 'game';
  if (msg.forward_origin || msg.forward_from || msg.forward_from_chat) return 'forward';
  return null;
}

function entityToLockType(e, text) {
  switch (e.type) {
    case 'url':
    case 'text_link': return 'url';
    case 'mention': case 'text_mention': return 'mention';
    case 'hashtag': return 'hashtag';
    case 'cashtag': return 'cashtag';
    case 'email': return 'email';
    case 'phone_number': return 'phone';
    default: return null;
  }
}

async function lockMiddleware(ctx, next) {
  if (!ctx.message || !ctx.chat || ctx.chat.type === 'private') return next();
  if (ctx.isAdmin) return next();
  
  const list = await Lock.find({ chatId: ctx.chat.id }).lean();
  if (list.length === 0) return next();
  
  const types = new Set(list.map((l) => l.type));

  if (types.has('all') || types.has('messages')) {
    try { await ctx.deleteMessage(); } catch {}
    return;
  }

  const lockType = detectLockType(ctx.message);
  if (lockType && (types.has(lockType) || (types.has('media') && ['photo', 'video', 'animation', 'audio', 'voice', 'document', 'sticker'].includes(lockType)))) {
    try { await ctx.deleteMessage(); } catch {}
    return;
  }

  const text = ctx.message.text || ctx.message.caption || '';
  if (text && ctx.message.entities) {
    for (const e of ctx.message.entities) {
      const t = entityToLockType(e, text);
      if (t && types.has(t)) {
        try { await ctx.deleteMessage(); } catch {}
        return;
      }
      if (e.type === 'url' || e.type === 'text_link') {
        const url = e.type === 'text_link' ? e.url : text.substr(e.offset, e.length);
        if (types.has('invitelink') && /(t\.me\/joinchat|t\.me\/\+|telegram\.me\/)/i.test(url)) {
          try { await ctx.deleteMessage(); } catch {}
          return;
        }
      }
    }
  }

  if (types.has('rtl') && /[\u0590-\u08FF]/.test(text)) {
    try { await ctx.deleteMessage(); } catch {}
    return;
  }
  if (types.has('emoji') && /\p{Extended_Pictographic}/u.test(text)) {
    try { await ctx.deleteMessage(); } catch {}
    return;
  }
  if (types.has('bot') && ctx.message.new_chat_members?.some((u) => u.is_bot)) {
    for (const u of ctx.message.new_chat_members) {
      if (u.is_bot && u.id !== ctx.botInfo.id) {
        try { await ctx.banChatMember(u.id); } catch {}
      }
    }
    return;
  }

  return next();
}

module.exports = { lock, unlock, locks, locktypes, lockMiddleware };
