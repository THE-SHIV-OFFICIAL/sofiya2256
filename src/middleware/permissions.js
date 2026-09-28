const config = require('../config/index');

const onlyOwner = async (ctx, next) => {
    if (ctx.from.id === config.ownerId || config.sudoUsers.includes(ctx.from.id)) {
        return next();
    }
    return ctx.reply('❌ Owner only command.');
};

module.exports = { onlyOwner };
