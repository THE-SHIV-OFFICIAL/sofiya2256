const mongoose = require('mongoose');

const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

const chatMemorySchema = new mongoose.Schema({
  userId: { type: Number, index: true },
  chatId: { type: Number, index: true },

  // rolling conversation window
  messages: [{ role: String, content: String, timestamp: Date }],

  // long-term facts the bot learned about the user (name, city, likes…)
  facts: [{ type: String }],

  // profile snapshot for nicer replies
  firstName: { type: String, default: '' },
  username: { type: String, default: '' },

  lastUpdated: { type: Date, default: Date.now },

  // memory auto-expires 7 days after the last message
  expiresAt: { type: Date, default: () => new Date(Date.now() + ONE_WEEK_SECONDS * 1000) },
}, { timestamps: true });

chatMemorySchema.index({ userId: 1, chatId: 1 }, { unique: true });
chatMemorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ChatMemory', chatMemorySchema);
module.exports.ONE_WEEK_SECONDS = ONE_WEEK_SECONDS;
