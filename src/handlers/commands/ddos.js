'use strict';

const { getGroup, updateGroup } = require('../../utils/groupSettings');
const { safeReply } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');
const { logEvent } = require('../../services/loggingService');

const ddos = requireAdmin(async (ctx) => {
  const arg = ((ctx.message?.text || '').split(/\s+/)[1] || '').toLowerCase();
  const group = await getGroup(ctx.chat.id);

  if (!arg || !['on', 'off', 'status'].includes(arg)) {
    return safeReply(ctx,
      `<b>🛡 DDoS Protection</b>\n` +
      `Status: <b>${group.ddosProtection?.enabled === true ? '🟢 ON' : '🔴 OFF'}</b>\n` +
      `Message limit: <b>${group.ddosProtection?.messageLimit || 14}</b> in 10s\n` +
      `Join limit: <b>${group.ddosProtection?.joinLimit || 8}</b> in 30s\n` +
      `VC invite limit: <b>${group.ddosProtection?.vcInviteLimit || 5}</b> in 20s\n` +
      `Warnings: <b>3</b> | After warnings: <b>5m mute</b> | Group lock: <b>1m</b>\n` +
      `<i>DDoS protection is OFF by default. It never bans suspicious users.</i>\n\n` +
      `<code>/ddos on</code> — enable alerts and automatic protection\n` +
      `<code>/ddos off</code> — disable it\n` +
      `<code>/ddos status</code> — show current settings`);
  }
  if (arg === 'status') {
    return safeReply(ctx, `🛡 DDoS Protection is <b>${group.ddosProtection?.enabled === true ? 'ON 🟢' : 'OFF 🔴'}</b>.`);
  }

  const enabled = arg === 'on';
  await updateGroup(ctx.chat.id, {
    'ddosProtection.enabled': enabled,
    'ddosProtection.configured': true,
  });
  logEvent('ddos_toggle', {
    chat: ctx.chat,
    actor: ctx.from,
    reason: `DDoS protection ${arg}`,
  }).catch(() => {});
  return safeReply(ctx, `✅ DDoS protection <b>${enabled ? 'enabled 🟢' : 'disabled 🔴'}</b>.`);
});

module.exports = { ddos };