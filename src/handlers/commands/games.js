'use strict';

const fiveLetterWords = require('../../utils/dictionary');
const { Wallet } = require('../../models');
const { safeReply, mention } = require('../../utils/helpers');
const logger = require('../../utils/logger');
const config = require('../../config/index');
const { generateTrivia } = require('../../services/aiGameService');
const { logEvent } = require('../../services/loggingService');

const sessions = new Map();       // chatId -> { word, tries }
const triviaSessions = new Map(); // chatId -> { answer, expires }
const numberSessions = new Map();  // chatId -> { number, tries, max }

async function reward(userId, amount) {
  try {
    let w = await Wallet.findOne({ userId });
    if (!w) w = new Wallet({ userId });
    w.coins = (w.coins || 0) + amount;
    await w.save();
    return w.coins;
  } catch (e) {
    logger.warn(`wallet reward failed: ${e.message}`);
    return null;
  }
}

function wordList() {
  // dictionary may be a Set or an Array — support both
  return Array.isArray(fiveLetterWords) ? fiveLetterWords : [...fiveLetterWords];
}

function inDictionary(word) {
  if (fiveLetterWords instanceof Set) return fiveLetterWords.has(word);
  return wordList().includes(word);
}

function pickWord() {
  const arr = wordList();
  return arr[Math.floor(Math.random() * arr.length)];
}

function feedback(guess, target) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    if (guess[i] === target[i]) out.push('🟩');
    else if (target.includes(guess[i])) out.push('🟨');
    else out.push('⬛');
  }
  return out.join('');
}

// ── Word guess ────────────────────────────────────────────────────────────────

const wordguess = async (ctx) => {
  if (sessions.has(ctx.chat.id)) {
    return safeReply(ctx, '<tg-emoji emoji-id="5350447674971660988">🎮</tg-emoji> Ek game already chal raha hai! Guess bhejo: <code>/gamew apple</code> <tg-emoji emoji-id="5350447674971660988">🎮</tg-emoji>', { parse_mode: 'HTML' });
  }
  sessions.set(ctx.chat.id, { word: pickWord(), tries: 0 });
  await safeReply(ctx,
    `<tg-emoji emoji-id="5350447674971660988">🎮</tg-emoji> <b>Word Guess</b> started! <tg-emoji emoji-id="5350444080084033572">✨</tg-emoji>\n` +
    `Maine ek 5-letter word socha hai.\n\n` +
    `Guess karo: <code>/gamew crane</code>\n` +
    `🟩 sahi letter + jagah · 🟨 sahi letter · ⬛ nahi hai\n` +
    `Tries: <b>6</b> <tg-emoji emoji-id="6100435100422378325">🔥</tg-emoji>`, { parse_mode: 'HTML' });
};

const gamew = async (ctx) => {
  const guessWord = (ctx.message?.text || '').trim().split(/\s+/)[1]?.toLowerCase() || '';
  if (!/^[a-z]{5}$/.test(guessWord)) {
    return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Aise likho: <code>/gamew apple</code> (sirf 5 letters) <tg-emoji emoji-id="5215204871422093648">❌</tg-emoji>', { parse_mode: 'HTML' });
  }

  const sess = sessions.get(ctx.chat.id);
  if (!sess) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Pehle /wordguess se game start karo.', { parse_mode: 'HTML' });
  if (!inDictionary(guessWord)) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Ye word dictionary me nahi hai.', { parse_mode: 'HTML' });

  sess.tries += 1;
  const fb = feedback(guessWord, sess.word);

  if (guessWord === sess.word) {
    sessions.delete(ctx.chat.id);
    const coins = Math.max(50, 200 - sess.tries * 25);
    const total = await reward(ctx.from.id, coins);
    return safeReply(ctx,
      `${fb}\n<tg-emoji emoji-id="6129739490484294910">👑</tg-emoji> ${mention(ctx.from)} ne <b>${sess.tries}</b> tries me jeet liya! +<b>${coins}</b> <tg-emoji emoji-id="5215725958329282459">💵</tg-emoji>` +
      (total !== null ? ` (total <b>${total}</b>)` : '') + ` <tg-emoji emoji-id="6100233580556849589">🌟</tg-emoji>`, { parse_mode: 'HTML' });
  }

  if (sess.tries >= 6) {
    sessions.delete(ctx.chat.id);
    return safeReply(ctx, `${fb}\n<tg-emoji emoji-id="6156936361568901831">💀</tg-emoji> Tries khatam! Word tha <b>${sess.word}</b>. <tg-emoji emoji-id="6156936361568901831">💀</tg-emoji>`, { parse_mode: 'HTML' });
  }

  await safeReply(ctx, `${fb}\nTries: <b>${sess.tries}/6</b> <tg-emoji emoji-id="6100593065024562684">📊</tg-emoji>`, { parse_mode: 'HTML' });
};

// ── Number guess (/guess) ─────────────────────────────────────────────────────

const guess = async (ctx) => {
  const arg = (ctx.message?.text || '').trim().split(/\s+/)[1];
  const sess = numberSessions.get(ctx.chat.id);

  if (!arg) {
    if (sess) {
      return safeReply(ctx, `<tg-emoji emoji-id="5350447674971660988">🎮</tg-emoji> Game chal raha hai — 1 se ${sess.max} ke beech number guess karo: <code>/guess 42</code> <tg-emoji emoji-id="6285240160120477644">⏰</tg-emoji>`, { parse_mode: 'HTML' });
    }
    const max = 100;
    numberSessions.set(ctx.chat.id, { number: 1 + Math.floor(Math.random() * max), tries: 0, max });
    return safeReply(ctx,
      `<tg-emoji emoji-id="5350447674971660988">🎮</tg-emoji> <b>Number Guess</b> start! <tg-emoji emoji-id="5350444080084033572">✨</tg-emoji>\n` +
      `Maine 1 se ${max} ke beech ek number socha hai.\n` +
      `Guess karo: <code>/guess 42</code> — 7 tries milengi <tg-emoji emoji-id="6100233580556849589">🌟</tg-emoji>`, { parse_mode: 'HTML' });
  }

  if (!sess) return safeReply(ctx, '<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> Pehle <code>/guess</code> likho game start karne ke liye.', { parse_mode: 'HTML' });

  const n = parseInt(arg, 10);
  if (!Number.isFinite(n) || n < 1 || n > sess.max) {
    return safeReply(ctx, `<tg-emoji emoji-id="5215204871422093648">❌</tg-emoji> 1 se ${sess.max} ke beech ka number bhejo.`, { parse_mode: 'HTML' });
  }

  sess.tries += 1;

  if (n === sess.number) {
    numberSessions.delete(ctx.chat.id);
    const coins = Math.max(30, 150 - sess.tries * 15);
    const total = await reward(ctx.from.id, coins);
    return safeReply(ctx,
      `<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> Bilkul sahi! ${mention(ctx.from)} ne <b>${sess.tries}</b> tries me guess kiya. +<b>${coins}</b> <tg-emoji emoji-id="5215725958329282459">💵</tg-emoji>` +
      (total !== null ? ` (total <b>${total}</b>)` : '') + ` <tg-emoji emoji-id="6129739490484294910">👑</tg-emoji>`, { parse_mode: 'HTML' });
  }

  if (sess.tries >= 7) {
    numberSessions.delete(ctx.chat.id);
    return safeReply(ctx, `<tg-emoji emoji-id="6156936361568901831">💀</tg-emoji> Tries khatam! Number tha <b>${sess.number}</b>. <tg-emoji emoji-id="6156936361568901831">💀</tg-emoji>`, { parse_mode: 'HTML' });
  }

  const hint = n < sess.number ? '⬆️ Bada number try karo' : '⬇️ Chhota number try karo';
  await safeReply(ctx, `${hint} · Tries: <b>${sess.tries}/7</b> <tg-emoji emoji-id="6100593065024562684">📊</tg-emoji>`, { parse_mode: 'HTML' });
};

// ── Trivia ────────────────────────────────────────────────────────────────────

const QUESTIONS = [
  // Original 12
  { q: 'Capital of Japan?', a: 'tokyo' },
  { q: 'How many continents are there?', a: '7' },
  { q: 'Who wrote Naruto?', a: 'kishimoto' },
  { q: 'Largest planet in our solar system?', a: 'jupiter' },
  { q: 'Square root of 144?', a: '12' },
  { q: 'Which studio made Spirited Away?', a: 'ghibli' },
  { q: 'HTTP status code for "Not Found"?', a: '404' },
  { q: 'Currency of the UK?', a: 'pound' },
  { q: 'Chemical symbol for gold?', a: 'au' },
  { q: 'National animal of India?', a: 'tiger' },
  { q: 'How many players in a cricket team?', a: '11' },
  { q: 'Fastest land animal?', a: 'cheetah' },
  // 100 New Questions
  { q: 'What is the capital of France?', a: 'paris' },
  { q: 'What is the largest ocean on Earth?', a: 'pacific' },
  { q: 'Who painted the Mona Lisa?', a: 'da vinci' },
  { q: 'What is the hardest natural substance?', a: 'diamond' },
  { q: 'Which planet is known as the Red Planet?', a: 'mars' },
  { q: 'How many legs does a spider have?', a: '8' },
  { q: 'What is the chemical symbol for water?', a: 'h2o' },
  { q: 'In which country is the Taj Mahal located?', a: 'india' },
  { q: 'What is the capital of Australia?', a: 'canberra' },
  { q: 'Who is the main protagonist of One Piece?', a: 'luffy' },
  { q: 'What is the tallest mountain in the world?', a: 'everest' },
  { q: 'Which element has the atomic number 1?', a: 'hydrogen' },
  { q: 'What language is most widely spoken in Brazil?', a: 'portuguese' },
  { q: 'Who discovered penicillin?', a: 'fleming' },
  { q: 'What is the main ingredient in guacamole?', a: 'avocado' },
  { q: 'How many colors are in a rainbow?', a: '7' },
  { q: 'Which continent is the Sahara Desert on?', a: 'africa' },
  { q: 'What is the currency of Japan?', a: 'yen' },
  { q: 'Who wrote "Romeo and Juliet"?', a: 'shakespeare' },
  { q: 'What is the largest organ of the human body?', a: 'skin' },
  { q: 'In what year did the Titanic sink?', a: '1912' },
  { q: 'What is the national flower of Japan?', a: 'cherry blossom' },
  { q: 'Which bird is a universal symbol of peace?', a: 'dove' },
  { q: 'How many bones are in the adult human body?', a: '206' },
  { q: 'Which animal is known as the King of the Jungle?', a: 'lion' },
  { q: 'What is the chemical symbol for Oxygen?', a: 'o' },
  { q: 'Who was the first person to walk on the moon?', a: 'armstrong' },
  { q: 'What is the capital of Italy?', a: 'rome' },
  { q: 'How many hearts does an octopus have?', a: '3' },
  { q: 'Which country is home to the kangaroo?', a: 'australia' },
  { q: 'What do you call a baby goat?', a: 'kid' },
  { q: 'Which planet is closest to the Sun?', a: 'mercury' },
  { q: 'What is the largest mammal in the world?', a: 'blue whale' },
  { q: 'In Harry Potter, what is the name of Harry’s owl?', a: 'hedwig' },
  { q: 'What is the most consumed manufactured drink in the world?', a: 'tea' },
  { q: 'Who is the CEO of Tesla?', a: 'musk' },
  { q: 'What is the capital of Canada?', a: 'ottawa' },
  { q: 'What geometric shape is generally used for stop signs?', a: 'octagon' },
  { q: 'What is the name of the fairy in Peter Pan?', a: 'tinkerbell' },
  { q: 'What type of fish is Nemo?', a: 'clownfish' },
  { q: 'Which country gifted the Statue of Liberty to the USA?', a: 'france' },
  { q: 'What is the symbol for Iron on the periodic table?', a: 'fe' },
  { q: 'What is the highest-grossing anime film of all time?', a: 'demon slayer' },
  { q: 'Who is known as the "Father of Computers"?', a: 'babbage' },
  { q: 'What is the longest river in the world?', a: 'nile' },
  { q: 'How many days are in a leap year?', a: '366' },
  { q: 'What is the main gas found in the air we breathe?', a: 'nitrogen' },
  { q: 'Who played Jack in Titanic?', a: 'dicaprio' },
  { q: 'What is the capital of South Korea?', a: 'seoul' },
  { q: 'What do pandas primarily eat?', a: 'bamboo' },
  { q: 'How many strings does a standard guitar have?', a: '6' },
  { q: 'What is the freezing point of water in Celsius?', a: '0' },
  { q: 'Which planet has the most moons?', a: 'saturn' },
  { q: 'Who founded Microsoft?', a: 'gates' },
  { q: 'What is the capital of Egypt?', a: 'cairo' },
  { q: 'What does DNA stand for? (Just kidding, answer is: deoxyribonucleic acid)', a: 'dna' }, // simplified for one word if possible, let's keep it easy
  { q: 'Which animal is known for its black and white stripes?', a: 'zebra' },
  { q: 'How many states are there in the United States?', a: '50' },
  { q: 'What is the smallest prime number?', a: '2' },
  { q: 'Which part of the plant conducts photosynthesis?', a: 'leaf' },
  { q: 'What is the currency of the United States?', a: 'dollar' },
  { q: 'Who painted the Starry Night?', a: 'van gogh' },
  { q: 'What is the main language spoken in Argentina?', a: 'spanish' },
  { q: 'What is the largest desert in the world?', a: 'antarctic' },
  { q: 'What does "www" stand for in a website browser?', a: 'world wide web' },
  { q: 'What is the capital of Germany?', a: 'berlin' },
  { q: 'How many teeth does an adult human have?', a: '32' },
  { q: 'Who is the author of the Harry Potter series?', a: 'rowling' },
  { q: 'What is the most widely spoken language in the world?', a: 'mandarin' },
  { q: 'What is the primary ingredient in hummus?', a: 'chickpeas' },
  { q: 'Which US state is known as the Sunshine State?', a: 'florida' },
  { q: 'What is the capital of Russia?', a: 'moscow' },
  { q: 'How many rings make up the Olympic symbol?', a: '5' },
  { q: 'What is the chemical symbol for Silver?', a: 'ag' },
  { q: 'What is the study of stars and planets called?', a: 'astronomy' },
  { q: 'Which continent has the most countries?', a: 'africa' },
  { q: 'What do you call a group of wolves?', a: 'pack' },
  { q: 'What is the square root of 81?', a: '9' },
  { q: 'Who was the first President of the United States?', a: 'washington' },
  { q: 'What is the capital of Spain?', a: 'madrid' },
  { q: 'Which metal is liquid at room temperature?', a: 'mercury' },
  { q: 'What do caterpillars turn into?', a: 'butterflies' },
  { q: 'What is the largest country by area?', a: 'russia' },
  { q: 'How many zeros are in a million?', a: '6' },
  { q: 'What is the capital of China?', a: 'beijing' },
  { q: 'Which blood type is the universal donor?', a: 'o negative' },
  { q: 'What do bees collect from flowers?', a: 'nectar' },
  { q: 'What is the currency of India?', a: 'rupee' },
  { q: 'Who developed the theory of relativity?', a: 'einstein' },
  { q: 'What is the world’s largest island?', a: 'greenland' },
  { q: 'What is the chemical symbol for Sodium?', a: 'na' },
  { q: 'Which chess piece can only move diagonally?', a: 'bishop' },
  { q: 'What is the capital of Brazil?', a: 'brasilia' },
  { q: 'What is the fear of spiders called?', a: 'arachnophobia' },
  { q: 'Who invented the telephone?', a: 'bell' },
  { q: 'What is the boiling point of water in Celsius?', a: '100' },
  { q: 'Which animal is known to have a memory spanning decades?', a: 'elephant' },
  { q: 'What is the capital of the United Kingdom?', a: 'london' },
  { q: 'How many players are on a soccer team on the field?', a: '11' },
  { q: 'What is the main gas found in the sun?', a: 'hydrogen' }
];

const trivia = async (ctx) => {
  const fallback = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  const item = config.aiGamesEnabled ? (await generateTrivia() || fallback) : fallback;
  triviaSessions.set(ctx.chat.id, { answer: item.a, expires: Date.now() + 30_000 });
  logEvent('game', {
    chat: ctx.chat,
    actor: ctx.from,
    extra: `AI trivia started: ${item.q}`,
  }).catch(() => {});
  await safeReply(ctx,
    `<tg-emoji emoji-id="5370896319210595146">🤔</tg-emoji> <b>Trivia</b> <tg-emoji emoji-id="6100130376787694459">🔖</tg-emoji>\n${item.q}` +
    (item.hint ? `\n<i>Hint: ${item.hint}</i>` : '') +
    `\n\n<i>30 second me answer bhejo!</i> <tg-emoji emoji-id="6285240160120477644">⏰</tg-emoji>`, { parse_mode: 'HTML' });
};

async function triviaMiddleware(ctx, next) {
  try {
    const chatId = ctx.chat?.id;
    const sess = chatId !== undefined ? triviaSessions.get(chatId) : null;
    if (!sess) return next();

    if (Date.now() > sess.expires) {
      triviaSessions.delete(chatId);
      return next();
    }

    const text = (ctx.message?.text || '').toLowerCase().trim();
    if (!text || text.startsWith('/') || !ctx.from) return next();

    if (text.includes(sess.answer)) {
      triviaSessions.delete(chatId);
      const total = await reward(ctx.from.id, 25);
      await ctx.reply(
        `<tg-emoji emoji-id="6237651574588445185">✅</tg-emoji> ${mention(ctx.from)} ne sahi answer diya! +25 <tg-emoji emoji-id="5215725958329282459">💵</tg-emoji>` + (total !== null ? ` (total ${total})` : '') + ` <tg-emoji emoji-id="5350444080084033572">✨</tg-emoji>`,
        { parse_mode: 'HTML' }
      );
    }
  } catch (e) {
    logger.warn(`trivia middleware error: ${e.message}`);
  }
  return next();
}

module.exports = { wordguess, gamew, guess, trivia, triviaMiddleware };
