const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true, index: true },
  title: String,
  rules: { type: String, default: '' },
  privateRules: { type: Boolean, default: false },
  welcome: {
    enabled: { type: Boolean, default: true },
    text: { type: String, default: 'Welcome, {mention}, to <b>{chatname}</b>!' },
    clean: { type: Boolean, default: false },
    photo: { type: String, default: '' },
  },
  goodbye: {
    enabled: { type: Boolean, default: false },
    text: { type: String, default: '{first} has left the group.' },
    clean: { type: Boolean, default: false },
  },
  warnLimit: { type: Number, default: 3 },
  warnMode: { type: String, enum: ['mute', 'kick', 'ban'], default: 'ban' },
  flood: {
    enabled: { type: Boolean, default: false },
    limit: { type: Number, default: 7 },
    mode: { type: String, enum: ['mute', 'kick', 'ban', 'tmute'], default: 'mute' },
    duration: { type: Number, default: 600 },
  },
  blacklistMode: { type: String, enum: ['delete', 'warn', 'mute', 'kick', 'ban'], default: 'delete' },
  cleanService: { type: Boolean, default: false },
  cleanCommand: { type: Boolean, default: false },
  antiChannelPin: { type: Boolean, default: false },
  antiRaid: {
    enabled: { type: Boolean, default: false },
    actionDuration: { type: Number, default: 21600 },
  },
  captcha: {
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ['button', 'math', 'text'], default: 'button' },
    timeout: { type: Number, default: 300 },
  },
  reports: { type: Boolean, default: true },
  language: { type: String, default: 'en' },
  logChannel: { type: Number, default: null },
  nsfwProtection: { type: Boolean, default: true },
  strictMode: { type: Boolean, default: false },
  linkProtection: { type: Boolean, default: false },
  chatbot: {
    enabled: { type: Boolean, default: false },
  },
  ddosProtection: {
    enabled: { type: Boolean, default: false },
    configured: { type: Boolean, default: false },
    messageLimit: { type: Number, default: 14 },
    groupLimit: { type: Number, default: 45 },
    joinLimit: { type: Number, default: 8 },
    vcInviteLimit: { type: Number, default: 5 },
  },
  aiGames: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);
