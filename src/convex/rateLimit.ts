import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";

export const RATE_LIMITS = {
  chat: { limit: 20, windowMs: 60_000 }, // 20 chats/min
  vision: { limit: 10, windowMs: 60_000 }, // 10 disease scans/min
  advisory: { limit: 6, windowMs: 60_000 }, // 6 advisories/min
  schemes: { limit: 6, windowMs: 60_000 }, // 6 scheme searches/min
  weather: { limit: 30, windowMs: 60_000 }, // 30 weather fetches/min
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

const MAX_KEY_LENGTH = 256;

/**
 * Builds the storage key for a user+action pair.
 */
function buildKey(userId: string, action: RateLimitAction): string {
  return `${action}:${userId.slice(0, MAX_KEY_LENGTH)}`;
}

export const getWindowRow = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiRateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
  },
});

export const recordHitInternal = internalMutation({
  args: { key: v.string(), windowMs: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("aiRateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (!existing) {
      await ctx.db.insert("aiRateLimits", {
        key: args.key,
        windowStart: now,
        count: 1,
      });
      return;
    }

    if (now - existing.windowStart >= args.windowMs) {
      await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
      return;
    }

    await ctx.db.patch(existing._id, { count: existing.count + 1 });
  },
});

/**
 * Checks the rate limit for a user+action within the current fixed window.
 * Returns allowed=true when under the limit. Call `recordHit` only when
 * the operation is allowed, so blocked requests don't consume quota.
 * A failed limiter check never blocks the request.
 */
export async function checkRateLimit(
  ctx: ActionCtx,
  userId: string,
  action: RateLimitAction
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { limit, windowMs } = RATE_LIMITS[action];
  const now = Date.now();
  const key = buildKey(userId, action);

  try {
    const row = await ctx.runQuery(internal.rateLimit.getWindowRow, { key });

    if (!row) return { allowed: true, retryAfterSeconds: 0 };
    if (now - row.windowStart >= windowMs) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (row.count < limit) return { allowed: true, retryAfterSeconds: 0 };

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((row.windowStart + windowMs - now) / 1000)
      ),
    };
  } catch (error) {
    // Never let limiter infra errors block users.
    console.error("Rate limit check failed (allowing request):", error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * Records one hit against the user+action window.
 */
export async function recordHit(
  ctx: ActionCtx,
  userId: string,
  action: RateLimitAction
): Promise<void> {
  const { windowMs } = RATE_LIMITS[action];
  const key = buildKey(userId, action);

  try {
    await ctx.runMutation(internal.rateLimit.recordHitInternal, {
      key,
      windowMs,
    });
  } catch (error) {
    // Recording failures must never break the user's request.
    console.error("Rate limit record failed:", error);
  }
}

/**
 * Convenience wrapper for actions: returns a user-facing error string when
 * over the limit (after recording nothing), or records the hit and returns
 * null when the request may proceed.
 */
export async function enforceRateLimit(
  ctx: ActionCtx,
  userId: string,
  action: RateLimitAction
): Promise<string | null> {
  const { allowed, retryAfterSeconds } = await checkRateLimit(
    ctx,
    userId,
    action
  );
  if (!allowed) {
    return `⏳ You're doing that a bit too fast. Please wait about ${retryAfterSeconds}s and try again.`;
  }
  await recordHit(ctx, userId, action);
  return null;
}

/**
 * Resolves the calling user's id from auth. Returns "anonymous" for
 * unauthenticated guests so they still get a shared, bounded quota.
 */
export async function getRateLimitUserId(ctx: ActionCtx): Promise<string> {
  try {
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

const CLEANUP_BATCH = 200;

/**
 * Internal mutation that deletes expired rate-limit rows and stale cache
 * entries. Wired to a cron job in crons.ts.
 */
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const limits = await ctx.db
      .query("aiRateLimits")
      .withIndex("by_key")
      .take(CLEANUP_BATCH);
    for (const row of limits) {
      const [action] = row.key.split(":");
      const windowMs = RATE_LIMITS[action as RateLimitAction]?.windowMs ?? 60_000;
      if (now - row.windowStart >= windowMs) {
        await ctx.db.delete(row._id);
      }
    }

    const mandiCache = await ctx.db
      .query("mandiPriceCache")
      .withIndex("by_cacheKey")
      .take(CLEANUP_BATCH);
    for (const row of mandiCache) {
      // Mandi cache TTL is enforced at read time; sweep anything older than 24h.
      if (now - row.fetchedAt >= 24 * 60 * 60 * 1000) {
        await ctx.db.delete(row._id);
      }
    }
  },
});
