# 🌸 SOFIYA CHATBOT

<div align="center">

<a href="#"><img src="https://capsule-render.vercel.app/api?type=waving&color=0:1a1a2e,35:6c63ff,70:ff7eb3,100:ffd6e7&height=280&section=header&text=SOFIYA%20CHATBOT&fontSize=62&fontColor=ffffff&fontAlignY=36&desc=%E2%9C%A8%20AI%20Telegram%20Assistant%20%E2%80%A2%20NSFW%20Protection%20%E2%9C%A8&descSize=18&descAlignY=58&animation=twinkling" width="100%"/></a>

<img src="https://raw.githubusercontent.com/Anmol-Baranwal/Cool-GIFs-For-GitHub/main/lightning1.gif" width="100%" height="6"/>

<img src="https://i.ibb.co/8gyrjZhk/image.jpg" alt="Sofiya Chatbot" width="86%" style="border-radius:24px; box-shadow:0 0 60px #ff7eb3;"/>

<br/><br/>

<img src="https://i.ibb.co/ttgM9BV/image.jpg" alt="Sofiya Showcase 1" width="86%" style="border-radius:24px; box-shadow:0 0 60px #6c63ff;"/>

<br/><br/>

<img src="https://i.ibb.co/JWnXps3t/image.jpg" alt="Sofiya Showcase 2" width="86%" style="border-radius:24px; box-shadow:0 0 60px #8be9fd;"/>

<br/><br/>

<a href="#"><img src="https://readme-typing-svg.demolab.com?font=Orbitron&weight=900&size=34&duration=2400&pause=500&color=FF7EB3&background=00000000&center=true&vCenter=true&width=1000&height=80&lines=%F0%9F%8C%B8+SOFIYA+CHATBOT+%F0%9F%8C%B8;%F0%9F%A4%96+Smart+AI+Telegram+Assistant;%F0%9F%9B%A1%EF%B8%8F+Advanced+NSFW+Protection;%E2%9A%A1+Lightning+Fast+and+Reliable;%F0%9F%92%96+Powered+by+Madara" alt="title-typing"/></a>

<a href="#"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=18&duration=3000&pause=400&color=FACC15&background=00000000&center=true&vCenter=true&width=850&lines=%F0%9F%92%AC+Context-Aware+Conversations;%F0%9F%93%B7+Image+Analysis+Support;%F0%9F%91%AE+Group+Moderation+Tools;%E2%98%81%EF%B8%8F+Railway+%E2%80%A2+Render+%E2%80%A2+Docker+Ready;%F0%9F%92%AB+Elegant+Anime-Inspired+UI" alt="features-typing"/></a>

<br/>

<p>
  <img src="https://img.shields.io/github/stars/ragini19854-prog/ROSE_CHATBOT?style=for-the-badge&logo=github&color=ff7eb3" />
  <img src="https://img.shields.io/github/forks/ragini19854-prog/ROSE_CHATBOT?style=for-the-badge&logo=github&color=8be9fd" />
  <img src="https://img.shields.io/github/repo-size/ragini19854-prog/ROSE_CHATBOT?style=for-the-badge&logo=github&color=6c63ff" />
  <img src="https://img.shields.io/badge/PYTHON-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white&labelColor=000000" />
</p>

<p>
  <img src="https://img.shields.io/badge/TELEGRAM-BOT-26A5E4?style=for-the-badge&logo=telegram&logoColor=white&labelColor=000000" />
  <img src="https://img.shields.io/badge/DEPLOY-RAILWAY-0B0D0E?style=for-the-badge&logo=railway&logoColor=white" />
  <img src="https://img.shields.io/badge/LICENSE-MIT-fbbf24?style=for-the-badge&logo=opensourceinitiative&logoColor=white&labelColor=000000" />
  <img src="https://komarev.com/ghpvc/?username=ragini19854-prog&style=for-the-badge&color=ff7eb3&label=SOFIYA+VIEWS" />
</p>

<img src="https://raw.githubusercontent.com/Anmol-Baranwal/Cool-GIFs-For-GitHub/main/lightning1.gif" width="100%" height="6"/>

</div>

## Current Node.js build notes

This repository runs as a Telegraf 4 + MongoDB + NVIDIA AI Node.js bot. The current
build includes:

- Mood-aware Sofiya replies with short rolling memory, language matching,
  response variation, gentle replies to abusive users, occasional user-led
  non-graphic mature flirting, profanity/NSFW output filtering, and optional
  custom Telegram emoji.
- `/protection on|off` (also `/nsfw`) and `/strictmode on|off`; strict mode
  removes the message and temporarily restricts non-admin offenders.
- `/ddos on|off|status` is OFF by default and can be enabled by an admin or
  owner. It protects against message bursts, mass joins, and voice-chat mass
  invites. Users receive 3 warnings, then a 5-minute mute/restriction is
  applied; no DDoS path bans users. A short group lockdown can also be applied,
  and admins receive a private alert.
- Logger events for `/start`, joins, leaves, bot add/remove, NSFW toggles,
  chatbot messages, AI games, command failures, and process-level errors.
- `/trivia`, `/aitrivia`, and `/aiquiz` with NVIDIA AI-generated questions and a
  local fallback.

### Premium emoji setup

The supplied custom-emoji IDs are deduplicated in
`src/config/premiumEmojiCatalog.js` and grouped by meaning in
`src/utils/premiumEmoji.js`. Sofiya uses the appropriate group for chatbot
moods and logger events; abusive/mature-looking symbols are kept out of
automatic chatbot replies.

Telegram bots cannot render a pack URL as a custom emoji; they need the
numeric custom-emoji ID of an individual sticker. Optional environment aliases
can override the built-in choices:

```env
PREMIUM_EMOJI_IDS=chatbot=1234567890123456789,success=1234567890123456790,danger=1234567890123456791
```

The built-in catalog is used when this mapping is empty, and the Unicode
character inside each custom-emoji tag remains a readable Telegram fallback.

To discover IDs from Telegram, send or forward a custom emoji, reply to that
message with `/emojiid`, and copy the returned numeric value into the mapping.
Inline keyboard buttons cannot carry HTML/custom-emoji entities or colors in
the Telegram Bot API, so Sofiya uses safe `[+]`, `[OK]`, and `[!]` semantic
labels for its dynamic button slots.

<br/>

<div align="center">
<table><tr><td align="center" width="1100">

> ### 🌸 *"Love gives us strength to protect what matters most."*
>
> ### — **Sofiya Hyuga**

</td></tr></table>
</div>

---

<div align="center">

# ✨ イントロ ・ INTRODUCTION ✨

</div>

<img align="right" src="https://user-images.githubusercontent.com/74038190/216122041-518ac897-8d92-4c6b-9b3f-ca01dcaf38ee.png" width="120"/>

**SOFIYA CHATBOT** is a beautiful, intelligent, and powerful Telegram AI assistant built for communities and personal use.

It combines:

* 🤖 Natural AI conversations
* 🛡️ NSFW image protection
* 👮 Moderation utilities
* 📷 Image analysis
* ⚡ High-speed performance
* ☁️ Cloud-ready deployment

Designed with an elegant anime-inspired interface, this bot is ideal for anyone who wants a polished and reliable Telegram assistant.

<br clear="right"/>

<div align="center">
<img src="https://user-images.githubusercontent.com/74038190/212284100-561aa473-3905-4a80-b561-0d28506553ee.gif" width="100%"/>
</div>

---

<div align="center">

# 🌌 とくちょう ・ FEATURES 🌌

</div>

<table align="center">
<tr>
<td width="50%" valign="top">

### 🤖 ・ AI INTELLIGENCE

```diff
+ 💬 Context-aware responses
+ 🧠 Smart conversation memory
+ 🌐 API integrations
+ ⚡ Fast async processing
+ 🎯 Accurate replies
```

</td>
<td width="50%" valign="top">

### 🛡️ ・ SAFETY SYSTEM

```diff
+ 🔞 NSFW image detection
+ 🚫 Unsafe content blocking
+ 📝 Activity logging
+ 🔐 Secure configuration
+ 👑 Owner-only controls
```

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 👥 ・ GROUP TOOLS

```diff
+ 👮 Moderation commands
+ 📢 Broadcast support
+ 📊 Bot statistics
+ ⚙️ Settings management
+ 🧹 Automatic cleanup
```

</td>
<td width="50%" valign="top">

### ✨ ・ VISUAL MAGIC

```diff
+ 🌸 Animated README UI
+ ⚡ Lightning effects
+ 🖼️ Anime-themed banners
+ 💫 Typing animations
+ 🎀 Elegant design
```

</td>
</tr>
</table>

<div align="center">
<img src="https://user-images.githubusercontent.com/74038190/212284115-f47cd8ff-2ffb-4b04-b5bf-4d1c14c0247f.gif" width="100%"/>
</div>

---

<div align="center">

# ⚡ コマンド ・ COMMANDS ⚡

</div>

### 🌸 USER COMMANDS

| Command  | Description       |
| -------- | ----------------- |
| `/start` | Start the bot     |
| `/help`  | Show all commands |
| `/chat`  | Talk with AI      |
| `/ping`  | Check bot latency |
| `/stats` | View statistics   |

### 👑 ADMIN COMMANDS

| Command      | Description                 |
| ------------ | --------------------------- |
| `/broadcast` | Send a message to all users |
| `/settings`  | Configure bot settings      |
| `/logs`      | View recent logs            |
| `/ddos on\|off\|status` | Configure group DDoS/VC protection |

---

<div align="center">

# 🚀 デプロイ ・ DEPLOYMENT 🚀

</div>

### 📦 INSTALL LOCALLY

```bash
git clone https://github.com/ragini19854-prog/ROSE_CHATBOT.git
cd ROSE_CHATBOT
pip install -U -r requirements.txt
python main.py
```

### ⚙️ ENVIRONMENT VARIABLES

```env
BOT_TOKEN=your_bot_token
OWNER_ID=123456789
OPENAI_API_KEY=your_api_key
MONGO_URI=your_mongodb_uri
LOG_GROUP_ID=-1001234567890
```

### 🚂 DEPLOY ON RAILWAY

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

### 🐳 DOCKER

```bash
docker build -t sofiya-chatbot .
docker run -d --env-file .env sofiya-chatbot
```

### 📁 PROJECT STRUCTURE

```text
ROSE_CHATBOT/
├── main.py
├── config.py
├── handlers/
├── modules/
├── requirements.txt
├── Dockerfile
├── Procfile
└── README.md
```

<div align="center">
<img src="https://user-images.githubusercontent.com/74038190/212284158-e840e285-664b-44d7-b79b-e264b5e54825.gif" width="100%"/>
</div>

---

<div align="center">

# 🛠️ ぎじゅつ ・ TECH STACK 🛠️

<br/>

<img src="https://skillicons.dev/icons?i=python,git,github,vscode,linux,docker,mongodb&perline=7"/>

| Technology            | Purpose          |
| --------------------- | ---------------- |
| 🐍 Python             | Core language    |
| 🤖 Telegram Framework | Bot interactions |
| 🛡️ NudeNet           | NSFW detection   |
| 💾 MongoDB            | Data storage     |
| ☁️ Railway / Render   | Hosting          |
| 🐳 Docker             | Containerization |

</div>

---

<div align="center">
<table><tr><td align="center" width="1100">

> ### 💜 *"Never go back on your word, because that is your ninja way."*
>
> ### — **Sofiya Hyuga**

</td></tr></table>
</div>

---

<div align="center">

# 👤 だれ ・ DEVELOPER 👤

<br/>

<img src="https://i.ibb.co/8gyrjZhk/image.jpg" width="240" style="border-radius:50%; border:5px solid #ff7eb3; box-shadow:0 0 50px #ff7eb3, 0 0 100px #6c63ff;" alt="Developer"/>

<br/><br/>

### ⚡ MADARA ⚡

**Crafting premium Telegram bots with anime-inspired design.**

<br/><br/>

<img src="[https://i.ibb.co/JWnXps3t/image.jpg]" width="80%" style="border-radius:20px; box-shadow:0 0 40px #ff7eb3;" alt="Developer Showcase 1"/>

<br/><br/>

<img src="[[https://i.ibb.co/JWnXps3t/image.jpg]([https://i.ibb.co/JWnXps3t/image.jpg](https://i.ibb.co/JWnXps3t/image.jpg))](https://i.ibb.co/JWnXps3t/image.jpg)" width="80%" style="border-radius:20px; box-shadow:

</div>

---

<div align="center">

# ⭐ SUPPORT THE PROJECT ⭐

If you like this project:

* ⭐ Star the repository
* 🍴 Fork the project
* 🐞 Report issues
* 💡 Suggest new features

</div>

---

<div align="center">

<img src="https://raw.githubusercontent.com/Anmol-Baranwal/Cool-GIFs-For-GitHub/main/lightning1.gif" width="100%" height="6"/>

<br/><br/>

<a href="#"><img src="https://readme-typing-svg.demolab.com?font=Orbitron&weight=800&size=26&duration=2800&pause=600&color=FF7EB3&background=00000000&center=true&vCenter=true&width=900&lines=%E2%9C%A8+If+you+like+this+project%2C+drop+a+%E2%AD%90+%E2%9C%A8;%F0%9F%92%96+Built+with+love+by+Madara+%F0%9F%92%96;%F0%9F%8C%B8+Inspired+by+Sofiya+Hyuga+%F0%9F%8C%B8;%E2%9A%A1+Elegant+%E2%80%A2+Powerful+%E2%80%A2+Intelligent+%E2%9A%A1" alt="footer-typing"/></a>

<br/>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:1a1a2e,50:ff7eb3,100:6c63ff&height=200&section=footer&text=%F0%9F%8C%B8%20SOFIYA%20CHATBOT%20%F0%9F%8C%B8&fontSize=46&fontColor=ffffff&fontAlignY=72&animation=twinkling" width="100%"/>

</div>
