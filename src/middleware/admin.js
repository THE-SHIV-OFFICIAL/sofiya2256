const config = require('../config/index');
const { isSudo: _isSudo, isBotBanned } = require('../utils/botSettings');

const adminCache = new Map();
const TTL = 60_000;

async function isAdmin(ctx, next) {
  if (!ctx.from) return next ? next() : null;
  const userId = ctx.from.id;

  // ── Bot-ban gate ──────────────────────────────────────────────────────────
  try {
    const banned = await isBotBanned(userId);
    if (banned) {
      try { await ctx.reply('⛔️ You are banned from using this bot.'); } catch {}
      return;
    }
  } catch {}

  // ── Owner / Sudo flags ────────────────────────────────────────────────────
  ctx.isOwner = userId === config.ownerId;
  ctx.isSudo  = ctx.isOwner;
  if (!ctx.isSudo) {
    try { ctx.isSudo = await _isSudo(userId); } catch {}
  }

  if (!ctx.chat || ctx.chat.type === 'private') {
    ctx.isAdmin = ctx.isSudo;
    return next ? next() : null;
  }

  // ── Group admin check (cached) ────────────────────────────────────────────
  const key = `${ctx.chat.id}:${userId}`;
  const cached = adminCache.get(key);
  if (cached && cached.at > Date.now() - TTL) {
    ctx.isAdmin = cached.value || ctx.isSudo;
    return next ? next() : null;
  }

  try {
    const member = await ctx.getChatMember(userId);
    const isAdminStatus = ['administrator', 'creator'].includes(member.status);
    ctx.isAdmin = isAdminStatus || ctx.isSudo;
    ctx.chatMember = member;
    adminCache.set(key, { value: isAdminStatus, at: Date.now() });
  } catch {
    ctx.isAdmin = ctx.isSudo;
  }

  return next ? next() : null;
}

function requireAdmin(handler) {
  return async (ctx) => {
    if (!ctx.isAdmin) return ctx.reply('❌ Admins only.');
    return handler(ctx);
  };
}

function requireOwner(handler) {
  return async (ctx) => {
    if (!ctx.isOwner) return ctx.reply('❌ Owner only command.');
    return handler(ctx);
  };
}

function requireSudo(handler) {
  return async (ctx) => {
    if (!ctx.isSudo) return ctx.reply('❌ Sudo / Owner only.');
    return handler(ctx);
  };
}

module.exports = isAdmin;
module.exports.isAdmin      = isAdmin;
module.exports.requireAdmin = requireAdmin;
module.exports.requireOwner = requireOwner;
module.exports.requireSudo  = requireSudo;
