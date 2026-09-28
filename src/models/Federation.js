const mongoose = require('mongoose');

const federationSchema = new mongoose.Schema({
  fedId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  ownerId: { type: Number, required: true },
  admins: { type: [Number], default: [] },
  chats: { type: [Number], default: [] },
  bans: [{
    userId: Number,
    reason: String,
    by: Number,
    at: { type: Date, default: Date.now },
  }],
  rules: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Federation', federationSchema);
