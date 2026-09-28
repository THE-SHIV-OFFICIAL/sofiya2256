const escapeHtml = (text) => {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const mention = (user) => {
  if (!user) return 'unknown';
  const name = escapeHtml(user.first_name || user.username || String(user.id));
  return `<a href="tg://user?id=${user.id}">${name}</a>`;
};

const getUserMention = (user) => {
  if (!user) return 'unknown';
  return user.username ? `@${user.username}` : (user.first_name || String(user.id));
};

const parseDuration = (input) => {
  if (!input) return null;
  const m = String(input).trim().match(/^(\d+)\s*([smhdw])?$/i);
  if (!m) return null;
  const value = parseInt(m[1], 10);
  const unit = (m[2] || 'm').toLowerCase();
  const mult = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[unit];
  return value * mult;
};

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '0s';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ');
};

const splitArgs = (text) => {
  if (!text) return [];
  return text.trim().split(/\s+/).slice(1);
};

const argsAfterCommand = (text) => {
  if (!text) return '';
  const idx = text.indexOf(' ');
  return idx === -1 ? '' : text.slice(idx + 1).trim();
};

async function extractTarget(ctx) {
  const message = ctx.message || ctx.update?.message || ctx.update?.callback_query?.message;
  if (!message) return { user: null, reason: '' };

  if (message.reply_to_message?.from) {
    const reason = argsAfterCommand(message.text || '');
    return { user: message.reply_to_message.from, reason };
  }

  const text = message.text || message.caption || '';
  const parts = text.split(/\s+/).slice(1);
  if (parts.length === 0) return { user: null, reason: '' };

  let target = parts[0];
  const reason = parts.slice(1).join(' ');

  if (/^\d+$/.test(target)) {
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat.id, parseInt(target, 10));
      return { user: member.user, reason };
    } catch {
      return { user: { id: parseInt(target, 10), first_name: String(target) }, reason };
    }
  }

  if (target.startsWith('@')) {
    target = target.slice(1);
    try {
      const found = await ctx.telegram.getChat(`@${target}`);
      if (found?.id) {
        return { user: { id: found.id, first_name: found.first_name || target, username: found.username }, reason };
      }
    } catch {}
  }

  if (message.entities) {
    for (const e of message.entities) {
      if (e.type === 'text_mention' && e.user) return { user: e.user, reason };
    }
  }

  return { user: null, reason };
}

async function isUserAdmin(ctx, userId) {
  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, userId);
    return ['administrator', 'creator'].includes(member.status);
  } catch {
    return false;
  }
}

async function botHasPermission(ctx, perm) {
  try {
    const me = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
    if (me.status === 'creator') return true;
    if (me.status !== 'administrator') return false;
    if (!perm) return true;
    return !!me[perm];
  } catch {
    return false;
  }
}

const safeReply = async (ctx, text, extra = {}) => {
  try {
    return await ctx.reply(text, { parse_mode: 'HTML', ...extra });
  } catch (e) {
    try { return await ctx.reply(text.replace(/<[^>]+>/g, '')); } catch {}
  }
};

const onlyGroup = (ctx) => ctx.chat && ctx.chat.type !== 'private';

const renderTemplate = (template, ctx, user) => {
  const u = user || ctx.from || {};
  return String(template || '')
    .replace(/\{first\}/g, escapeHtml(u.first_name || ''))
    .replace(/\{last\}/g, escapeHtml(u.last_name || ''))
    .replace(/\{fullname\}/g, escapeHtml([u.first_name, u.last_name].filter(Boolean).join(' ')))
    .replace(/\{username\}/g, u.username ? `@${escapeHtml(u.username)}` : escapeHtml(u.first_name || ''))
    .replace(/\{mention\}/g, mention(u))
    .replace(/\{id\}/g, String(u.id || ''))
    .replace(/\{chatname\}/g, escapeHtml(ctx.chat?.title || ''))
    .replace(/\{chatid\}/g, String(ctx.chat?.id || ''))
    .replace(/\{count\}/g, String(ctx.chat?.member_count || ''));
};

module.exports = {
  escapeHtml,
  mention,
  getUserMention,
  parseDuration,
  formatDuration,
  splitArgs,
  argsAfterCommand,
  extractTarget,
  isUserAdmin,
  botHasPermission,
  safeReply,
  onlyGroup,
  renderTemplate,
};
