'use strict';

/**
 * Buttons: unicode emoji (Telegram inline buttons me custom emoji possible nahi).
 * Text/caption: premium emoji via <tg-emoji> + parse_mode 'HTML'.
 */

const ButtonStyle = Object.freeze({
  PRIMARY: 'primary',
  SUCCESS: 'success',
  DANGER: 'danger',
});

const STYLE_EMOJI = Object.freeze({
  [ButtonStyle.PRIMARY]: '🔵',
  [ButtonStyle.SUCCESS]: '🟢',
  [ButtonStyle.DANGER]: '🔴',
});

// key: [unicode emoji, premium emoji id]
const CATEGORY = Object.freeze({
  'Admin':         ['👑', '6129739490484294910'],
  'Bans':          ['⛔️', '5213415377593185638'],
  'Mutes':         ['🔇', '5350332462473944452'],
  'Warns':         ['⚠️', '6102938383456146362'],
  'Notes':         ['🔖', '6100130376787694459'],
  'Filters':       ['⚙️', '5350396951407895212'],
  'Greetings':     ['✨', '5350444080084033572'],
  'Rules':         ['💬', '5215538577496090960'],
  'Locks':         ['🛑', '6267262260243076354'],
  'Antiflood':     ['💧', '5373135805353041178'],
  'Blocklists':    ['❌', '5215204871422093648'],
  'Approval':      ['✅', '6237651574588445185'],
  'Pins':          ['📌', '5215486050046062421'],
  'Purges':        ['🔥', '6100435100422378325'],
  'Reports':       ['🚨', '5215504548470204229'],
  'Connects':      ['✈️', '5352629170465676759'],
  'Disable':       ['😶', '5460784938129322796'],
  'Logging':       ['📊', '6100593065024562684'],
  'Captcha':       ['🤔', '5370896319210595146'],
  'AntiRaid':      ['⚡️', '6082511510406436819'],
  'DDoS':          ['💀', '6156936361568901831'],
  'Protection':    ['👼', '6129518870899203008'],
  'Cleaning':      ['🌟', '6100233580556849589'],
  'Strict mode':   ['😈', '6129522839448984992'],
  'Topics':        ['🔔', '6100665125985851649'],
  'Federations':   ['🚀', '6129639980387015660'],
  'Misc':          ['🎁', '5215440433198413312'],
  'Economy':       ['💵', '5215725958329282459'],
  'Games':         ['🎮', '5350447674971660988'],
  'Anime':         ['🌸', '6172539951985464926'],
  'AI Chatbot':    ['👨‍🏫', '6271814813907685528'],
  'Privacy':       ['🫣', '6264539053408917059'],
  'Format':        ['✉️', '6264777724741556322'],
  'Import/Export': ['📹', '5215516393990005513'],
  'About':         ['❤️', '6266992763930158001'],
  // text-only decor
  'Title':         ['✨', '5350444080084033572'],
  'Arrow':         ['⚡️', '6082511510406436819'],
});

function getStyleMap() {
  const styles = [ButtonStyle.PRIMARY, ButtonStyle.SUCCESS, ButtonStyle.DANGER];
  for (let i = styles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [styles[i], styles[j]] = [styles[j], styles[i]];
  }
  return { 1: styles[0], 2: styles[1], 3: styles[2] };
}

/** Button label: "👑 Aᴅᴍɪɴ". Pass raw key when the label is font-styled. */
function styledLabel(label, style, key) {
  const entry = CATEGORY[String(key != null ? key : label)];
  const emoji = (entry && entry[0]) || STYLE_EMOJI[style] || STYLE_EMOJI[ButtonStyle.PRIMARY];
  return `${emoji} ${String(label)}`;
}

/** Premium emoji for message TEXT only (needs parse_mode: 'HTML'). */
function premiumEmoji(key) {
  const entry = CATEGORY[String(key)];
  if (!entry) return '';
  return `<tg-emoji emoji-id="${entry[1]}">${entry[0]}</tg-emoji>`;
}

module.exports = {
  ButtonStyle, STYLE_EMOJI, CATEGORY,
  getStyleMap, styledLabel, premiumEmoji,
};
