import { timingSafeEqual } from "node:crypto";

const attempts = new Map<string, { count: number; resetAt: number }>();

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (origin && appUrl && new URL(origin).origin !== new URL(appUrl).origin) throw new Error("Invalid request origin.");
}

export function assertRateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + windowMs }); return; }
  if (entry.count >= limit) throw new Error("Too many requests. Please wait a minute and try again.");
  entry.count += 1;
}

export function secureEqual(left: string, right: string) {
  const leftValue = Buffer.from(left);
  const rightValue = Buffer.from(right);
  return leftValue.length === rightValue.length && timingSafeEqual(leftValue, rightValue);
}
