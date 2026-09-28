const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true, index: true },
  chatId: { type: Number, required: true },
  chatTitle: String,
}, { timestamps: true });

module.exports = mongoose.model('Connection', connectionSchema);
