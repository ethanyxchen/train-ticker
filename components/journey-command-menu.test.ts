import assert from "node:assert/strict";
import test from "node:test";

import { getNextSearchResultIndex } from "./journey-command-menu.tsx";

test("starts keyboard navigation from the first result when moving down", () => {
  assert.equal(getNextSearchResultIndex(null, "ArrowDown", 3), 0);
});

test("starts keyboard navigation from the last result when moving up", () => {
  assert.equal(getNextSearchResultIndex(null, "ArrowUp", 3), 2);
});

test("moves down through the results without going past the end", () => {
  assert.equal(getNextSearchResultIndex(0, "ArrowDown", 3), 1);
  assert.equal(getNextSearchResultIndex(2, "ArrowDown", 3), 2);
});

test("moves up through the results without going past the start", () => {
  assert.equal(getNextSearchResultIndex(2, "ArrowUp", 3), 1);
  assert.equal(getNextSearchResultIndex(0, "ArrowUp", 3), 0);
});

test("stays inactive when there are no results", () => {
  assert.equal(getNextSearchResultIndex(null, "ArrowDown", 0), null);
  assert.equal(getNextSearchResultIndex(0, "ArrowUp", 0), null);
});
