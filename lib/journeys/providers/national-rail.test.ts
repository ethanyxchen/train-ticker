import assert from "node:assert/strict";
import test from "node:test";

import {
  getRailServiceIdentity,
  nationalRailProvider,
} from "./national-rail.ts";

const STP_TO_BEDFORD = {
  id: "journey-1",
  name: "London St Pancras International to Bedford",
  provider: "national-rail" as const,
  origin: {
    id: "STP",
    label: "London St Pancras International",
  },
  destination: {
    id: "BDM",
    label: "Bedford",
  },
};

const RAIL_ENV_KEYS = [
  "DARWIN_RDM_PROXY_URL",
  "DARWIN_RDM_CONSUMER_KEY",
] as const;

type MockRailRequest = {
  url: string;
  headers: Record<string, string>;
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function withMockedRailEnvironment(
  env: Partial<Record<(typeof RAIL_ENV_KEYS)[number], string>>,
  run: (requests: MockRailRequest[]) => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.fromEntries(
    RAIL_ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as Partial<Record<(typeof RAIL_ENV_KEYS)[number], string | undefined>>;
  const requests: MockRailRequest[] = [];

  process.env.DARWIN_RDM_PROXY_URL = "https://example.com/GetDepBoardWithDetails/{crs}";
  process.env.DARWIN_RDM_CONSUMER_KEY = "test-key";

  for (const key of RAIL_ENV_KEYS) {
    if (!(key in env)) {
      continue;
    }

    const value = env[key];

    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }

  globalThis.fetch = (async (input, init) => {
    const request = toMockRailRequest(input, init);
    requests.push(request);

    return resolveRequest(request.url);
  }) as typeof fetch;

  try {
    await run(requests);
  } finally {
    globalThis.fetch = originalFetch;

    for (const key of RAIL_ENV_KEYS) {
      const value = originalEnv[key];

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function toMockRailRequest(input: RequestInfo | URL, init?: RequestInit): MockRailRequest {
  const request = input instanceof Request ? input : null;
  const headers = new Headers(request?.headers);

  new Headers(init?.headers).forEach((value, key) => {
    headers.set(key, value);
  });

  return {
    url: request?.url ?? String(input),
    headers: Object.fromEntries(headers.entries()),
  };
}

function resolveRequest(requestUrl: string): Response {
  const url = new URL(requestUrl);

  if (url.hostname === "example.com") {
    return resolveDarwinRequest(url);
  }

  throw new Error(`Unexpected request URL: ${requestUrl}`);
}

function resolveDarwinRequest(url: URL): Response {
  const isFiltered = url.searchParams.get("filterCrs") === "BDM";
  const timeOffset = url.searchParams.get("timeOffset");

  if (timeOffset === "0") {
    return jsonResponse(
      isFiltered
        ? {
            generatedAt: "2026-04-19T09:55:00Z",
            locationName: "London St Pancras International",
            trainServices: [
              {
                serviceID: "tl-1010",
                std: "10:10",
                etd: "On time",
                sta: "10:52",
                eta: "On time",
                operator: "Thameslink",
                operatorCode: "TL",
                destination: [{ crs: "BDM", locationName: "Bedford" }],
              },
              {
                serviceID: "tl-1020",
                std: "10:20",
                etd: "On time",
                sta: "11:02",
                eta: "On time",
                operator: "Thameslink",
                operatorCode: "TL",
                destination: [{ crs: "BDM", locationName: "Bedford" }],
              },
              {
                serviceID: "tl-1030",
                std: "10:30",
                etd: "On time",
                sta: "11:12",
                eta: "On time",
                operator: "Thameslink",
                operatorCode: "TL",
                destination: [{ crs: "BDM", locationName: "Bedford" }],
              },
              {
                serviceID: "tl-1040",
                std: "10:40",
                etd: "On time",
                sta: "11:22",
                eta: "On time",
                operator: "Thameslink",
                operatorCode: "TL",
                destination: [{ crs: "BDM", locationName: "Bedford" }],
              },
              {
                serviceID: "tl-1050",
                std: "10:50",
                etd: "On time",
                sta: "11:32",
                eta: "On time",
                operator: "Thameslink",
                operatorCode: "TL",
                destination: [{ crs: "BDM", locationName: "Bedford" }],
              },
              {
                serviceID: "tl-1100",
                std: "11:00",
                etd: "On time",
                sta: "11:42",
                eta: "On time",
                operator: "Thameslink",
                operatorCode: "TL",
                destination: [{ crs: "BDM", locationName: "Bedford" }],
              },
            ],
          }
        : {
            generatedAt: "2026-04-19T09:55:00Z",
            locationName: "London St Pancras International",
            trainServices: [
              {
                serviceID: "emr-1005",
                std: "10:05",
                etd: "On time",
                sta: "11:02",
                eta: "On time",
                operator: "East Midlands Railway",
                operatorCode: "EM",
                destination: [{ crs: "NOT", locationName: "Nottingham" }],
                subsequentCallingPoints: [
                  {
                    callingPoint: [
                      {
                        crs: "BDM",
                        locationName: "Bedford",
                        st: "10:35",
                        et: "On time",
                      },
                    ],
                  },
                ],
              },
              {
                serviceID: "tl-1010",
                std: "10:10",
                etd: "On time",
                sta: "10:52",
                eta: "On time",
                operator: "Thameslink",
                operatorCode: "TL",
                destination: [{ crs: "BDM", locationName: "Bedford" }],
              },
              {
                serviceID: "tl-1020",
                std: "10:20",
                etd: "On time",
                sta: "11:02",
                eta: "On time",
                operator: "Thameslink",
                operatorCode: "TL",
                destination: [{ crs: "BDM", locationName: "Bedford" }],
              },
              {
                serviceID: "tl-1030",
                std: "10:30",
                etd: "On time",
                sta: "11:12",
                eta: "On time",
                operator: "Thameslink",
                operatorCode: "TL",
                destination: [{ crs: "BDM", locationName: "Bedford" }],
              },
              {
                serviceID: "emr-1035",
                std: "10:35",
                etd: "10:38",
                sta: "11:32",
                eta: "On time",
                operator: "East Midlands Railway",
                operatorCode: "EM",
                destination: [{ crs: "SHF", locationName: "Sheffield" }],
                subsequentCallingPoints: [
                  {
                    callingPoint: [
                      {
                        crs: "BDM",
                        locationName: "Bedford",
                        st: "11:05",
                        et: "11:08",
                      },
                    ],
                  },
                ],
              },
              {
                serviceID: "tl-1040",
                std: "10:40",
                etd: "On time",
                sta: "11:22",
                eta: "On time",
                operator: "Thameslink",
                operatorCode: "TL",
                destination: [{ crs: "BDM", locationName: "Bedford" }],
              },
            ],
          },
    );
  }

  return jsonResponse({
    generatedAt: "2026-04-19T09:55:00Z",
    locationName: "London St Pancras International",
    trainServices: [],
  });
}

test(
  "merges terminating and stop-only services for mixed Bedford boards",
  { concurrency: false },
  async () => {
  await withMockedRailEnvironment({}, async () => {
    const snapshot = await nationalRailProvider.getSnapshot(STP_TO_BEDFORD);

    assert.equal(snapshot.options[0]?.operator, "East Midlands Railway");
    assert.equal(snapshot.options[0]?.scheduledDeparture, "10:05");
    assert.equal(snapshot.options[0]?.scheduledArrival, "10:35");
    assert.equal(snapshot.options[0]?.title, "Bedford");
    assert.equal(snapshot.options[4]?.operator, "East Midlands Railway");
    assert.equal(snapshot.options[4]?.scheduledDeparture, "10:35");
  });
  },
);

test(
  "adds generic notices and departure-prefixed service alerts",
  { concurrency: false },
  async () => {
  await withMockedRailEnvironment({}, async (requests) => {
    globalThis.fetch = (async (input, init) => {
      const request = toMockRailRequest(input, init);
      requests.push(request);
      const url = new URL(request.url);

      if (url.hostname !== "example.com") {
        throw new Error(`Unexpected request URL: ${request.url}`);
      }

      return jsonResponse({
        generatedAt: "2026-04-19T09:55:00Z",
        locationName: "London St Pancras International",
        nrccMessages: [
          {
            Value:
              "Some trains between London St Pancras International and Bedford may be delayed.",
          },
        ],
        trainServices: [
          {
            serviceID: "tl-1010",
            std: "10:10",
            etd: "On time",
            sta: "10:52",
            eta: "On time",
            operator: "Thameslink",
            operatorCode: "TL",
            destination: [{ crs: "BDM", locationName: "Bedford" }],
            delayReason: "Earlier signalling fault at West Hampstead.",
            adhocAlerts: ["This train has fewer coaches than usual."],
          },
          {
            serviceID: "tl-1020",
            std: "10:20",
            etd: "On time",
            sta: "11:02",
            eta: "On time",
            operator: "Thameslink",
            operatorCode: "TL",
            destination: [{ crs: "BDM", locationName: "Bedford" }],
            delayReason: "This service has been delayed by a fault with the signalling system.",
          },
          {
            serviceID: "tl-1030",
            std: "10:30",
            etd: "On time",
            sta: "11:12",
            eta: "On time",
            operator: "Thameslink",
            operatorCode: "TL",
            destination: [{ crs: "BDM", locationName: "Bedford" }],
          },
          {
            serviceID: "tl-1040",
            std: "10:40",
            etd: "On time",
            sta: "11:22",
            eta: "On time",
            operator: "Thameslink",
            operatorCode: "TL",
            destination: [{ crs: "BDM", locationName: "Bedford" }],
          },
          {
            serviceID: "tl-1050",
            std: "10:50",
            etd: "On time",
            sta: "11:32",
            eta: "On time",
            operator: "Thameslink",
            operatorCode: "TL",
            destination: [{ crs: "BDM", locationName: "Bedford" }],
          },
        ],
      });
    }) as typeof fetch;

      const snapshot = await nationalRailProvider.getSnapshot(STP_TO_BEDFORD);

      assert.equal(snapshot.status, "ok");
      assert.equal(snapshot.headline, "Next matching service on time");
      assert.equal(snapshot.options[0]?.scheduledDeparture, "10:10");
      assert.equal(snapshot.options[0]?.operatorCode, "TL");
      assert.match(
        snapshot.alerts.join(" "),
        /Some trains between London St Pancras International and Bedford may be delayed/,
      );
      assert.deepEqual(
        snapshot.alerts.filter((alert) => alert.startsWith("10:")),
        [
          "10:10 - Earlier signalling fault at West Hampstead.",
          "10:10 - This train has fewer coaches than usual.",
          "10:20 - This service has been delayed by a fault with the signalling system.",
        ],
      );
      assert.equal(
        requests.some((request) => request.url.includes("/api/v2/")),
        false,
      );
  });
  },
);

test("falls back to a stable service identity when Darwin omits serviceID", () => {
  const delayedServiceIdentity = getRailServiceIdentity({
    std: "10:05",
    sta: "10:35",
    operator: "East Midlands Railway",
    operatorCode: "EM",
    destination: [{ crs: "BDM", locationName: "Bedford" }],
  });
  const onTimeServiceIdentity = getRailServiceIdentity({
    std: "10:05",
    sta: "10:35",
    operator: "East Midlands Railway",
    operatorCode: "EM",
    destination: [{ crs: "BDM", locationName: "Bedford" }],
  });

  assert.equal(delayedServiceIdentity, "10:05|10:35|BDM|EM");
  assert.equal(delayedServiceIdentity, onTimeServiceIdentity);
});
