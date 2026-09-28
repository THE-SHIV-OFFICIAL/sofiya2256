# Sofiya — Telegram Group Management Bot

Rose-grade group management bot built with Telegraf 4 + MongoDB + NVIDIA AI.

## Stack
- **Runtime**: Node.js 20
- **Bot**: Telegraf 4.16.3 (long polling)
- **DB**: MongoDB (via mongoose 9)
- **AI**:
  - NVIDIA NIM REST API (OpenAI-compatible)
  - Text moderation + chatbot: `meta/llama-3.3-70b-instruct`
  - Vision moderation (photos / sticker / video & gif thumbs): `meta/llama-3.1-8b-instruct` (fast model) + local NSFWJS classifier
- **Logger**: Winston 3

## Required env / secrets
- `BOT_TOKEN` — Telegram bot token
- `MONGO_URI` — MongoDB connection string
- `NVIDIA_API_KEY` — NVIDIA AI API key
- `OWNER_ID` — Telegram user id of bot owner (defaults: 8441236350)
- `SUDO_USERS` — comma-separated extra sudo ids
- `LOG_LEVEL` — winston log level (default `info`)
- `PREMIUM_EMOJI_IDS` — optional custom Telegram emoji mapping in the form
  `alias=id,alias=id`; pack URLs alone cannot be rendered as Bot API emoji
- `AI_GAMES_ENABLED` — set `false` to use the built-in trivia fallback only

## Project layout
```
src/
  bot.js                       # Entry point — registers all middleware & commands
  config/index.js              # Env loader
  models/                      # Mongoose schemas (Group, User, Wallet, Note,
                               # Filter, Warning, Blacklist, Approval, Lock,
                               # DisabledCommand, Connection, Federation,
                               # ChatMemory, Welcome)
  services/
    aiModerationService.js     # NVIDIA AI scan → block bad messages
    chatbotService.js          # Sofiya persona chat
  utils/
    helpers.js                 # extractTarget, parseDuration, mention,
                               # renderTemplate, safeReply, isUserAdmin, etc.
    groupSettings.js           # cached getGroup/updateGroup
    logger.js                  # winston logger
    dictionary.js              # 5-letter word list
    queue.js
  middleware/
    admin.js                   # ctx.isAdmin/ctx.isOwner + requireAdmin/Owner
  handlers/
    callbacks.js               # Inline-keyboard router (help menu + captcha)
    moderation.js              # AI moderation middleware
    commands/                  # All command + middleware modules
      start, chatbot, bans, mutes, warnings, admin, notes, filters, rules,
      greetings, purges, pins, locks, antiflood, blocklists, approval, misc,
      disable, reports, logging, connections, captcha, antiraid, cleaning,
      topics, federations, economy, games, extras
    queues/mediaQueue.js
```

## Middleware order (in `bot.js`)
1. `isAdmin` — sets `ctx.isAdmin` / `ctx.isOwner`
2. `disabledMiddleware` — gate disabled commands
3. `captchaJoinHandler` — restrict newcomers + send CAPTCHA
4. `antiRaidJoinMiddleware` — auto-ban during raid window
5. `fedJoinCheck` — federation ban check on join
6. greetings: new/left member + clean service
7. `antiChannelPinMiddleware`
8. `lockMiddleware` (24 lock types)
9. `blacklistMiddleware`
10. `antifloodMiddleware`
11. `aiModeration` (NVIDIA AI scan)
12. `triviaMiddleware`
13. `hashtagMiddleware` (#notename)
14. `filterMiddleware`
15. `cleanCommandMiddleware` — delete the original command after run
16. Commands (see below)
17. `chatbotHandler` — Sofiya AI chat (mention/reply/PM)
18. `handleCallbacks` — help + captcha buttons

## Command coverage (Rose-style)
- **Admin**: promote, fullpromote, demote, title, adminlist, invitelink,
  settitle, setdescription, setchatphoto
- **Bans**: ban, sban, dban, tban, unban, kick, skick, kickme, banme
- **Mutes**: mute, smute, dmute, tmute, unmute
- **Warnings**: warn, swarn, dwarn, warns, resetwarns, rmwarn,
  setwarnlimit, warnmode (mute|kick|ban)
- **Notes**: save, get, clear, clearall, notes, plus `#name` shortcut
- **Filters**: filter, stop, stopall, filters
- **Rules**: setrules, clearrules, rules, privaterules
- **Greetings**: setwelcome, resetwelcome, welcome on/off, cleanwelcome,
  setgoodbye, resetgoodbye, goodbye on/off, cleanservice
- **Locks**: lock, unlock, locks, locktypes (24 types)
- **Antiflood**: setflood, flood, floodmode
- **Blocklists**: addblacklist, rmblacklist, blacklist, blacklistmode
- **Approval**: approve, unapprove, approval, approved, unapproveall
- **Pins**: pin (silent), unpin, unpinall, antichannelpin
- **Purges**: purge, del, purgefrom, purgeto
- **Reports**: report, reports on/off
- **Connections**: connect, disconnect, connection
- **Disabling**: disable, enable, disabled, disableable
- **Logging**: setlog, logchannel, unsetlog
- **CAPTCHA**: captcha on/off, captchamode (button|math|text)
- **AntiRaid**: antiraid on/off (with optional duration)
- **Cleaning**: cleancommand, cleanservice
- **Topics**: topic, closetopic, opentopic, renametopic, deletetopic
- **Federations**: newfed, joinfed, leavefed, fedinfo, fban, unfban
- **Misc**: id, info, ping, runs, echo, stats
- **Economy**: balance, daily, weekly, leaderboard, give
- **Games**: wordguess + gamew, trivia, guess
- **Formatting / Languages / Privacy / Import-Export**: formathelp, setlang,
  privacy, exportchat, importchat (extras.js)
- **NSFW / Abuse Protection** (always-ON by default for every group):
  `/protection on|off`, `/strictmode on|off`. Applies to text, captions,
  photos, video / GIF / video-note thumbnails, image-stickers, image-documents
  and emoji-context. **Admins are NOT exempt** — bot deletes every offending
  message regardless of role; in `strictmode`, non-admins are also muted 1 h.
- **AI chatbot**: triggered by mention of "Sofiya", reply to bot, or PM —
  uses NVIDIA AI Llama with rolling 12-message memory per user/chat. It answers
  abuse calmly, supports varied wholesome romance, and may respond to a
  clearly user-led mature theme with brief non-graphic flirting; it never
  produces explicit sexual, exploitative, coercive, or minor-related content.
- **AI games**: `/trivia`, `/aitrivia`, and `/aiquiz` ask NVIDIA AI for a fresh,
  safe JSON trivia question and fall back to the local question bank.
- **Activity logger**: `/start`, joins, leaves, bot added/removed, NSFW
  actions, chatbot activity, command errors, and process errors include actor
  name, `@username` when available, chat link, admin status, and IST time.
- **Custom emoji**: `src/utils/premiumEmoji.js` stores the supplied addemoji
  pack catalog. Telegram requires individual custom-emoji IDs; configure those
  IDs in `PREMIUM_EMOJI_IDS` to render them in chat, logs, and controls.
- **Emoji policy**: outgoing text and photo captions pass through a global
  normal-Unicode-emoji stripper; configured `<tg-emoji>` entities remain valid.
- **Keyboard styling**: `src/utils/buttonStyles.js` randomizes semantic
  primary/success/danger slots. Telegram does not support colored buttons, so
  no unsupported style field is sent.
- **Emoji ID helper**: reply to a Telegram custom-emoji message with
  `/emojiid`; Sofiya prints the numeric IDs needed by `PREMIUM_EMOJI_IDS`.

## Workflow
- Single workflow `Sofiya Bot` running `node src/bot.js` (console output).

## Notes
- Group settings cached 30s, admin status cached 60s.
- AI moderation cache 5 min in-memory only, not persisted.
- Bot uses HTML parse mode everywhere for safer formatting.
- Federations allow chained bans across all subscribed groups.
