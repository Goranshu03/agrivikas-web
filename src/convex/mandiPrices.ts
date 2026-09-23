"use node";

import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { API_CONFIG } from "./config";
import { internal } from "./_generated/api";

export interface MandiPriceRecord {
  commodity: string;
  variety: string;
  market: string;
  district: string;
  state: string;
  minPrice: string;
  maxPrice: string;
  modalPrice: string;
  arrivalDate: string;
  unit: string;
}

export interface MandiPricesResult {
  live: boolean;
  source: string;
  fetchedAt: string;
  state?: string;
  district?: string;
  commodity?: string;
  records: MandiPriceRecord[];
  error?: string;
  /** True when records come from the cache because the live feed was unreachable. */
  stale?: boolean;
}

const PRICE_UNIT = "₹/Quintal";

/** Cache key the hourly warmer writes under (not a user-query shape). */
const WARMER_CACHE_KEY = "__warmer__:Punjab:core-crops";

/**
 * Coerces an AGMARKNET field value into a trimmed string. The dataset
 * sometimes returns prices as numbers (e.g. "modal_price": 3200) and
 * sometimes as strings, so both must be accepted.
 */
function fieldToString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/**
 * Normalizes a raw AGMARKNET record from data.gov.in into our stable shape.
 * Field lookup is case-insensitive: the "Current Daily Price" dataset uses
 * snake_case (modal_price) while the "Variety-wise Daily Market Prices"
 * dataset uses PascalCase (Modal_Price) — both are accepted so a dataset
 * switch on data.gov.in's side never breaks parsing again.
 * Returns null when the record is unusable (no commodity or no price).
 */
export function normalizeMandiRecord(data: unknown): MandiPriceRecord | null {
  if (typeof data !== "object" || data === null) return null;
  const raw = data as Record<string, unknown>;

  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    record[key.toLowerCase()] = value;
  }

  const commodity = fieldToString(record.commodity);
  const modalPrice =
    fieldToString(record.modal_price) || fieldToString(record.modalprice);
  if (!commodity || !modalPrice) return null;

  return {
    commodity,
    variety: fieldToString(record.variety) || "—",
    market: fieldToString(record.market) || "—",
    district: fieldToString(record.district) || "—",
    state: fieldToString(record.state) || "—",
    minPrice:
      fieldToString(record.min_price) || fieldToString(record.minprice) || "—",
    maxPrice:
      fieldToString(record.max_price) || fieldToString(record.maxprice) || "—",
    modalPrice,
    arrivalDate:
      fieldToString(record.arrival_date) ||
      fieldToString(record.arrivaldate) ||
      "—",
    unit: PRICE_UNIT,
  };
}

const MANDI_FETCH_TIMEOUT_MS = 10_000;

/**
 * Commodity-level stale fallback: when the exact-query cache has nothing,
 * scan cached rows and collect last-known records for the requested
 * commodities regardless of which query cached them. Records are sorted
 * newest-first and capped so the response stays small.
 */
async function staleFallbackByCommodity(
  ctx: ActionCtx,
  targets: string[]
): Promise<MandiPricesResult | null> {
  try {
    const candidates = await ctx.runQuery(
      internal.cacheStorage.readMandiCacheCandidates,
      {}
    );
    const wanted = targets.map((t) => t.toLowerCase());
    const matched: Array<MandiPriceRecord & { _fetchedAt: number }> = [];

    for (const candidate of candidates) {
      for (const record of candidate.records) {
        const name = record.commodity.toLowerCase();
        // The dataset names varieties as "Paddy(Basmati)", "Cotton(loose)"
        // etc., so a requested crop matches any record whose commodity
        // starts with it.
        if (wanted.some((t) => name.startsWith(t))) {
          matched.push({ ...record, _fetchedAt: candidate.fetchedAtMs });
        }
      }
    }

    if (matched.length === 0) return null;

    matched.sort((a, b) => b._fetchedAt - a._fetchedAt);

    const records: MandiPriceRecord[] = matched.slice(0, 60).map(({ _fetchedAt, ...r }) => r);
    const newestFetchedAt = new Date(matched[0]._fetchedAt).toISOString();

    return {
      live: false,
      stale: true,
      source: "data.gov.in (AGMARKNET)",
      fetchedAt: newestFetchedAt,
      records,
      error:
        "Showing the last available prices — the government price service (data.gov.in) is not reachable right now.",
    } satisfies MandiPricesResult;
  } catch (error) {
    console.error("Mandi commodity-level stale fallback failed:", error);
    return null;
  }
}

/**
 * Hourly cache warmer (runs via crons.ts on every deployment, including a
 * freshly published production site): refreshes prices for the site's core
 * crop list so the "last known prices" fallback has data to serve when
 * data.gov.in has an outage — without waiting for a human to open the page.
 */
export const warmMandiCache = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.DATA_GOV_IN_API_KEY?.trim();
    if (!apiKey || apiKey === "demo") {
      console.warn("Mandi cache warmer: DATA_GOV_IN_API_KEY not set, skipping");
      return;
    }

    const crops = ["Wheat", "Paddy", "Maize", "Cotton"];
    const results = await Promise.allSettled(
      crops.map((crop) =>
        fetchCommodity(apiKey, crop, API_CONFIG.MANDI.DEFAULT_STATE)
      )
    );

    const records = results.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
    if (records.length === 0) {
      console.warn("Mandi cache warmer: live feed unreachable, nothing cached");
      return;
    }

    await ctx.runMutation(internal.cacheStorage.writeMandiCache, {
      cacheKey: WARMER_CACHE_KEY,
      result: {
        live: true,
        source: "data.gov.in (AGMARKNET)",
        fetchedAt: new Date().toISOString(),
        state: API_CONFIG.MANDI.DEFAULT_STATE,
        records,
      } satisfies MandiPricesResult,
    });
  },
});
async function fetchCommodity(
  apiKey: string,
  commodity: string,
  state?: string,
  district?: string
): Promise<MandiPriceRecord[]> {
  const params = new URLSearchParams({
    "api-key": apiKey,
    format: "json",
    limit: String(API_CONFIG.MANDI.LIMIT),
  });
  // data.gov.in filter params use bracket notation
  params.set("filters[commodity]", commodity);
  if (state) params.set("filters[state]", state);
  if (district) params.set("filters[district]", district);

  const response = await fetch(`${API_CONFIG.MANDI.BASE_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    // The data.gov.in gateway sometimes black-holes connections instead of
    // answering — without this timeout the whole action would hang.
    signal: AbortSignal.timeout(MANDI_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error(`Mandi API error for ${commodity}: HTTP ${response.status}`);
    return [];
  }

  const data = (await response.json()) as { records?: unknown[] };
  if (!Array.isArray(data.records)) return [];

  return data.records
    .map(normalizeMandiRecord)
    .filter((r): r is MandiPriceRecord => r !== null)
    .slice(0, 15);
}

export const getMandiPrices = action({
  args: {
    state: v.optional(v.string()),
    district: v.optional(v.string()),
    commodity: v.optional(v.string()),
    crops: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<MandiPricesResult> => {
    // Cache lookup — identical queries within 30 minutes skip the API call.
    const cacheKey = JSON.stringify([
      args.state ?? null,
      args.district ?? null,
      args.commodity ?? null,
      args.crops ?? null,
    ]);
    try {
      const cached = await ctx.runQuery(internal.cacheStorage.readMandiCache, {
        cacheKey,
      });
      if (cached) return cached;
    } catch (error) {
      console.error("Mandi cache read failed:", error);
    }

    const apiKey = process.env.DATA_GOV_IN_API_KEY?.trim();
    const fetchedAt = new Date().toISOString();

    if (!apiKey || apiKey === "demo" || apiKey === "") {
      return {
        live: false,
        source: "data.gov.in (AGMARKNET)",
        fetchedAt,
        state: args.state,
        district: args.district,
        commodity: args.commodity,
        records: [],
        error:
          "DATA_GOV_IN_API_KEY is not configured. Get a free API key at data.gov.in (Developer → API key) and add it in the Backend Environment Variables section of the Keys tab.",
      } satisfies MandiPricesResult;
    }

    const state = args.state || API_CONFIG.MANDI.DEFAULT_STATE;
    const crops = args.crops && args.crops.length > 0 ? args.crops : [];
    const targets = args.commodity
      ? [args.commodity]
      : crops.length > 0
        ? crops
        : ["Wheat", "Paddy", "Maize", "Cotton", "Tomato"];

    try {
      // allSettled: one crop timing out must not kill the others.
      const settled = await Promise.allSettled(
        targets.map((crop) => fetchCommodity(apiKey, crop, state, args.district))
      );
      const records = settled.flatMap((s) =>
        s.status === "fulfilled" ? s.value : []
      );
      const allFailed = settled.every((s) => s.status === "rejected");

      const buildResult = (
        partial: Omit<MandiPricesResult, "source" | "fetchedAt">
      ): MandiPricesResult => ({
        ...partial,
        source: "data.gov.in (AGMARKNET)",
        fetchedAt: new Date().toISOString(),
      });

      // Live feed empty/unreachable — fall back to the last known good
      // result for this exact query so prices don't vanish during
      // data.gov.in outages (the gateway regularly black-holes requests).
      if (records.length === 0) {
        try {
          const lastGood = await ctx.runQuery(
            internal.cacheStorage.readMandiCacheAnyAge,
            { cacheKey }
          );
          if (lastGood && lastGood.records.length > 0) {
            return {
              ...lastGood,
              stale: true,
              error: allFailed
                ? "Showing the last available prices — the government price service (data.gov.in) is not reachable right now."
                : undefined,
            } satisfies MandiPricesResult;
          }

          // Exact query never cached — try to serve last-known records for
          // the requested commodities from any cached query (e.g. the
          // hourly warmer) so a fresh deployment still has prices.
          const byCommodity = await staleFallbackByCommodity(ctx, targets);
          if (byCommodity) return byCommodity;
        } catch (error) {
          console.error("Mandi stale-cache read failed:", error);
        }

        return buildResult({
          live: allFailed ? false : true,
          state,
          district: args.district,
          commodity: args.commodity,
          records: [],
          error: allFailed
            ? "Could not reach the government mandi price service (data.gov.in). Please try again in a few minutes."
            : `No mandi prices found for ${targets.join(", ")} in ${state}. The market may be closed today — try another crop or district.`,
        });
      }

      const success = buildResult({
        live: true,
        state,
        district: args.district,
        commodity: args.commodity,
        records,
      });
      try {
        await ctx.runMutation(internal.cacheStorage.writeMandiCache, {
          cacheKey,
          result: success,
        });
      } catch (error) {
        console.error("Mandi cache write failed:", error);
      }
      return success;
    } catch (error) {
      console.error("Mandi prices fetch error:", error);
      return {
        live: false,
        source: "data.gov.in (AGMARKNET)",
        fetchedAt,
        state,
        district: args.district,
        commodity: args.commodity,
        records: [],
        error:
          "Could not reach the government mandi price service right now. Please try again in a few minutes.",
      } satisfies MandiPricesResult;
    }
  },
});
