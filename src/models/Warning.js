const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, index: true },
  userId: { type: Number, required: true, index: true },
  reasons: [{ reason: String, by: Number, date: { type: Date, default: Date.now } }],
}, { timestamps: true });

warningSchema.index({ chatId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Warning', warningSchema);
