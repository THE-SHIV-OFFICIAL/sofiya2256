const { mention, safeReply, escapeHtml } = require('../../utils/helpers');

// Reaction GIFs are pulled from several free sources at random, so the same
// command never feels repetitive and is not tied to one anime library.
const PROVIDERS = [
  {
    name: 'nekos.best',
    supports: ['hug', 'pat', 'slap', 'kiss', 'poke', 'bite', 'cuddle', 'tickle', 'wave', 'kill', 'happy', 'dance', 'smile', 'wink', 'highfive', 'handhold', 'laugh', 'cry'],
    url: (a) => `https://nekos.best/api/v2/${a}?amount=1`,
    pick: (d) => d?.results?.[0]?.url || null,
  },
  {
    name: 'waifu.pics',
    supports: ['hug', 'pat', 'slap', 'kiss', 'poke', 'bite', 'cuddle', 'wave', 'kill', 'happy', 'dance', 'smile', 'wink', 'highfive', 'handhold', 'cry', 'bonk', 'glomp'],
    url: (a) => `https://api.waifu.pics/sfw/${a}`,
    pick: (d) => d?.url || null,
  },
  {
    name: 'otakugifs',
    supports: ['hug', 'pat', 'slap', 'kiss', 'poke', 'bite', 'cuddle', 'tickle', 'wave', 'kill', 'happy', 'dance', 'smile', 'wink', 'highfive', 'handhold', 'cry', 'laugh', 'love'],
    url: (a) => `https://api.otakugifs.xyz/gif?reaction=${a}&format=gif`,
    pick: (d) => d?.url || null,
  },
];

const ACTION_MESSAGES = {
  hug:  { self: '{actor} hugged themselves <tg-emoji emoji-id="6129772480128097710">😊</tg-emoji>', other: '{actor} hugged {target} <tg-emoji emoji-id="6129772480128097710">😊</tg-emoji>' },
  pat:  { self: '{actor} patted themselves <tg-emoji emoji-id="5305560185782163868">🥺</tg-emoji>', other: '{actor} patted {target} <tg-emoji emoji-id="5305560185782163868">🥺</tg-emoji>' },
  slap: { self: '{actor} slapped themselves 😵', other: '{actor} slapped {target}! <tg-emoji emoji-id="6172440862794978831">😡</tg-emoji>' },
  kiss: { self: '{actor} kissed the air 😘', other: '{actor} kissed {target} <tg-emoji emoji-id="6264987349210372087">💋</tg-emoji>' },
  poke: { self: '{actor} poked themselves 😶', other: '{actor} poked {target} 👉' },
  bite: { self: '{actor} bit themselves 😅', other: '{actor} bit {target}! <tg-emoji emoji-id="6129522839448984992">😈</tg-emoji>' },
  cuddle: { self: '{actor} cuddled a pillow 🛌', other: '{actor} cuddled {target} <tg-emoji emoji-id="5463068305952630005">💕</tg-emoji>' },
  tickle: { self: '{actor} tickled themselves 😂', other: '{actor} tickled {target}! <tg-emoji emoji-id="6267086316907795595">🤣</tg-emoji>' },
  wave: { self: '{actor} waved at nobody 👋', other: '{actor} waved at {target} 👋' },
  love: { self: '{actor} is feeling the love <tg-emoji emoji-id="6266992763930158001">❤️</tg-emoji>', other: '{actor} sent love to {target} <tg-emoji emoji-id="6266992763930158001">❤️</tg-emoji>' },
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchFrom(provider, action) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(provider.url(action), { signal: controller.signal });
    if (!res.ok) return null;
    return provider.pick(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Random provider order every time — different look on every command.
async function fetchGif(action) {
  const candidates = shuffle(PROVIDERS.filter((p) => p.supports.includes(action)));
  for (const p of candidates) {
    const url = await fetchFrom(p, action);
    if (url) return url;
  }
  return null;
}

function makeAction(action) {
  return async (ctx) => {
    const actor = ctx.from;
    const target = ctx.message.reply_to_message?.from;
    const tpl = ACTION_MESSAGES[action] || { self: `{actor} used /${action}`, other: `{actor} → {target}` };
    const text = target
      ? tpl.other.replace('{actor}', mention(actor)).replace('{target}', mention(target))
      : tpl.self.replace('{actor}', mention(actor));

    const gifUrl = await fetchGif(action);
    try {
      if (gifUrl) {
        await ctx.replyWithAnimation(gifUrl, { caption: text, parse_mode: 'HTML' });
      } else {
        await safeReply(ctx, text, { parse_mode: 'HTML' });
      }
    } catch {
      await safeReply(ctx, text, { parse_mode: 'HTML' });
    }
  };
}

// 8ball answers
const BALL_ANSWERS = [
  '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> It is certain.', 
  '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> It is decidedly so.', 
  '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Without a doubt.',
  '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Yes, definitely.', 
  '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> You may rely on it.', 
  '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> As I see it, yes.',
  '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Most likely.', 
  '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Outlook good.', 
  '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Yes.', 
  '<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Signs point to yes.',
  '<tg-emoji emoji-id="5215351548850218245">⚠️</tg-emoji> Reply hazy, try again.', 
  '<tg-emoji emoji-id="5215351548850218245">⚠️</tg-emoji> Ask again later.', 
  '<tg-emoji emoji-id="5215351548850218245">⚠️</tg-emoji> Better not tell you now.',
  '<tg-emoji emoji-id="5215351548850218245">⚠️</tg-emoji> Cannot predict now.', 
  '<tg-emoji emoji-id="5215351548850218245">⚠️</tg-emoji> Concentrate and ask again.',
  '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Don\'t count on it.', 
  '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> My reply is no.', 
  '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> My sources say no.',
  '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Outlook not so good.', 
  '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Very doubtful.',
];

const eightball = async (ctx) => {
  const q = (ctx.message.text || '').split(/\s+/).slice(1).join(' ').trim();
  if (!q) return safeReply(ctx, '<tg-emoji emoji-id="5370896319210595146">🤔</tg-emoji> Ask a question! e.g. <code>/8ball Will I be rich?</code>', { parse_mode: 'HTML' });
  const ans = BALL_ANSWERS[Math.floor(Math.random() * BALL_ANSWERS.length)];
  await safeReply(ctx, `<tg-emoji emoji-id="6100233580556849589">🌟</tg-emoji> <b>Question:</b> ${escapeHtml(q)}\n<b>Answer:</b> ${ans}`, { parse_mode: 'HTML' });
};

// Ship meter
const ship = async (ctx) => {
  const parts = (ctx.message.text || '').trim().split(/\s+/);
  const t = ctx.message.reply_to_message?.from;
  let u1 = ctx.from;
  let u2 = t;
  // /ship @user @user2 (from mentions or reply)
  if (!u2) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Reply to a user: <code>/ship</code> (reply to someone)', { parse_mode: 'HTML' });

  const hash = (Math.abs((u1.id * 31 + u2.id * 7) % 100));
  const score = hash;
  const bar = '█'.repeat(Math.floor(score / 10)) + '░'.repeat(10 - Math.floor(score / 10));
  const label =
    score >= 90 ? '<tg-emoji emoji-id="6127558265573218459">💘</tg-emoji> Soulmates!' :
    score >= 70 ? '<tg-emoji emoji-id="5463068305952630005">💕</tg-emoji> Great match!' :
    score >= 50 ? '<tg-emoji emoji-id="5463408561851755633">🩷</tg-emoji> Pretty good!' :
    score >= 30 ? '<tg-emoji emoji-id="5370896319210595146">🤔</tg-emoji> Just friends?' :
    score >= 10 ? '<tg-emoji emoji-id="5188663549785828674">💔</tg-emoji> Meh...' :
    '<tg-emoji emoji-id="6100235418802852265">😳</tg-emoji> Run away!';
  await safeReply(ctx,
    `<tg-emoji emoji-id="5463068305952630005">💕</tg-emoji> <b>Ship Meter</b>\n` +
    `${mention(u1)} <tg-emoji emoji-id="6266992763930158001">❤️</tg-emoji> ${mention(u2)}\n\n` +
    `[${bar}] <b>${score}%</b>\n` +
    `${label}`, { parse_mode: 'HTML' });
};

// Truth or Dare (Premium Emoji Edition)
const TRUTHS = [
  '<tg-emoji emoji-id="6100235418802852265">😳</tg-emoji> What is the most embarrassing thing you\'ve ever done? <tg-emoji emoji-id="6264539053408917059">🫣</tg-emoji>',
  '<tg-emoji emoji-id="5463068305952630005">💕</tg-emoji> Who was your first crush? <tg-emoji emoji-id="5305560185782163868">🥺</tg-emoji>',
  '<tg-emoji emoji-id="6129522839448984992">😈</tg-emoji> What\'s the biggest lie you\'ve ever told? <tg-emoji emoji-id="5460784938129322796">😶</tg-emoji>',
  '<tg-emoji emoji-id="6264539053408917059">🫣</tg-emoji> Have you ever cheated on a test? <tg-emoji emoji-id="6156936361568901831">💀</tg-emoji>',
  '<tg-emoji emoji-id="6100235418802852265">😳</tg-emoji> What is your biggest fear? <tg-emoji emoji-id="6100225798076110296">👹</tg-emoji>',
  '<tg-emoji emoji-id="6129518870899203008">👼</tg-emoji> What is the most childish thing you still do? <tg-emoji emoji-id="5465225096794765557">😂</tg-emoji>',
  '<tg-emoji emoji-id="6098243451625673394">🙄</tg-emoji> What\'s the most annoying habit you have? <tg-emoji emoji-id="6266770301804091777">💩</tg-emoji>',
  '<tg-emoji emoji-id="6156936361568901831">💀</tg-emoji> Have you ever ghosted someone? Why? <tg-emoji emoji-id="5460784938129322796">😶</tg-emoji>',
  '<tg-emoji emoji-id="6264777724741556322">✉️</tg-emoji> What\'s your most embarrassing text to the wrong person? <tg-emoji emoji-id="5465442336240595307">😭</tg-emoji>',
  '<tg-emoji emoji-id="5460784938129322796">😶</tg-emoji> What\'s one secret you\'ve never told anyone? <tg-emoji emoji-id="6100233580556849589">🌟</tg-emoji>',
  '<tg-emoji emoji-id="5188663549785828674">💔</tg-emoji> What was your worst date ever? <tg-emoji emoji-id="6156936361568901831">💀</tg-emoji>',
  '<tg-emoji emoji-id="5370896319210595146">🤔</tg-emoji> If you could change one thing about yourself, what would it be? <tg-emoji emoji-id="5350444080084033572">✨</tg-emoji>',
  '<tg-emoji emoji-id="6172440862794978831">😡</tg-emoji> What\'s the meanest thing you\'ve ever said to someone? <tg-emoji emoji-id="6129522839448984992">😈</tg-emoji>',
  '<tg-emoji emoji-id="6264987349210372087">💋</tg-emoji> Have you ever practiced kissing in a mirror? <tg-emoji emoji-id="6266909437269644629">😆</tg-emoji>',
  '<tg-emoji emoji-id="5350520371588112368">🛌</tg-emoji> What is the weirdest dream you\'ve ever had? <tg-emoji emoji-id="6100233580556849589">🌟</tg-emoji>',
  '<tg-emoji emoji-id="6264539053408917059">🫣</tg-emoji> Have you ever stalked an ex on social media? <tg-emoji emoji-id="6156936361568901831">💀</tg-emoji>',
  '<tg-emoji emoji-id="5460784938129322796">😶</tg-emoji> What\'s a secret you kept from your parents? <tg-emoji emoji-id="6100235418802852265">😳</tg-emoji>',
  '<tg-emoji emoji-id="6156936361568901831">💀</tg-emoji> Who in this group do you think would survive a zombie apocalypse? <tg-emoji emoji-id="6129739490484294910">👑</tg-emoji>',
  '<tg-emoji emoji-id="5373135805353041178">💧</tg-emoji> Have you ever peed in a swimming pool? <tg-emoji emoji-id="5465225096794765557">😂</tg-emoji>',
  '<tg-emoji emoji-id="6100233580556849589">🌟</tg-emoji> What\'s the most useless talent you have? <tg-emoji emoji-id="6132195782280879053">😛</tg-emoji>',
  '<tg-emoji emoji-id="5215538577496090960">💬</tg-emoji> What is a rumor that went around about you? <tg-emoji emoji-id="6098243451625673394">🙄</tg-emoji>',
  '<tg-emoji emoji-id="6102938383456146362">⚠️</tg-emoji> Have you ever pretended to be sick to get out of something? <tg-emoji emoji-id="6129522839448984992">😈</tg-emoji>',
  '<tg-emoji emoji-id="5350396951407895212">⚙️</tg-emoji> If you had to delete all but three apps from your phone, what would they be? <tg-emoji emoji-id="5370896319210595146">🤔</tg-emoji>'
];

const DARES = [
  '<tg-emoji emoji-id="5212920584475782268">🎙</tg-emoji> Send a voice message saying "I love you" to the last person you texted. <tg-emoji emoji-id="6266992763930158001">❤️</tg-emoji>',
  '<tg-emoji emoji-id="5215516393990005513">📹</tg-emoji> Change your profile picture to something silly for the next hour. <tg-emoji emoji-id="6132195782280879053">😛</tg-emoji>',
  '<tg-emoji emoji-id="5215538577496090960">💬</tg-emoji> Compliment every person in this chat with a genuine compliment. <tg-emoji emoji-id="5350444080084033572">✨</tg-emoji>',
  '<tg-emoji emoji-id="5215516393990005513">📹</tg-emoji> Post the 5th photo in your gallery right now. <tg-emoji emoji-id="6264539053408917059">🫣</tg-emoji>',
  '<tg-emoji emoji-id="6264777724741556322">✉️</tg-emoji> Write a love poem about the last person who messaged you. <tg-emoji emoji-id="6127558265573218459">💘</tg-emoji>',
  '<tg-emoji emoji-id="6266770301804091777">💩</tg-emoji> Set your status to "I smell like cheese" for 30 minutes. <tg-emoji emoji-id="6267086316907795595">🤣</tg-emoji>',
  '<tg-emoji emoji-id="6100186361686401862">😁</tg-emoji> Tell a joke that everyone will find cringy. <tg-emoji emoji-id="6156936361568901831">💀</tg-emoji>',
  '<tg-emoji emoji-id="6100435100422378325">🔥</tg-emoji> Do 10 push-ups and send a selfie as proof. <tg-emoji emoji-id="5215516393990005513">📹</tg-emoji>',
  '<tg-emoji emoji-id="5212920584475782268">🎙</tg-emoji> Send a voice message while pretending to be an anime character. <tg-emoji emoji-id="6172539951985464926">🌸</tg-emoji>',
  '<tg-emoji emoji-id="6264777724741556322">✉️</tg-emoji> Text "I lost a bet" to the first contact in your phone. <tg-emoji emoji-id="5465442336240595307">😭</tg-emoji>',
  '<tg-emoji emoji-id="6264539053408917059">🫣</tg-emoji> Confess something you\'ve never told the group. <tg-emoji emoji-id="6262633131606546436">💥</tg-emoji>',
  '<tg-emoji emoji-id="6129522839448984992">😈</tg-emoji> Let another person in the group send a text to anyone in your contacts. <tg-emoji emoji-id="6156936361568901831">💀</tg-emoji>',
  '<tg-emoji emoji-id="5212920584475782268">🎙</tg-emoji> Speak in an accent of the group\'s choosing for the next 10 minutes. <tg-emoji emoji-id="6132195782280879053">😛</tg-emoji>',
  '<tg-emoji emoji-id="6267086316907795595">🤣</tg-emoji> Do your best impression of another person in this chat. <tg-emoji emoji-id="5465225096794765557">😂</tg-emoji>',
  '<tg-emoji emoji-id="5212920584475782268">🎙</tg-emoji> Send a voice note of yourself singing the chorus of your favorite song. <tg-emoji emoji-id="6172183400980420163">🎶</tg-emoji>',
  '<tg-emoji emoji-id="5215516393990005513">📹</tg-emoji> Show the last screenshot you took on your phone. <tg-emoji emoji-id="6264539053408917059">🫣</tg-emoji>',
  '<tg-emoji emoji-id="6264777724741556322">✉️</tg-emoji> Text your crush and tell them you like them (or send them a funny meme if you don\'t have one). <tg-emoji emoji-id="6127558265573218459">💘</tg-emoji>',
  '<tg-emoji emoji-id="5465225096794765557">😂</tg-emoji> Act like a dog for the next 2 minutes. <tg-emoji emoji-id="6156936361568901831">💀</tg-emoji>',
  '<tg-emoji emoji-id="5215516393990005513">📹</tg-emoji> Try to juggle 3 items of the group\'s choosing (send a video/gif). <tg-emoji emoji-id="6267086316907795595">🤣</tg-emoji>',
  '<tg-emoji emoji-id="5465225096794765557">😂</tg-emoji> Type your next 5 messages using only your nose. <tg-emoji emoji-id="6100233580556849589">🌟</tg-emoji>',
  '<tg-emoji emoji-id="5215486050046062421">📌</tg-emoji> Reply to the oldest message in this chat you can find with "I completely agree." <tg-emoji emoji-id="6267225207560214192">✔️</tg-emoji>'
];

const truth = async (ctx) => {
  const q = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
  await safeReply(ctx, `<tg-emoji emoji-id="5370896319210595146">🤔</tg-emoji> <b>Truth</b> for ${mention(ctx.from)}:\n\n${q}`, { parse_mode: 'HTML' });
};

const dare = async (ctx) => {
  const d = DARES[Math.floor(Math.random() * DARES.length)];
  await safeReply(ctx, `<tg-emoji emoji-id="6129522839448984992">😈</tg-emoji> <b>Dare</b> for ${mention(ctx.from)}:\n\n${d}`, { parse_mode: 'HTML' });
};

const truthordare = async (ctx) => {
  const pick = Math.random() < 0.5 ? 'truth' : 'dare';
  if (pick === 'truth') return truth(ctx);
  return dare(ctx);
};

// Sticker steal
const steal = async (ctx) => {
  const msg = ctx.message.reply_to_message;
  if (!msg?.sticker) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Reply to a <b>sticker</b> to steal it.', { parse_mode: 'HTML' });
  const s = msg.sticker;
  try {
    const link = await ctx.telegram.getFileLink(s.file_id);
    await ctx.reply(
      `<tg-emoji emoji-id="5215516393990005513">📹</tg-emoji> <b>Sticker stolen!</b>\n` +
      `Set: <code>${s.set_name || 'unknown'}</code>\n` +
      `Emoji: ${s.emoji || '?'}\n` +
      `<a href="${link.href}">Download file</a>`,
      { parse_mode: 'HTML' });
    await ctx.replyWithSticker(s.file_id);
  } catch (e) {
    await safeReply(ctx, `<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Could not steal sticker: ${e.description || e.message}`, { parse_mode: 'HTML' });
  }
};

module.exports = {
  hug: makeAction('hug'),
  pat: makeAction('pat'),
  slap: makeAction('slap'),
  kiss: makeAction('kiss'),
  poke: makeAction('poke'),
  bite: makeAction('bite'),
  cuddle: makeAction('cuddle'),
  tickle: makeAction('tickle'),
  wave: makeAction('wave'),
  love: makeAction('love'),
  eightball,
  ship,
  truth,
  dare,
  truthordare,
  steal,
};
