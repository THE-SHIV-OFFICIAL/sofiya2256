const { addCoins } = require('./economyService');

async function rewardGameWin(userId, amount = 50) {
    const coins = await addCoins(userId, amount);
    return `🎉 You won **${amount} coins**! New balance: ${coins}`;
}

module.exports = { rewardGameWin };
