import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MandiPriceRecord, MandiPricesResult } from "./mandiPrices";

export interface MandiCacheCandidate {
  cacheKey: string;
  fetchedAtMs: number;
  records: MandiPriceRecord[];
}

const MANDI_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — prices update at most daily
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Reads a cached mandi result if present and fresh. Returns null on miss.
 * Lives outside the "use node" module because Convex only allows actions
 * in node files.
 */
export const readMandiCache = internalQuery({
  args: { cacheKey: v.string() },
  handler: async (ctx, args): Promise<MandiPricesResult | null> => {
    const row = await ctx.db
      .query("mandiPriceCache")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    if (!row) return null;
    if (Date.now() - row.fetchedAt >= MANDI_CACHE_TTL_MS) return null;
    return row.result as MandiPricesResult;
  },
});

/**
 * Reads the last cached mandi result for a key regardless of age. Used as a
 * fallback when the live data.gov.in feed is unreachable, so farmers keep
 * seeing the last known prices instead of an empty page.
 */
export const readMandiCacheAnyAge = internalQuery({
  args: { cacheKey: v.string() },
  handler: async (ctx, args): Promise<MandiPricesResult | null> => {
    const row = await ctx.db
      .query("mandiPriceCache")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    return row ? (row.result as MandiPricesResult) : null;
  },
});

/**
 * Returns cached mandi rows (up to 100) with their records, regardless of
 * age. Used by the commodity-level stale fallback so a cache miss on the
 * exact query key can still serve last-known prices for the requested
 * commodities.
 */
export const readMandiCacheCandidates = internalQuery({
  args: {},
  handler: async (ctx): Promise<MandiCacheCandidate[]> => {
    const rows = await ctx.db
      .query("mandiPriceCache")
      .withIndex("by_cacheKey")
      .take(100);

    const candidates: MandiCacheCandidate[] = [];
    for (const row of rows) {
      const result = row.result as MandiPricesResult | undefined;
      if (!result || !Array.isArray(result.records)) continue;
      candidates.push({
        cacheKey: row.cacheKey,
        fetchedAtMs: row.fetchedAt,
        records: result.records,
      });
    }
    return candidates;
  },
});

/**
 * Writes a mandi result to the cache (upsert on cacheKey).
 */
export const writeMandiCache = internalMutation({
  args: { cacheKey: v.string(), result: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mandiPriceCache")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        result: args.result,
        fetchedAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert("mandiPriceCache", {
      cacheKey: args.cacheKey,
      result: args.result,
      fetchedAt: Date.now(),
    });
  },
});

/**
 * Reads a cached weather row if present and fresh. Returns null on miss.
 */
export const readWeatherCacheRow = internalQuery({
  args: { district: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("weatherCache")
      .withIndex("by_district", (q) => q.eq("district", args.district))
      .unique();
    if (!row) return null;
    if (Date.now() - row.timestamp >= WEATHER_CACHE_TTL_MS) return null;
    return row;
  },
});

/**
 * Upserts a weather row for a district.
 */
export const writeWeatherCacheRow = internalMutation({
  args: {
    district: v.string(),
    temperature: v.number(),
    condition: v.string(),
    icon: v.string(),
    humidity: v.number(),
    rainfall: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weatherCache")
      .withIndex("by_district", (q) => q.eq("district", args.district))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, timestamp: Date.now() });
      return;
    }
    await ctx.db.insert("weatherCache", { ...args, timestamp: Date.now() });
  },
});
