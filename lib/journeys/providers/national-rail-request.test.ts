import assert from "node:assert/strict";
import test from "node:test";

import { buildRailRequestUrl } from "./national-rail-request";

test("adds destination filtering to Darwin board requests", () => {
  const requestUrl = new URL(
    buildRailRequestUrl(
      {
        origin: {
          id: "LST",
        },
        destination: {
          id: "CBG",
        },
      },
      {
        proxyUrl: "https://example.com/GetDepBoardWithDetails/{crs}",
      },
      {
        numRows: 20,
        timeOffset: 60,
        timeWindow: 120,
      },
    ),
  );

  assert.equal(requestUrl.pathname, "/GetDepBoardWithDetails/LST");
  assert.equal(requestUrl.searchParams.get("filterCrs"), "CBG");
  assert.equal(requestUrl.searchParams.get("filterType"), "to");
  assert.equal(requestUrl.searchParams.get("numRows"), "20");
  assert.equal(requestUrl.searchParams.get("timeOffset"), "60");
  assert.equal(requestUrl.searchParams.get("timeWindow"), "120");
});

test("can build an unfiltered Darwin board request", () => {
  const requestUrl = new URL(
    buildRailRequestUrl(
      {
        origin: {
          id: "STP",
        },
        destination: {
          id: "BDM",
        },
      },
      {
        proxyUrl: "https://example.com/GetDepBoardWithDetails/{crs}",
      },
      {
        filterDestination: false,
      },
    ),
  );

  assert.equal(requestUrl.pathname, "/GetDepBoardWithDetails/STP");
  assert.equal(requestUrl.searchParams.get("filterCrs"), null);
  assert.equal(requestUrl.searchParams.get("filterType"), null);
});
