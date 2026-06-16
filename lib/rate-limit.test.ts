import assert from "node:assert/strict";
import test from "node:test";

import {
  checkRateLimit,
  enforceRateLimit,
  getClientIp,
  hasConfiguredRateLimitStore,
} from "./rate-limit.ts";

function createRequest(headers: Record<string, string> = {}) {
  return new Request("https://train-ticker.local/api/search", { headers });
}

test("uses the first forwarded IP address", () => {
  assert.equal(
    getClientIp(
      createRequest({
        "x-forwarded-for": "203.0.113.10, 198.51.100.20",
      }),
    ),
    "203.0.113.10",
  );
});

test("falls back to x-real-ip", () => {
  assert.equal(
    getClientIp(
      createRequest({
        "x-real-ip": "198.51.100.20",
      }),
    ),
    "198.51.100.20",
  );
});

test("allows requests within the window limit", async () => {
  const result = await checkRateLimit(
    "203.0.113.10",
    {
      limit: 3,
      name: "search",
      windowSeconds: 60,
    },
    {
      increment: async () => ({
        count: 2,
        ttlSeconds: 42,
      }),
    },
  );

  assert.deepEqual(result, {
    limit: 3,
    remaining: 1,
    resetSeconds: 42,
  });
});

test("blocks requests over the window limit", async () => {
  const result = await checkRateLimit(
    "203.0.113.10",
    {
      limit: 3,
      name: "search",
      windowSeconds: 60,
    },
    {
      increment: async () => ({
        count: 4,
        ttlSeconds: 35,
      }),
    },
  );

  assert.equal(result, null);
});

test("returns a 429 response for limited requests", async () => {
  const response = await enforceRateLimit(
    createRequest(),
    {
      limit: 3,
      name: "search",
      windowSeconds: 60,
    },
    {
      increment: async () => ({
        count: 4,
        ttlSeconds: 35,
      }),
    },
  );

  assert.equal(response?.status, 429);
  assert.equal(response?.headers.get("Retry-After"), "60");
  assert.equal(response?.headers.get("X-RateLimit-Limit"), "3");
  assert.equal(response?.headers.get("X-RateLimit-Remaining"), "0");
});

test("requires a configured store in production", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    const response = await enforceRateLimit(
      createRequest(),
      {
        limit: 3,
        name: "search",
        windowSeconds: 60,
      },
      null,
    );

    assert.equal(response?.status, 503);
  } finally {
    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});

test("recognizes Redis URL credentials", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  process.env.REDIS_URL = "redis://localhost:6379";

  try {
    assert.equal(hasConfiguredRateLimitStore(), true);
  } finally {
    if (originalRedisUrl === undefined) {
      Reflect.deleteProperty(process.env, "REDIS_URL");
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  }
});
