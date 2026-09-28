const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, index: true },
  trigger: { type: String, required: true, lowercase: true },
}, { timestamps: true });

blacklistSchema.index({ chatId: 1, trigger: 1 }, { unique: true });

module.exports = mongoose.model('Blacklist', blacklistSchema);
