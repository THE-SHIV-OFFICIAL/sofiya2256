const mongoose = require('mongoose');

const botSettingsSchema = new mongoose.Schema({
  _id:       { type: String, default: 'global' },
  sudoUsers: { type: [Number], default: [] },
  botBanned: [{
    userId:   Number,
    reason:   { type: String, default: 'No reason given' },
    bannedAt: { type: Date, default: Date.now },
  }],
  loggerGroupId: { type: Number, default: null },
  broadcastCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('BotSettings', botSettingsSchema);
