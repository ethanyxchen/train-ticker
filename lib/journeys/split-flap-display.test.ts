import assert from "node:assert/strict";
import test from "node:test";

import {
  getPaddedSplitFlapValue,
  normalizeSplitFlapCharacter,
} from "./split-flap-display";

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
