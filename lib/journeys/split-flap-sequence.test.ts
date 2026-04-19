import assert from "node:assert/strict";
import test from "node:test";

import {
  SPLIT_FLAP_SWITCH_ORDER,
  getSplitFlapSequence,
  normalizeSplitFlapCharacter,
} from "./split-flap-sequence.ts";

test("normalizes unsupported characters to blanks", () => {
  assert.equal(normalizeSplitFlapCharacter("*"), " ");
  assert.equal(normalizeSplitFlapCharacter("b"), "B");
});

test("walks forward through the analogue switch order", () => {
  assert.deepEqual(getSplitFlapSequence("A", "D"), ["A", "B", "C", "D"]);
  assert.deepEqual(getSplitFlapSequence("Z", "2"), ["Z", "0", "1", "2"]);
  assert.deepEqual(getSplitFlapSequence("9", "-"), ["9", ":", "-"]);
});

test("can force a full cycle back to the same character", () => {
  const sequence = getSplitFlapSequence("A", "A", { forceFullCycle: true });

  assert.equal(sequence[0], "A");
  assert.equal(sequence.at(-1), "A");
  assert.equal(sequence.length, SPLIT_FLAP_SWITCH_ORDER.length + 1);
  assert.ok(sequence.includes("Z"));
  assert.ok(sequence.includes("0"));
});
