const rateLimit = new Map();

const cooldown = (ms) => async (ctx, next) => {
    const key = `${ctx.from.id}:${ctx.chat?.id}`;
    const now = Date.now();

    if (rateLimit.has(key) && now - rateLimit.get(key) < ms) {
        return; // silent ignore
    }

    rateLimit.set(key, now);
    return next();
};

module.exports = cooldown;
