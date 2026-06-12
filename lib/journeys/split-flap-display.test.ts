import assert from "node:assert/strict";
import test from "node:test";

import {
  SPLIT_FLAP_CHARACTERS,
  getMaxSplitFlapForwardStepCount,
  getMaxSplitFlapInitialStepCount,
  getNextSplitFlapValue,
  getPaddedSplitFlapValue,
  getSplitFlapValueAfterSteps,
  normalizeSplitFlapCharacter,
} from "./split-flap-display.ts";

test("normalizes unsupported characters to blanks", () => {
  assert.equal(normalizeSplitFlapCharacter("*"), " ");
  assert.equal(normalizeSplitFlapCharacter("b"), "B");
  assert.equal(normalizeSplitFlapCharacter(":"), ":");
});

test("pads left-aligned values with trailing blanks", () => {
  assert.equal(getPaddedSplitFlapValue("pad", 5, "left"), "PAD  ");
});

test("pads right-aligned values with leading blanks", () => {
  assert.equal(getPaddedSplitFlapValue("7", 3, "right"), "  7");
});

test("collapses unsupported content before handing it to the package", () => {
  assert.equal(getPaddedSplitFlapValue("a*b", 4, "left"), "A B ");
});

test("gets the next split flap value for replay starts", () => {
  assert.equal(getNextSplitFlapValue("CBG"), "DCH");
  assert.equal(getNextSplitFlapValue("- "), " A");
});

test("gets split flap values after multiple forward steps", () => {
  assert.equal(getSplitFlapValueAfterSteps("CBG", 2), "EDI");
  assert.equal(getSplitFlapValueAfterSteps("CBG", SPLIT_FLAP_CHARACTERS.length), "CBG");
});

test("counts initial split flap steps from the empty cursor", () => {
  assert.equal(getMaxSplitFlapInitialStepCount("DCH"), 9);
});

test("counts forward replay steps through the full character set", () => {
  assert.equal(
    getMaxSplitFlapForwardStepCount("DCH", "CBG"),
    SPLIT_FLAP_CHARACTERS.length - 1,
  );
});
