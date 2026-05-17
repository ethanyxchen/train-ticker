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
  "RDG_DISRUPTIONS_BASE_URL",
  "RDG_DISRUPTIONS_CONSUMER_KEY",
  "RDG_DISRUPTIONS_USER_AGENT",
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

  if (url.hostname === "disruptions.example.com") {
    return resolveDisruptionsRequest(url);
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

function resolveDisruptionsRequest(url: URL): Response {
  if (url.pathname === "/api/v2/stations/disruptions") {
    return jsonResponse([
      {
        crsCode: "STP",
        disruptions: [
          {
            source: "knowledgebase_incident",
            id: "planned-works-1",
            summary: "Engineering work affects Thameslink northbound services",
            description:
              "Buses replace some late evening services between London St Pancras International and Bedford.",
            isPlanned: true,
            affectedOperators: [{ tocCode: "TL", tocName: "Thameslink" }],
            affectedRoutes: [
              {
                routeDetails:
                  "<p>Late evening journeys between London St Pancras International and Bedford may require a rail replacement bus.</p>",
              },
            ],
            startDateTime: "2026-04-19T00:05:00Z",
            lastModifiedDateTime: "2026-04-19T09:40:00Z",
          },
        ],
      },
      {
        crsCode: "BDM",
        stationAlerts:
          "<p>Rail replacement buses depart from the forecourt outside Bedford station.</p>",
      },
    ]);
  }

  if (url.pathname === "/api/v2/stations/disruptions/incidents") {
    return jsonResponse([
      {
        crsCode: "STP",
        disruptions: [
          {
            source: "knowledgebase_incident",
            id: "incident-1",
            summary: "Engineering work blocks all Bedford services this morning",
            description:
              "Replacement buses are running between London St Pancras International and Bedford until 11:30.",
            isServiceDisruption: true,
            severity: "High",
            affectedOperators: [{ tocCode: "TL", tocName: "Thameslink" }],
            affectedRoutes: [
              {
                routeDetails:
                  "<p>Trains between London St Pancras International and Bedford will not run.</p>",
              },
            ],
            startDateTime: "2026-04-19T08:00:00Z",
            lastModifiedDateTime: "2026-04-19T09:50:00Z",
          },
        ],
      },
    ]);
  }

  if (url.pathname === "/api/v2/stations/disruptions/stationMessages") {
    return jsonResponse([
      {
        crsCode: "STP",
        creationTime: "2026-04-19T09:48:00Z",
        stationDisruptions: [
          {
            source: "darwin_stationmessage",
            category: "Train service",
            severity: "Minor",
            message:
              "Replacement buses are running between London St Pancras International and Bedford.",
          },
        ],
      },
      {
        crsCode: "BDM",
        stationAlerts:
          "<p>Use the Midland Road forecourt for rail replacement buses.</p>",
      },
    ]);
  }

  if (url.pathname === "/api/v2/tocs/TL/serviceIndicators") {
    return jsonResponse({
      tocCode: "TL",
      tocName: "Thameslink",
      tocStatus: "Minor delays",
      tocStatusDescription: "Minor delays across the Bedford corridor",
      tocServiceGroup: [
        {
          name: "Bedford route",
          currentDisruption:
            "Some services are replaced by buses between London St Pancras International and Bedford.",
        },
      ],
    });
  }

  throw new Error(`Unexpected disruptions request: ${url.toString()}`);
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
  "adds disruption alerts without changing healthy Darwin departures",
  { concurrency: false },
  async () => {
  await withMockedRailEnvironment(
    {
      RDG_DISRUPTIONS_BASE_URL: "https://disruptions.example.com/api/v2",
      RDG_DISRUPTIONS_CONSUMER_KEY: "disruptions-key",
    },
    async (requests) => {
      const snapshot = await nationalRailProvider.getSnapshot(STP_TO_BEDFORD);
      const disruptionsRequest = requests.find(
        (request) => new URL(request.url).pathname === "/api/v2/stations/disruptions",
      );

      assert.equal(snapshot.status, "ok");
      assert.equal(snapshot.headline, "Next matching service on time");
      assert.equal(snapshot.options[0]?.scheduledDeparture, "10:05");
      assert.equal(snapshot.options[0]?.operatorCode, "EM");
      assert.match(
        snapshot.alerts.join(" "),
        /Engineering work affects Thameslink northbound services/,
      );
      assert.match(
        snapshot.alerts.join(" "),
        /Thameslink: Minor delays across the Bedford corridor/,
      );
      assert.equal(disruptionsRequest?.headers["x-apikey"], "disruptions-key");
      assert.equal(disruptionsRequest?.headers.authorization, undefined);
      assert.equal(disruptionsRequest?.headers.client_id, undefined);
      assert.equal(disruptionsRequest?.headers.client_secret, undefined);
      assert.equal(disruptionsRequest?.headers["user-agent"], "TrainTicker/0.1");
      assert.equal(
        requests.filter((request) =>
          request.url.includes("/api/v2/stations/disruptions"),
        ).length,
        1,
      );
      assert.equal(
        requests.filter((request) =>
          request.url.includes("/api/v2/tocs/TL/serviceIndicators"),
        ).length,
        1,
      );
    },
  );
  },
);

test(
  "uses RDG disruption context when Darwin returns no matching departures",
  { concurrency: false },
  async () => {
  await withMockedRailEnvironment(
    {
      DARWIN_RDM_PROXY_URL: "https://example.com/GetDepBoardWithDetails/{crs}",
      DARWIN_RDM_CONSUMER_KEY: "test-key",
      RDG_DISRUPTIONS_BASE_URL: "https://disruptions.example.com/api/v2",
      RDG_DISRUPTIONS_CONSUMER_KEY: "disruptions-key",
    },
    async (requests) => {
      globalThis.fetch = (async (input, init) => {
        const request = toMockRailRequest(input, init);
        requests.push(request);
        const url = new URL(request.url);

        if (url.hostname === "example.com") {
          return jsonResponse({
            generatedAt: "2026-04-19T09:55:00Z",
            locationName: "London St Pancras International",
            trainServices: [],
          });
        }

        return resolveDisruptionsRequest(url);
      }) as typeof fetch;

      const snapshot = await nationalRailProvider.getSnapshot(STP_TO_BEDFORD);

      assert.equal(snapshot.status, "error");
      assert.equal(
        snapshot.headline,
        "Engineering work blocks all Bedford services this morning",
      );
      assert.match(
        snapshot.subheadline,
        /Trains between London St Pancras International and Bedford will not run/,
      );
      assert.equal(snapshot.options.length, 0);
      assert.equal(
        snapshot.boardFields.find((field) => field.label === "LIVE")?.value,
        "ALERT",
      );
      assert.match(
        snapshot.alerts.join(" "),
        /Replacement buses are running between London St Pancras International and Bedford/,
      );
      assert.match(
        snapshot.alerts.join(" "),
        /Thameslink: Minor delays across the Bedford corridor/,
      );
      assert.ok(
        requests.some((request) =>
          request.url.includes("/api/v2/stations/disruptions/incidents"),
        ),
      );
      assert.ok(
        requests.some((request) =>
          request.url.includes("/api/v2/stations/disruptions/stationMessages"),
        ),
      );
    },
  );
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
