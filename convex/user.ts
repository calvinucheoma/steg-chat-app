import { v } from "convex/values";

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

/** -------- existing internal endpoints (keep for webhooks) -------- */
export const create = internalMutation({
  args: {
    username: v.string(),
    imageUrl: v.string(),
    clerkId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("users", args);
  },
});

export const get = internalQuery({
  args: { clerkId: v.string() },
  async handler(ctx, args) {
    return ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

/** -------- public endpoints the CLIENT can call -------- */
export const ensure = mutation({
  args: { username: v.string(), imageUrl: v.string(), email: v.string() },
  async handler(ctx, args) {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) throw new Error("Unauthenticated");
    const clerkId = ident.subject;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) return existing._id;
    return await ctx.db.insert("users", { ...args, clerkId });
  },
});

export const me = query({
  args: {},
  async handler(ctx) {
    const ident = await ctx.auth.getUserIdentity();
    if (!ident) return null;
    return ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", ident.subject))
      .unique();
  },
});
