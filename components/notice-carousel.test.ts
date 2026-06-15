import assert from "node:assert/strict";
import test from "node:test";

import {
  getNoticeCarouselIndex,
  getNoticeMessages,
} from "./notice-carousel.tsx";

test("normalizes notice messages for display", () => {
  assert.deepEqual(
    getNoticeMessages([
      "  Signal failure between London Bridge and East Croydon.  ",
      "",
      "   ",
      "Replacement buses are running.",
    ]),
    [
      "Signal failure between London Bridge and East Croydon.",
      "Replacement buses are running.",
    ],
  );
});

test("cycles notice carousel indices", () => {
  assert.equal(getNoticeCarouselIndex(0, 1, 3), 1);
  assert.equal(getNoticeCarouselIndex(2, 1, 3), 0);
  assert.equal(getNoticeCarouselIndex(0, -1, 3), 2);
  assert.equal(getNoticeCarouselIndex(1, -1, 3), 0);
});

test("keeps an empty carousel pinned to the first index", () => {
  assert.equal(getNoticeCarouselIndex(2, 1, 0), 0);
});
