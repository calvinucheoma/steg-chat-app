import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import { getUserByClerkId } from './_utils';

export const get = query({
  args: { id: v.id('conversations') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized');
    }

    const currentUser = await getUserByClerkId({
      ctx,
      clerkId: identity.subject,
    });

    if (!currentUser) {
      throw new ConvexError('User not found');
    }

    // Make sure this index name matches the schema exactly.
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversationId', (q) => q.eq('conversationId', args.id))
      .order('desc')
      .collect();

    const messagesWithUsers = await Promise.all(
      messages.map(async (m) => {
        const messageSender = await ctx.db.get(m.senderId);
        if (!messageSender) {
          throw new ConvexError('Could not find sender of message');
        }

        // Ensure hasSecret is present (default false for older docs)
        const message = {
          ...m,
          hasSecret: m.hasSecret ?? false,
          stegoMessage: m.stegoMessage ?? null,
        };

        return {
          message,
          senderImage: messageSender.imageUrl,
          senderName: messageSender.username,
          isCurrentUser: messageSender._id === currentUser._id,
        };
      })
    );

    return messagesWithUsers;
  },
});
