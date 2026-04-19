import assert from "node:assert/strict";
import test from "node:test";

import { nationalRailProvider } from "./national-rail.ts";

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

test("merges terminating and stop-only services for mixed Bedford boards", async () => {
  const originalFetch = globalThis.fetch;
  const originalProxyUrl = process.env.DARWIN_RDM_PROXY_URL;
  const originalConsumerKey = process.env.DARWIN_RDM_CONSUMER_KEY;

  process.env.DARWIN_RDM_PROXY_URL = "https://example.com/GetDepBoardWithDetails/{crs}";
  process.env.DARWIN_RDM_CONSUMER_KEY = "test-key";

  const requestUrls: string[] = [];

  globalThis.fetch = (async (input) => {
    const requestUrl = String(input);
    requestUrls.push(requestUrl);

    const url = new URL(requestUrl);
    const isFiltered = url.searchParams.get("filterCrs") === "BDM";
    const body = isFiltered
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
              destination: [{ crs: "BDM", locationName: "Bedford" }],
            },
            {
              serviceID: "tl-1020",
              std: "10:20",
              etd: "On time",
              sta: "11:02",
              eta: "On time",
              operator: "Thameslink",
              destination: [{ crs: "BDM", locationName: "Bedford" }],
            },
            {
              serviceID: "tl-1030",
              std: "10:30",
              etd: "On time",
              sta: "11:12",
              eta: "On time",
              operator: "Thameslink",
              destination: [{ crs: "BDM", locationName: "Bedford" }],
            },
            {
              serviceID: "tl-1040",
              std: "10:40",
              etd: "On time",
              sta: "11:22",
              eta: "On time",
              operator: "Thameslink",
              destination: [{ crs: "BDM", locationName: "Bedford" }],
            },
            {
              serviceID: "tl-1050",
              std: "10:50",
              etd: "On time",
              sta: "11:32",
              eta: "On time",
              operator: "Thameslink",
              destination: [{ crs: "BDM", locationName: "Bedford" }],
            },
            {
              serviceID: "tl-1100",
              std: "11:00",
              etd: "On time",
              sta: "11:42",
              eta: "On time",
              operator: "Thameslink",
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
              destination: [{ crs: "BDM", locationName: "Bedford" }],
            },
            {
              serviceID: "tl-1020",
              std: "10:20",
              etd: "On time",
              sta: "11:02",
              eta: "On time",
              operator: "Thameslink",
              destination: [{ crs: "BDM", locationName: "Bedford" }],
            },
            {
              serviceID: "tl-1030",
              std: "10:30",
              etd: "On time",
              sta: "11:12",
              eta: "On time",
              operator: "Thameslink",
              destination: [{ crs: "BDM", locationName: "Bedford" }],
            },
            {
              serviceID: "emr-1035",
              std: "10:35",
              etd: "10:38",
              sta: "11:32",
              eta: "On time",
              operator: "East Midlands Railway",
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
              destination: [{ crs: "BDM", locationName: "Bedford" }],
            },
          ],
        };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }) as typeof fetch;

  try {
    const snapshot = await nationalRailProvider.getSnapshot(STP_TO_BEDFORD);

    assert.equal(requestUrls.length, 2);
    assert.equal(snapshot.options[0]?.operator, "East Midlands Railway");
    assert.equal(snapshot.options[0]?.scheduledDeparture, "10:05");
    assert.equal(snapshot.options[0]?.scheduledArrival, "10:35");
    assert.equal(snapshot.options[0]?.title, "Bedford");
    assert.equal(snapshot.options[4]?.operator, "East Midlands Railway");
    assert.equal(snapshot.options[4]?.scheduledDeparture, "10:35");
  } finally {
    globalThis.fetch = originalFetch;

    if (originalProxyUrl === undefined) {
      delete process.env.DARWIN_RDM_PROXY_URL;
    } else {
      process.env.DARWIN_RDM_PROXY_URL = originalProxyUrl;
    }

    if (originalConsumerKey === undefined) {
      delete process.env.DARWIN_RDM_CONSUMER_KEY;
    } else {
      process.env.DARWIN_RDM_CONSUMER_KEY = originalConsumerKey;
    }
  }
});
