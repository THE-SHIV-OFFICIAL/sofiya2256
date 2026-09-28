const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, index: true },
  userId: { type: Number, required: true },
}, { timestamps: true });

approvalSchema.index({ chatId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Approval', approvalSchema);
