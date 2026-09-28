const { extractTarget, mention, safeReply, isUserAdmin, escapeHtml } = require('../../utils/helpers');
const { requireAdmin } = require('../../middleware/admin');

const promote = requireAdmin(async (ctx) => {
  const { user } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  try {
    await ctx.promoteChatMember(user.id, {
      can_change_info: false,
      can_delete_messages: true,
      can_invite_users: true,
      can_restrict_members: true,
      can_pin_messages: true,
      can_promote_members: false,
      can_manage_video_chats: true,
      can_manage_chat: true,
    });
    await safeReply(ctx, `🎖️ ${mention(user)} has been promoted.`);
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const fullpromote = requireAdmin(async (ctx) => {
  if (!ctx.isOwner) return safeReply(ctx, '❌ Owner only.');
  const { user } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  try {
    await ctx.promoteChatMember(user.id, {
      can_change_info: true,
      can_delete_messages: true,
      can_invite_users: true,
      can_restrict_members: true,
      can_pin_messages: true,
      can_promote_members: true,
      can_manage_video_chats: true,
      can_manage_chat: true,
    });
    await safeReply(ctx, `🎖️ ${mention(user)} has been fully promoted.`);
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const demote = requireAdmin(async (ctx) => {
  const { user } = await extractTarget(ctx);
  if (!user) return safeReply(ctx, '❌ Reply or pass a user.');
  try {
    await ctx.promoteChatMember(user.id, {
      can_change_info: false,
      can_delete_messages: false,
      can_invite_users: false,
      can_restrict_members: false,
      can_pin_messages: false,
      can_promote_members: false,
      can_manage_video_chats: false,
      can_manage_chat: false,
    });
    await safeReply(ctx, `📉 ${mention(user)} has been demoted.`);
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const title = requireAdmin(async (ctx) => {
  const { user } = await extractTarget(ctx);
  const parts = (ctx.message.text || '').split(/\s+/).slice(1);
  const titleStr = (ctx.message.reply_to_message ? parts.join(' ') : parts.slice(1).join(' ')).trim();
  if (!user || !titleStr) return safeReply(ctx, '❌ Usage: <code>/title &lt;user&gt; &lt;title&gt;</code>');
  if (titleStr.length > 16) return safeReply(ctx, '❌ Title max 16 chars.');
  try {
    await ctx.setChatAdministratorCustomTitle(user.id, titleStr);
    await safeReply(ctx, `🏷️ ${mention(user)} title set to <b>${escapeHtml(titleStr)}</b>.`);
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const adminlist = async (ctx) => {
  if (!ctx.chat || ctx.chat.type === 'private') return;
  try {
    const admins = await ctx.getChatAdministrators();
    const creator = admins.find((a) => a.status === 'creator');
    const others = admins.filter((a) => a.status !== 'creator');
    let txt = `<b>👑 Admins of ${escapeHtml(ctx.chat.title)}</b>\n\n`;
    if (creator) txt += `👑 ${mention(creator.user)}${creator.custom_title ? ` <i>[${escapeHtml(creator.custom_title)}]</i>` : ''}\n`;
    txt += '\n<b>Administrators:</b>\n';
    for (const a of others) {
      txt += `• ${mention(a.user)}${a.custom_title ? ` <i>[${escapeHtml(a.custom_title)}]</i>` : ''}\n`;
    }
    await safeReply(ctx, txt);
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
};

const invitelink = requireAdmin(async (ctx) => {
  try {
    const link = await ctx.exportChatInviteLink();
    await safeReply(ctx, `🔗 <b>Invite link:</b>\n${link}`);
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const setchatphoto = requireAdmin(async (ctx) => {
  if (!ctx.message.reply_to_message?.photo) return safeReply(ctx, '❌ Reply to a photo.');
  const photo = ctx.message.reply_to_message.photo.slice(-1)[0];
  try {
    await ctx.telegram.setChatPhoto(ctx.chat.id, { source: undefined, file_id: photo.file_id });
    await safeReply(ctx, '✅ Chat photo updated.');
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const settitle = requireAdmin(async (ctx) => {
  const t = (ctx.message.text || '').split(/\s+/).slice(1).join(' ').trim();
  if (!t) return safeReply(ctx, '❌ Usage: <code>/settitle &lt;new title&gt;</code>');
  try {
    await ctx.telegram.setChatTitle(ctx.chat.id, t);
    await safeReply(ctx, `✅ Chat title set to <b>${escapeHtml(t)}</b>.`);
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

const setdescription = requireAdmin(async (ctx) => {
  const t = (ctx.message.text || '').split(/\s+/).slice(1).join(' ').trim();
  try {
    await ctx.telegram.setChatDescription(ctx.chat.id, t);
    await safeReply(ctx, '✅ Chat description updated.');
  } catch (e) {
    await safeReply(ctx, `❌ ${e.description || e.message}`);
  }
});

module.exports = { promote, fullpromote, demote, title, adminlist, invitelink, setchatphoto, settitle, setdescription };
