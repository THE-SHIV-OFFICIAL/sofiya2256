const { Wallet } = require('../../models');
const { safeReply, mention, formatDuration } = require('../../utils/helpers');

const NEKOS = 'https://nekos.best/api/v2';

async function getOrCreate(user) {
  const userId = typeof user === 'object' ? user.id : user;
  let w = await Wallet.findOne({ userId });
  if (!w) {
    w = new Wallet({ userId });
  }
  if (typeof user === 'object') {
    w.username = user.username || '';
    w.firstName = user.first_name || '';
  }
  if (!w._id || w.isNew) return w.save();
  return w.save();
}

async function getW(userId) {
  let w = await Wallet.findOne({ userId });
  if (!w) w = await Wallet.create({ userId });
  return w;
}

async function fetchKillGif() {
  try {
    const res = await fetch(`${NEKOS}/kill?amount=1`);
    const data = await res.json();
    return data.results?.[0]?.url || null;
  } catch { return null; }
}

// ─── Balance ────────────────────────────────────────────────────────────────
const balance = async (ctx) => {
  const u = ctx.message.reply_to_message?.from || ctx.from;
  const w = await getW(u.id);
  const protected_ = w.protectedUntil && w.protectedUntil > new Date();
  const protLeft = protected_
    ? formatDuration(Math.floor((w.protectedUntil - Date.now()) / 1000))
    : null;
  await safeReply(ctx,
    `💰 <b>Wallet of ${mention(u)}</b>\n` +
    `┌─────────────────────\n` +
    `│ 💵 Coins   : <b>${w.coins}</b>\n` +
    `│ 🏦 Bank    : <b>${w.bank}</b>\n` +
    `│ 🗡️ Kills   : <b>${w.kills}</b>\n` +
    `│ 💀 Deaths  : <b>${w.deaths}</b>\n` +
    `│ 🛡 Shield  : <b>${protLeft ? `✅ ${protLeft} left` : '❌ none'}</b>\n` +
    `└─────────────────────`);
};

const bal = balance; // alias

// ─── Daily ──────────────────────────────────────────────────────────────────
const daily = async (ctx) => {
  const w = await getW(ctx.from.id);
  const now = new Date();
  if (w.lastDaily && now - w.lastDaily < 24 * 3600 * 1000) {
    const left = Math.ceil((24 * 3600 * 1000 - (now - w.lastDaily)) / 3600000);
    return safeReply(ctx, `⏳ Already claimed. Try again in <b>${left}h</b>.`);
  }
  const wasYesterday = w.lastDaily && now - w.lastDaily < 48 * 3600 * 1000;
  w.streak = wasYesterday ? w.streak + 1 : 1;
  const reward = 100 + Math.min(w.streak, 30) * 10;
  w.coins += reward;
  w.lastDaily = now;
  await w.save();
  await safeReply(ctx, `🎁 +<b>${reward}</b> coins (streak <b>${w.streak}</b>) → <b>${w.coins}</b> total`);
};

// ─── Weekly ─────────────────────────────────────────────────────────────────
const weekly = async (ctx) => {
  const w = await getW(ctx.from.id);
  const now = new Date();
  if (w.lastWeekly && now - w.lastWeekly < 7 * 24 * 3600 * 1000) {
    const left = Math.ceil((7 * 24 * 3600 * 1000 - (now - w.lastWeekly)) / (24 * 3600000));
    return safeReply(ctx, `⏳ Try again in <b>${left}d</b>.`);
  }
  w.coins += 1000;
  w.lastWeekly = now;
  await w.save();
  await safeReply(ctx, `🎁 +<b>1000</b> coins → <b>${w.coins}</b> total`);
};

// ─── Leaderboard ────────────────────────────────────────────────────────────
const leaderboard = async (ctx) => {
  const top = await Wallet.find().sort({ coins: -1 }).limit(10).lean();
  if (!top.length) return safeReply(ctx, 'No wallets yet.');
  const medals = ['🥇', '🥈', '🥉'];
  let txt = '🏆 <b>Top 10 Richest</b>\n┌─────────────────────\n';
  for (let i = 0; i < top.length; i++) {
    const icon = medals[i] || `${i + 1}.`;
    const name = top[i].firstName || `User ${top[i].userId}`;
    txt += `│ ${icon} ${name} — <b>${top[i].coins}</b> coins\n`;
  }
  txt += '└─────────────────────';
  await safeReply(ctx, txt);
};

// ─── Give ───────────────────────────────────────────────────────────────────
const give = async (ctx) => {
  const parts = (ctx.message.text || '').split(/\s+/).slice(1);
  const target = ctx.message.reply_to_message?.from;
  const amount = parseInt(parts[0], 10);
  if (!target || !amount || amount < 1)
    return safeReply(ctx, '❌ Reply to a user → <code>/give &lt;amount&gt;</code>');
  if (target.id === ctx.from.id) return safeReply(ctx, '❌ Cannot give to yourself.');
  const w = await getW(ctx.from.id);
  if (w.coins < amount) return safeReply(ctx, `❌ Not enough coins. You have <b>${w.coins}</b>.`);
  const w2 = await getW(target.id);
  w.coins -= amount; w2.coins += amount;
  await w.save(); await w2.save();
  await safeReply(ctx, `💸 ${mention(ctx.from)} gave <b>${amount}</b> coins to ${mention(target)}\n${mention(target)} now has <b>${w2.coins}</b> coins.`);
};

// ─── Kill (game) ────────────────────────────────────────────────────────────
const killGame = async (ctx) => {
  const target = ctx.message.reply_to_message?.from;
  if (!target) return safeReply(ctx, '❌ Reply to a user to kill them. 🗡️');
  if (target.id === ctx.from.id) return safeReply(ctx, '❌ You can\'t kill yourself! 😅');
  if (target.is_bot) return safeReply(ctx, '🤖 Bots cannot be killed.');

  const wTarget = await getW(target.id);
  const now = new Date();

  // Check protection
  if (wTarget.protectedUntil && wTarget.protectedUntil > now) {
    const left = formatDuration(Math.floor((wTarget.protectedUntil - now) / 1000));
    const gifUrl = await fetchKillGif();
    const text = `🛡️ ${mention(target)} is <b>protected</b>! Your attack was blocked.\nShield expires in <b>${left}</b>.`;
    try {
      if (gifUrl) return ctx.replyWithAnimation(gifUrl, { caption: text, parse_mode: 'HTML' });
    } catch {}
    return safeReply(ctx, text);
  }

  // Kill succeeds
  const wKiller = await getW(ctx.from.id);
  const reward = 100;
  wKiller.coins += reward;
  wKiller.kills = (wKiller.kills || 0) + 1;
  wTarget.deaths = (wTarget.deaths || 0) + 1;
  await wKiller.save();
  await wTarget.save();

  const gifUrl = await fetchKillGif();
  const text =
    `🗡️ ${mention(ctx.from)} <b>killed</b> ${mention(target)}!\n` +
    `💰 +<b>${reward}</b> coins reward → <b>${wKiller.coins}</b> total\n` +
    `🗡️ Total kills: <b>${wKiller.kills}</b>`;
  try {
    if (gifUrl) return ctx.replyWithAnimation(gifUrl, { caption: text, parse_mode: 'HTML' });
  } catch {}
  await safeReply(ctx, text);
};

// ─── Protect ────────────────────────────────────────────────────────────────
const protect = async (ctx) => {
  const arg = ((ctx.message.text || '').split(/\s+/)[1] || '').toLowerCase();
  const plans = {
    '1day': { cost: 300, days: 1 }, '1d': { cost: 300, days: 1 },
    '2day': { cost: 500, days: 2 }, '2d': { cost: 500, days: 2 },
  };
  const plan = plans[arg];
  const w = await getW(ctx.from.id);
  const now = new Date();

  // No plan specified — show status + menu
  if (!plan) {
    const isActive = w.protectedUntil && w.protectedUntil > now;
    const statusLine = isActive
      ? `🛡 <b>Your shield is active</b> — expires <b>${w.protectedUntil.toUTCString()}</b>\n` +
        `⏳ Time left: <b>${formatDuration(Math.floor((w.protectedUntil - now) / 1000))}</b>\n\n` +
        `You can claim a new protection plan once your current shield expires.`
      : `🛡 <b>You have no active shield.</b> Buy one below!\n\n` +
        `<code>/protect 1day</code> → <b>300 coins</b> (24 hours)\n` +
        `<code>/protect 2day</code> → <b>500 coins</b> (48 hours)`;
    return safeReply(ctx, `🛡 <b>Protection Shield</b>\n\n${statusLine}`);
  }

  // Block purchase if still protected — must wait for expiry to claim a new plan
  if (w.protectedUntil && w.protectedUntil > now) {
    const left = formatDuration(Math.floor((w.protectedUntil - now) / 1000));
    return safeReply(ctx,
      `🛡️ You already have an <b>active shield!</b>\n` +
      `Time left: <b>${left}</b>\n\n` +
      `You can buy a new protection plan once your current shield expires.`);
  }

  if (w.coins < plan.cost)
    return safeReply(ctx, `❌ Not enough coins! You need <b>${plan.cost}</b> but have <b>${w.coins}</b>.`);

  const newExpiry = new Date(now.getTime() + plan.days * 24 * 3600 * 1000);
  w.coins -= plan.cost;
  w.protectedUntil = newExpiry;
  await w.save();

  await safeReply(ctx,
    `🛡️ ${mention(ctx.from)} activated a <b>${plan.days}-day shield!</b>\n` +
    `Cost: <b>${plan.cost}</b> coins deducted\n` +
    `Remaining: <b>${w.coins}</b> coins\n` +
    `Shield expires: <b>${newExpiry.toUTCString()}</b>\n\n` +
    `<i>You can claim a new plan after this one expires.</i>`);
};

// ─── Rob ────────────────────────────────────────────────────────────────────
const rob = async (ctx) => {
  const parts = (ctx.message.text || '').split(/\s+/).slice(1);
  const amount = parseInt(parts[0], 10);
  const target = ctx.message.reply_to_message?.from;

  if (!target || !amount || amount < 1)
    return safeReply(ctx, '❌ Usage: reply to a user → <code>/rob &lt;amount&gt;</code>');
  if (target.id === ctx.from.id) return safeReply(ctx, '❌ Can\'t rob yourself!');
  if (target.is_bot) return safeReply(ctx, '🤖 Can\'t rob a bot.');
  if (amount > 10000) return safeReply(ctx, '❌ Max rob attempt is <b>10,000</b> coins.');

  const wTarget = await getW(target.id);
  const wRobber = await getW(ctx.from.id);

  // Check protection
  if (wTarget.protectedUntil && wTarget.protectedUntil > new Date()) {
    const left = formatDuration(Math.floor((wTarget.protectedUntil - Date.now()) / 1000));
    return safeReply(ctx,
      `🛡️ ${mention(target)} is <b>protected!</b> Rob attempt blocked.\nShield has <b>${left}</b> left.`);
  }

  if (wTarget.coins < amount) {
    // Failed rob — robber loses 100 coins
    const penalty = 100;
    wRobber.coins = Math.max(0, wRobber.coins - penalty);
    await wRobber.save();
    return safeReply(ctx,
      `❌ <b>Rob Failed!</b>\n` +
      `${mention(target)} only has <b>${wTarget.coins}</b> coins (you tried <b>${amount}</b>).\n` +
      `${mention(ctx.from)} lost <b>${penalty}</b> coins for the failed attempt.\n` +
      `Your balance: <b>${wRobber.coins}</b>`);
  }

  // Successful rob
  wTarget.coins -= amount;
  wRobber.coins += amount;
  await wTarget.save();
  await wRobber.save();

  await safeReply(ctx,
    `🦹 <b>Successful Robbery!</b>\n` +
    `${mention(ctx.from)} robbed <b>${amount}</b> coins from ${mention(target)}! 💰\n` +
    `${mention(ctx.from)}'s balance: <b>${wRobber.coins}</b>\n` +
    `${mention(target)}'s balance: <b>${wTarget.coins}</b>`);
};

module.exports = { balance, bal, daily, weekly, leaderboard, give, killGame, protect, rob };
