const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId:       { type: Number, required: true, unique: true, index: true },
  username:     { type: String, default: '' },
  firstName:    { type: String, default: '' },
  coins:        { type: Number, default: 0 },
  bank:         { type: Number, default: 0 },
  lastDaily:    Date,
  lastWeekly:   Date,
  streak:       { type: Number, default: 0 },
  kills:        { type: Number, default: 0 },
  deaths:       { type: Number, default: 0 },
  protectedUntil: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);
