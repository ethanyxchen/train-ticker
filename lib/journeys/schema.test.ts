import assert from "node:assert/strict";
import test from "node:test";

import { parseJourneyDefinition } from "./schema.ts";

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

test("parses one journey definition", () => {
  assert.deepEqual(parseJourneyDefinition(journeyDefinition), journeyDefinition);
});

test("rejects an invalid journey definition", () => {
  assert.throws(
    () => parseJourneyDefinition({ ...journeyDefinition, destination: null }),
    /invalid journey/i,
  );
});
