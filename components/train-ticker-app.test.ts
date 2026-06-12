import assert from "node:assert/strict";
import test from "node:test";

import { parseStoredJourney } from "./train-ticker-app.tsx";

const journeyDefinition = {
  provider: "national-rail",
  origin: {
    id: "STP",
    label: "London St Pancras International",
    secondaryLabel: "London",
  },
  destination: {
    id: "LEI",
    label: "Leicester",
  },
};

test("parses a stored journey definition", () => {
  assert.deepEqual(parseStoredJourney(JSON.stringify(journeyDefinition)), {
    ...journeyDefinition,
    id: "national-rail:stp:lei",
    name: "London St Pancras International to Leicester",
  });
});

test("ignores malformed stored journey definitions", () => {
  assert.equal(parseStoredJourney("{"), null);
  assert.equal(
    parseStoredJourney(JSON.stringify({ ...journeyDefinition, origin: null })),
    null,
  );
});
