const Wallet = require('../models/Wallet');

async function addCoins(userId, amount) {
    let wallet = await Wallet.findOne({ userId }) || new Wallet({ userId });
    wallet.coins += amount;
    await wallet.save();
    return wallet.coins;
}

async function getBalance(userId) {
    const wallet = await Wallet.findOne({ userId });
    return wallet ? wallet.coins : 0;
}

module.exports = { addCoins, getBalance };
