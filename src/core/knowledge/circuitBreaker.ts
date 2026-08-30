/**
 * core/knowledge/circuitBreaker — per-provider "stop hammering it"
 * memory (Knowledge Layer Repair brief §17/§19/§39).
 *
 * In-memory only (module-level `Map`, resets on page reload) — this is
 * deliberately NOT persisted to IndexedDB. A rate-limit or outage is a
 * property of "right now", not something that should silently disable a
 * provider forever after one bad request from a previous session.
 *
 * Every adapter checks `isSourceAvailable(id)` BEFORE firing a request,
 * and reports the outcome afterward. Nothing here retries automatically
 * — retrying is the adapter's/caller's decision; this module only
 * tracks "should I even try right now".
 *
 * IMPORTANT — these cooldowns are NOT derived from, and do not encode,
 * any specific provider's published requests-per-second limit. A
 * provider's own documented rate limit is an external fact that can
 * change at any time. This module never reads or assumes a specific
 * number for any provider; it only reacts
 * to what a provider's response actually says right now (a 429 means
 * "back off," a 5xx/timeout means "try again later"), so a future
 * tightening or loosening of any provider's real limit changes nothing
 * here — the same cooldown logic keeps working correctly either way.
 */

const disabledUntil = new Map<string, number>()

/** A confirmed HTTP 429 gets a longer cooldown — the provider explicitly asked to be left alone. */
const RATE_LIMIT_COOLDOWN_MS = 1000 * 60 * 10 // 10 minutes

/** A generic network error, timeout, or 5xx gets a shorter cooldown — it may well be transient. */
const TRANSIENT_FAILURE_COOLDOWN_MS = 1000 * 60 * 2 // 2 minutes

export function isSourceAvailable(sourceId: string): boolean {
  const until = disabledUntil.get(sourceId)
  return until === undefined || Date.now() >= until
}

export function reportRateLimited(sourceId: string): void {
  disabledUntil.set(sourceId, Date.now() + RATE_LIMIT_COOLDOWN_MS)
}

export function reportTransientFailure(sourceId: string): void {
  // Never override a rate-limit cooldown with a shorter one — if both
  // happen close together, respect whichever cooldown ends later.
  const existing = disabledUntil.get(sourceId)
  const candidate = Date.now() + TRANSIENT_FAILURE_COOLDOWN_MS
  if (!existing || candidate > existing) disabledUntil.set(sourceId, candidate)
}

export function reportSuccess(sourceId: string): void {
  disabledUntil.delete(sourceId)
}
