import assert from "node:assert/strict";
import test from "node:test";

import {
  getNoticeMarqueeText,
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

test("joins notices into one marquee message", () => {
  assert.equal(
    getNoticeMarqueeText([
      "Signal failure between London Bridge and East Croydon.",
      "",
      "Replacement buses are running.",
    ]),
    "Signal failure between London Bridge and East Croydon. ••• Replacement buses are running.",
  );
});

test("converts linked notices to readable marquee text", () => {
  assert.equal(
    getNoticeMarqueeText([
      'More details are available from <a href="https://www.nationalrail.co.uk/">National Rail.</a>',
    ]),
    "More details are available from National Rail.",
  );
});
