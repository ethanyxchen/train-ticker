import assert from "node:assert/strict";
import test from "node:test";

import { BASE_BOARD_TICKERS } from "./board-display.ts";
import {
  getBoardWidthRem,
  getTickerRowWidthRem,
  resolveBoardLayout,
  shouldUseCompactBoardLayout,
} from "./board-layout.ts";
import { getSplitFlapWidthRem } from "./split-flap-metrics.ts";

const BASE_TICKERS = BASE_BOARD_TICKERS;
const GAP_REM = 0.75;

test("keeps the hardcoded column widths when the viewport fits the base board", () => {
  const availableRem = getBoardWidthRem(BASE_TICKERS, GAP_REM) + 0.1;
  const layout = resolveBoardLayout({
    availableRem,
    baseTickers: BASE_TICKERS,
  });

  assert.deepEqual(layout.tickers, BASE_TICKERS);
  assert.equal(layout.availableRem, availableRem);
});

test("keeps the hardcoded column widths even when extra space is available", () => {
  const layout = resolveBoardLayout({
    availableRem:
      getBoardWidthRem(
        {
          ...BASE_TICKERS,
          status: BASE_TICKERS.status + 2,
        },
        GAP_REM,
    ) + 0.1,
    baseTickers: BASE_TICKERS,
  });

  assert.equal(layout.tickers.time, BASE_TICKERS.time);
  assert.equal(layout.tickers.origin, BASE_TICKERS.origin);
  assert.equal(layout.tickers.destination, BASE_TICKERS.destination);
  assert.equal(layout.tickers.status, BASE_TICKERS.status);
});

test("does not shrink the fixed columns when the viewport is narrower than the board", () => {
  const layout = resolveBoardLayout({
    availableRem: getBoardWidthRem(BASE_TICKERS, GAP_REM) - 5,
    baseTickers: BASE_TICKERS,
  });

  assert.equal(layout.tickers.origin, BASE_TICKERS.origin);
  assert.equal(layout.tickers.destination, BASE_TICKERS.destination);
  assert.equal(layout.tickers.status, BASE_TICKERS.status);
});

test("switches to the compact board layout when the viewport is narrower than the board", () => {
  assert.equal(
    shouldUseCompactBoardLayout(
      getBoardWidthRem(BASE_TICKERS, GAP_REM) - 0.1,
      BASE_TICKERS,
      GAP_REM,
    ),
    true,
  );
});

test("keeps the full board layout when the viewport can fit the board", () => {
  assert.equal(
    shouldUseCompactBoardLayout(
      getBoardWidthRem(BASE_TICKERS, GAP_REM),
      BASE_TICKERS,
      GAP_REM,
    ),
    false,
  );
});

test("computes a row width from ticker lengths", () => {
  assert.equal(
    getTickerRowWidthRem([BASE_TICKERS.time, BASE_TICKERS.origin], GAP_REM),
    getSplitFlapWidthRem(BASE_TICKERS.time) +
      getSplitFlapWidthRem(BASE_TICKERS.origin) +
      GAP_REM,
  );
});
