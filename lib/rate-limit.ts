import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

type RateLimitStore = {
  increment: (
    key: string,
    windowSeconds: number,
  ) => Promise<{
    count: number;
    ttlSeconds: number;
  }>;
};

type RateLimitPolicy = {
  limit: number;
  name: string;
  windowSeconds: number;
};

type RateLimitResult = {
  limit: number;
  remaining: number;
  resetSeconds: number;
};

const RATE_LIMIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return { count, ttl }
`;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const RATE_LIMIT_POLICIES = {
  journeys: {
    limit: parsePositiveInteger(
      process.env.RATE_LIMIT_JOURNEYS_PER_MINUTE,
      10,
    ),
    name: "journeys",
    windowSeconds: 60,
  },
  search: {
    limit: parsePositiveInteger(process.env.RATE_LIMIT_SEARCHES_PER_MINUTE, 30),
    name: "search",
    windowSeconds: 60,
  },
} satisfies Record<string, RateLimitPolicy>;

class UpstashRateLimitStore implements RateLimitStore {
  private readonly script;

  constructor(redis: Redis) {
    this.script = redis.createScript<[number, number]>(RATE_LIMIT_SCRIPT);
  }

  async increment(key: string, windowSeconds: number) {
    const [count, ttlSeconds] = await this.script.exec(
      [key],
      [String(windowSeconds)],
    );

    return {
      count,
      ttlSeconds,
    };
  }
}

let store: RateLimitStore | null | undefined;

function hasRedisCredentials() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
  );
}

function getRateLimitStore() {
  if (store !== undefined) {
    return store;
  }

  store = hasRedisCredentials()
    ? new UpstashRateLimitStore(Redis.fromEnv())
    : null;

  return store;
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function checkRateLimit(
  identity: string,
  policy: RateLimitPolicy,
  rateLimitStore: RateLimitStore,
): Promise<RateLimitResult | null> {
  const key = `rate:${policy.name}:${identity}`;
  const { count, ttlSeconds } = await rateLimitStore.increment(
    key,
    policy.windowSeconds,
  );
  const resetSeconds =
    ttlSeconds > 0 ? ttlSeconds : policy.windowSeconds;

  if (count <= policy.limit) {
    return {
      limit: policy.limit,
      remaining: policy.limit - count,
      resetSeconds,
    };
  }

  return null;
}

export async function enforceRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  rateLimitStore = getRateLimitStore(),
) {
  if (!rateLimitStore) {
    return process.env.NODE_ENV === "production"
      ? NextResponse.json(
          { error: "Service temporarily unavailable." },
          { status: 503 },
        )
      : null;
  }

  const result = await checkRateLimit(
    getClientIp(request),
    policy,
    rateLimitStore,
  );

  if (result) {
    return null;
  }

  const response = NextResponse.json(
    { error: "Too many requests." },
    { status: 429 },
  );
  response.headers.set("Retry-After", String(policy.windowSeconds));
  response.headers.set("X-RateLimit-Limit", String(policy.limit));
  response.headers.set("X-RateLimit-Remaining", "0");
  response.headers.set("X-RateLimit-Reset", String(policy.windowSeconds));

  return response;
}
