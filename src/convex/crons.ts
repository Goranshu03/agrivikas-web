import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sweep expired rate-limit rows and stale cache entries every hour.
crons.hourly(
  "cleanup expired rate limits and caches",
  { minuteUTC: 5 },
  internal.rateLimit.cleanupExpired
);

// Warm the mandi price cache every hour so the "last known prices" fallback
// has data even on a freshly published site (production included) and so
// cached prices stay reasonably current across data.gov.in outages.
crons.hourly(
  "warm mandi price cache",
  { minuteUTC: 25 },
  internal.mandiPrices.warmMandiCache
);

export default crons;
