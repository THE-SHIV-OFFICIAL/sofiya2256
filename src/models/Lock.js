const mongoose = require('mongoose');

const lockSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, index: true },
  type: { type: String, required: true },
}, { timestamps: true });

lockSchema.index({ chatId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Lock', lockSchema);
