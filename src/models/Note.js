const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  content: { type: String, default: '' },
  fileId: { type: String, default: '' },
  type: { type: String, enum: ['text', 'photo', 'video', 'document', 'sticker', 'voice', 'audio', 'animation'], default: 'text' },
  parseMode: { type: String, default: 'HTML' },
  createdBy: Number,
}, { timestamps: true });

noteSchema.index({ chatId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Note', noteSchema);
