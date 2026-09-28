require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./config/index');
const logger = require('./utils/logger');

require('./models/index');

const startCommand = require('./handlers/commands/start');
const handleCallbacks = require('./handlers/callbacks');
const aiModeration = require('./handlers/moderation');
const chatbotModule = require('./handlers/commands/chatbot');
const chatbotHandler = chatbotModule.chatbotHandler;

const bans = require('./handlers/commands/bans');
const mutes = require('./handlers/commands/mutes');
const warnings = require('./handlers/commands/warnings');
const adminCmds = require('./handlers/commands/admin');
const notes = require('./handlers/commands/notes');
const filters = require('./handlers/commands/filters');
const rulesH = require('./handlers/commands/rules');
const greetings = require('./handlers/commands/greetings');
const purges = require('./handlers/commands/purges');
const pins = require('./handlers/commands/pins');
const locks = require('./handlers/commands/locks');
const antiflood = require('./handlers/commands/antiflood');
const blocklists = require('./handlers/commands/blocklists');
const approval = require('./handlers/commands/approval');
const misc = require('./handlers/commands/misc');
const disabling = require('./handlers/commands/disable');
const reportsH = require('./handlers/commands/reports');
const loggingH = require('./handlers/commands/logging');
const connections = require('./handlers/commands/connections');
const captcha = require('./handlers/commands/captcha');
const antiraid = require('./handlers/commands/antiraid');
const cleaning = require('./handlers/commands/cleaning');
const topicsH = require('./handlers/commands/topics');
const federations = require('./handlers/commands/federations');
const economy = require('./handlers/commands/economy');
const games    = require('./handlers/commands/games');
const wordseek = require('./handlers/commands/wordseek');
const anime = require('./handlers/commands/anime');
const extras = require('./handlers/commands/extras');
const emojiCommands = require('./handlers/commands/emoji');
const ownerCmds = require('./handlers/commands/owner');
const linkprotect = require('./handlers/commands/linkprotect');
const ddos = require('./handlers/commands/ddos');
const ddosProtection = require('./services/ddosProtectionService');
const memberEvents = require('./handlers/memberEvents');
const { stripStandardEmoji } = require('./utils/text');
const isAdmin = require('./middleware/admin');
const track = require('./middleware/track');
const { init: initLogger, logError } = require('./services/loggingService');

if (!config.botToken) {
  logger.error('❌ BOT_TOKEN is missing.');
  process.exit(1);
}

const bot = new Telegraf(config.botToken, { handlerTimeout: 90_000 });

// ------------------ MIDDLEWARES (order matters) ------------------
// Keep outgoing text consistent: normal Unicode emoji are removed globally.
// Configured Telegram custom-emoji HTML entities are not affected.
bot.use((ctx, next) => {
  if (ctx.reply) {
    const reply = ctx.reply.bind(ctx);
    ctx.reply = (text, extra) => reply(stripStandardEmoji(text), extra);
  }
  if (ctx.replyWithPhoto) {
    const replyWithPhoto = ctx.replyWithPhoto.bind(ctx);
    ctx.replyWithPhoto = (photo, extra = {}) => replyWithPhoto(photo, {
      ...extra,
      ...(extra.caption ? { caption: stripStandardEmoji(extra.caption) } : {}),
    });
  }
  return next();
});
bot.use(isAdmin);                                  // sets ctx.isAdmin / ctx.isOwner
bot.use(track);                                    // remember users & groups for /broadcast
bot.use(ddosProtection.ddosMiddleware);             // burst, mass-join and VC invite protection
bot.use(disabling.disabledMiddleware);             // /disable command gate
bot.use(captcha.captchaJoinHandler);               // CAPTCHA on join
bot.use(antiraid.antiRaidJoinMiddleware);          // anti-raid on join
bot.use(federations.fedJoinCheck);                 // fed-ban on join
bot.use(greetings.newMemberHandler);               // welcomes
bot.use(greetings.leftMemberHandler);              // goodbyes
bot.use(greetings.cleanServiceMiddleware);         // clean service msgs
bot.use(pins.antiChannelPinMiddleware);            // anti-channel-pin
bot.use(locks.lockMiddleware);                     // locks
bot.use(blocklists.blacklistMiddleware);           // blocklists
bot.use(antiflood.antifloodMiddleware);            // antiflood
bot.use(linkprotect.linkProtectMiddleware);         // link protection
bot.use(aiModeration);                             // NVIDIA AI scan
bot.use(games.triviaMiddleware);                   // trivia answers
bot.use(wordseek.wordseekMiddleware);              // wordseek word detection
bot.use(notes.hashtagMiddleware);                  // #notename
bot.use(filters.filterMiddleware);                 // text filters
bot.use(cleaning.cleanCommandMiddleware);          // delete commands after run

// Membership updates carry the actor who added/removed a user. The service
// message handler is kept as a fallback for Telegram configurations where
// chat_member updates are not delivered.
bot.on('chat_member', ddosProtection.chatMemberHandler);
bot.on('chat_member', memberEvents.chatMemberHandler);
bot.on('my_chat_member', memberEvents.botStatusHandler);
bot.on('message', memberEvents.serviceMessageHandler);

// ------------------ COMMANDS ------------------
bot.start(startCommand);
bot.help(async (ctx) => {
  const { Markup } = require('telegraf');
  const { ff } = require('./utils/font');
  const { getStyleMap, styledLabel, premiumEmoji } = require('./utils/buttonStyles');
  const styles = getStyleMap();
  const button = (label, data, slot = 1) =>
    Markup.button.callback(styledLabel(ff(label), styles[slot], label), data);
  const helpTitle =
    `<blockquote>` +
    `╔══════════════════════╗\n` +
    `║  ${premiumEmoji('Title')}  <b>${ff('Sofiya Commands')}</b>  ${premiumEmoji('Title')}  ║\n` +
    `╚══════════════════════╝\n\n` +
    `sєℓєcт α cατєɢσяყ вєℓσω ${premiumEmoji('Arrow')}` +
    `</blockquote>`;
  const kb = Markup.inlineKeyboard([
    [button('Admin', 'help_admin', 1), button('Bans', 'help_bans', 3), button('Mutes', 'help_mutes', 3)],
    [button('Warns', 'help_warns', 3), button('Notes', 'help_notes', 1), button('Filters', 'help_filters', 2)],
    [button('Greetings', 'help_greet', 2), button('Rules', 'help_rules', 1), button('Locks', 'help_locks', 3)],
    [button('Antiflood', 'help_flood', 2), button('Blocklists', 'help_black', 3), button('Approval', 'help_appr', 2)],
    [button('Pins', 'help_pins', 1), button('Purges', 'help_purges', 3), button('Reports', 'help_reports', 3)],
    [button('Connects', 'help_conn', 1), button('Disable', 'help_dis', 1), button('Logging', 'help_log', 1)],
    [button('Captcha', 'help_captcha', 2), button('AntiRaid', 'help_raid', 3), button('DDoS', 'help_ddos', 3)],
    [button('Protection', 'help_protect', 2), button('Cleaning', 'help_clean', 1), button('Strict mode', 'help_strict', 1)],
    [button('Topics', 'help_topics', 1), button('Federations', 'help_fed', 1), button('Misc', 'help_misc', 1)],
    [button('Economy', 'help_eco', 2), button('Games', 'help_games', 2), button('Anime', 'help_anime', 1)],
    [button('AI Chatbot', 'help_ai', 2), button('Privacy', 'help_priv', 1), button('Format', 'help_fmt', 1)],
    [button('Import/Export', 'help_io', 1), button('About', 'about', 1)],
  ]);
  await ctx.reply(helpTitle, { parse_mode: 'HTML', ...kb });
});

// Bans
bot.command('ban', bans.ban);
bot.command('sban', bans.sban);
bot.command('dban', bans.dban);
bot.command('tban', bans.tban);
bot.command('unban', bans.unban);
bot.command('kick', bans.kick);
bot.command('skick', bans.skick);
bot.command('kickme', bans.kickme);
bot.command('banme', bans.banme);

// Mutes
bot.command('mute', mutes.mute);
bot.command('smute', mutes.smute);
bot.command('dmute', mutes.dmute);
bot.command('tmute', mutes.tmute);
bot.command('unmute', mutes.unmute);

// Warnings
bot.command('warn', warnings.warn);
bot.command('swarn', warnings.swarn);
bot.command('dwarn', warnings.dwarn);
bot.command('warns', warnings.warns);
bot.command('resetwarns', warnings.resetwarns);
bot.command('rmwarn', warnings.rmwarn);
bot.command('setwarnlimit', warnings.setwarnlimit);
bot.command('warnmode', warnings.warnmode);

// Admin
bot.command('promote', adminCmds.promote);
bot.command('fullpromote', adminCmds.fullpromote);
bot.command('demote', adminCmds.demote);
bot.command('title', adminCmds.title);
bot.command(['adminlist', 'admins'], adminCmds.adminlist);
bot.command(['invitelink', 'link'], adminCmds.invitelink);
bot.command('settitle', adminCmds.settitle);
bot.command('setdescription', adminCmds.setdescription);
bot.command('setchatphoto', adminCmds.setchatphoto);

// Notes
bot.command('save', notes.save);
bot.command('clear', notes.clear);
bot.command('clearall', notes.clearall);
bot.command('notes', notes.notes);
bot.command('get', notes.get);

// Filters
bot.command('filter', filters.filter);
bot.command('stop', filters.stop);
bot.command('stopall', filters.stopall);
bot.command('filters', filters.filters);

// Rules
bot.command('setrules', rulesH.setrules);
bot.command('clearrules', rulesH.clearrules);
bot.command(['rules', 'rule'], rulesH.rules);
bot.command('privaterules', rulesH.privaterules);

// Greetings
bot.command('setwelcome', greetings.setwelcome);
bot.command('resetwelcome', greetings.resetwelcome);
bot.command('welcome', greetings.welcome);
bot.command('cleanwelcome', greetings.cleanwelcome);
bot.command('setgoodbye', greetings.setgoodbye);
bot.command('resetgoodbye', greetings.resetgoodbye);
bot.command('goodbye', greetings.goodbye);
bot.command('cleanservice', greetings.cleanservice);

// Purges
bot.command('purge', purges.purge);
bot.command('del', purges.del);
bot.command('purgefrom', purges.purgefrom);
bot.command('purgeto', purges.purgeto);

// Pins
bot.command('pin', pins.pin);
bot.command('unpin', pins.unpin);
bot.command('unpinall', pins.unpinall);
bot.command('antichannelpin', pins.antichannelpin);

// Locks
bot.command('lock', locks.lock);
bot.command('unlock', locks.unlock);
bot.command('locks', locks.locks);
bot.command('locktypes', locks.locktypes);

// Antiflood
bot.command('setflood', antiflood.setflood);
bot.command('flood', antiflood.flood);
bot.command('floodmode', antiflood.floodmode);

// Blocklists
bot.command(['addblacklist', 'blacklistadd'], blocklists.addblacklist);
bot.command(['rmblacklist', 'blacklistrm'], blocklists.rmblacklist);
bot.command(['blacklist', 'blocklist'], blocklists.blacklist);
bot.command(['blacklistmode', 'blocklistmode'], blocklists.blacklistmode);

// Approval
bot.command('approve', approval.approve);
bot.command('unapprove', approval.unapprove);
bot.command('approval', approval.approval);
bot.command('approved', approval.approved);
bot.command('unapproveall', approval.unapproveall);

// Link Protection
bot.command('linkprotect', linkprotect.linkprotect);

// Misc
bot.command('id', misc.id);
bot.command('info', misc.info);
bot.command('ping', misc.ping);
bot.command('runs', misc.runs);
bot.command('echo', misc.echo);
bot.command('stats', misc.stats);

// Disabling
bot.command('disable', disabling.disable);
bot.command('enable', disabling.enable);
bot.command('disabled', disabling.disabled);
bot.command('disableable', disabling.disableable);

// Reports
bot.command('report', reportsH.report);
bot.command('reports', reportsH.reports);

// Logging
bot.command('logchannel', loggingH.logchannel);
bot.command('setlog', loggingH.setlog);
bot.command('unsetlog', loggingH.unsetlog);

// Connections
bot.command('connect', connections.connect);
bot.command('disconnect', connections.disconnect);
bot.command('connection', connections.connection);

// CAPTCHA
bot.command('captcha', captcha.captcha);
bot.command('captchamode', captcha.captchamode);

// AntiRaid
bot.command('antiraid', antiraid.antiraid);
bot.command('ddos', ddos.ddos);

// Cleaning
bot.command('cleancommand', cleaning.cleancommand);

// Topics
bot.command('topic', topicsH.topic);
bot.command('closetopic', topicsH.closetopic);
bot.command('opentopic', topicsH.opentopic);
bot.command('renametopic', topicsH.renametopic);
bot.command('deletetopic', topicsH.deletetopic);

// Federations
bot.command('newfed', federations.newfed);
bot.command('delfed', federations.delfed);
bot.command('joinfed', federations.joinfed);
bot.command('leavefed', federations.leavefed);
bot.command('fedinfo', federations.fedinfo);
bot.command('fban', federations.fban);
bot.command('unfban', federations.unfban);

// Economy
bot.command(['balance', 'wallet'], economy.balance);
bot.command('bal', economy.bal);
bot.command('daily', economy.daily);
bot.command('weekly', economy.weekly);
bot.command(['leaderboard', 'lb', 'top'], economy.leaderboard);
bot.command('give', economy.give);
bot.command('kill', economy.killGame);
bot.command('protect', economy.protect);
bot.command('rob', economy.rob);

// Anime actions
bot.command('hug', anime.hug);
bot.command('pat', anime.pat);
bot.command('slap', anime.slap);
bot.command('kiss', anime.kiss);
bot.command('poke', anime.poke);
bot.command('bite', anime.bite);
bot.command('cuddle', anime.cuddle);
bot.command('tickle', anime.tickle);
bot.command('wave', anime.wave);
bot.command(['love', 'loveyou'], anime.love);
bot.command(['8ball', 'eightball'], anime.eightball);
bot.command('ship', anime.ship);
bot.command('truth', anime.truth);
bot.command('dare', anime.dare);
bot.command(['tod', 'truthordare'], anime.truthordare);
bot.command('steal', anime.steal);

// Games
bot.command('wordguess', games.wordguess);
bot.command('gamew', games.gamew);
bot.command('guess', games.guess);
bot.command(['trivia', 'aitrivia', 'aiquiz'], games.trivia);
bot.command(['wordseek', 'ws'], wordseek.wordseekStart);
bot.command(['stopwordseek', 'wsend', 'stopws'], wordseek.stopWordseek);
bot.command(['wshint', 'wsh'], wordseek.wshint);
bot.command(['wsthemes', 'wst'], wordseek.wsthemes);

// Extras
bot.command(['formathelp', 'markdownhelp'], extras.formathelp);
bot.command(['emojiid', 'premiumid'], emojiCommands.emojiId);
bot.command(['emojipacks', 'premiumemoji'], emojiCommands.emojiPacks);
bot.command('setlang', extras.setlang);
bot.command('privacy', extras.privacy);
bot.command(['exportchat', 'export'], extras.exportchat);
bot.command(['importchat', 'import'], extras.importchat);
bot.command(['protection', 'safemode', 'nsfw'], extras.protection);
bot.command('strictmode', extras.strictmode);

// Owner / Sudo commands
bot.command(['addcoins', 'givecoins'], ownerCmds.addcoins);
bot.command(['removecoins', 'takecoins', 'deductcoins'], ownerCmds.removecoins);
bot.command('setcoins', ownerCmds.setcoins);
bot.command('botban', ownerCmds.botban);
bot.command('botunban', ownerCmds.botunban);
bot.command('botbanned', ownerCmds.botbanned);
bot.command('addsudo', ownerCmds.addsudo);
bot.command('removesudo', ownerCmds.removesudo);
bot.command(['sudolist', 'sudo'], ownerCmds.sudolist);
bot.command(['setloggergroup', 'setlogger'], ownerCmds.setloggergroup);
bot.command(['broadcast', 'bcast', 'gcast'], ownerCmds.broadcast);
bot.command(['bstats', 'broadcaststats'], ownerCmds.broadcastStats);
bot.command(['ownerinfo', 'owner'], ownerCmds.ownerinfo);

// AI Chatbot controls
bot.command(['chatbot', 'aichat'], chatbotModule.chatbotCommand);
bot.command(['resetmemory', 'clearmemory', 'forgetme'], chatbotModule.resetMemory);

// AI Chatbot — run after all commands
bot.on('text', chatbotHandler);
bot.on('callback_query', handleCallbacks);

// ------------------ ERROR HANDLER ------------------
bot.catch((err, ctx) => {
  logger.error(`Error in update ${ctx.updateType}: ${err.message}`);
  logger.error(err.stack);
  logError(err, ctx, `Update type: ${ctx.updateType}`).catch(() => {});
});

initLogger(bot);

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error(`Unhandled promise rejection: ${error.message}`);
  logError(error, null, 'unhandledRejection').catch(() => {});
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  logError(error, null, 'uncaughtException').catch(() => {});
});

// ------------------ LAUNCH ------------------
bot.launch().catch((err) => {
  logger.error(`Bot launch error: ${err.message}`);
  logError(err, null, 'bot.launch').catch(() => {});
  process.exit(1);
});

logger.info('🌸 Sofiya starting…');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
