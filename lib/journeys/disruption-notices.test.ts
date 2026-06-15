import assert from "node:assert/strict";
import test from "node:test";

import { filterDisruptionNotices } from "./disruption-notices.ts";

test("skips step-free access notices", () => {
  assert.deepEqual(
    filterDisruptionNotices([
      "Step-free access is not available at Farringdon.",
      "Some trains between London St Pancras International and Bedford may be delayed.",
      "Access to step free routes is limited at London Bridge.",
      "Replacement buses are running.",
    ]),
    [
      "Some trains between London St Pancras International and Bedford may be delayed.",
      "Replacement buses are running.",
    ],
  );
});

test("matches step-free notices after removing inline markup", () => {
  assert.deepEqual(
    filterDisruptionNotices([
      'Step-free <a href="https://www.nationalrail.co.uk/">access</a> is unavailable.',
      "A fault with the signalling system is causing delays.",
    ]),
    ["A fault with the signalling system is causing delays."],
  );
});
