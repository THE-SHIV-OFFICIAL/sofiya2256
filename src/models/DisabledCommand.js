const mongoose = require('mongoose');

const disabledSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, index: true },
  command: { type: String, required: true, lowercase: true },
  deleteMessage: { type: Boolean, default: false },
}, { timestamps: true });

disabledSchema.index({ chatId: 1, command: 1 }, { unique: true });

module.exports = mongoose.model('DisabledCommand', disabledSchema);
