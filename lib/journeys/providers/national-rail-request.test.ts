import assert from "node:assert/strict";
import test from "node:test";

import { buildRailRequestUrl } from "./national-rail-request";

test("adds destination filtering to Darwin board requests", () => {
  const requestUrl = new URL(
    buildRailRequestUrl(
      {
        id: "journey-1",
        name: "London Liverpool Street to Cambridge",
        provider: "national-rail",
        origin: {
          id: "LST",
          label: "London Liverpool Street",
        },
        destination: {
          id: "CBG",
          label: "Cambridge",
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
        id: "journey-1",
        name: "London St Pancras International to Bedford",
        provider: "national-rail",
        origin: {
          id: "STP",
          label: "London St Pancras International",
        },
        destination: {
          id: "BDM",
          label: "Bedford",
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
