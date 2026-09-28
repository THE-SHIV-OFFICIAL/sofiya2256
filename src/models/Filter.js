const mongoose = require('mongoose');

const filterSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, index: true },
  trigger: { type: String, required: true },
  reply: { type: String, default: '' },
  fileId: { type: String, default: '' },
  type: { type: String, enum: ['text', 'photo', 'video', 'document', 'sticker', 'voice', 'audio', 'animation'], default: 'text' },
  parseMode: { type: String, default: 'HTML' },
  createdBy: Number,
}, { timestamps: true });

filterSchema.index({ chatId: 1, trigger: 1 }, { unique: true });

module.exports = mongoose.model('Filter', filterSchema);
