const loggingService = require('./loggingService');

const moderationService = {
  handleViolation: async (ctx, userId, reason, severity = 'medium') => {
    loggingService.logModeration(ctx.chat?.id, userId, 'violation', reason);
    
    try {
      if (severity === 'high') {
        await ctx.banChatMember(userId);
        await ctx.reply('🚫 Severe content → User banned.');
      } else {
        await ctx.reply('⚠️ Prohibited content deleted.');
      }
    } catch (e) {
      await ctx.reply('🚫 Content deleted.');
    }
  }
};

module.exports = moderationService;
