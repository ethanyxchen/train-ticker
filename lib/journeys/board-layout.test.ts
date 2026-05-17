import assert from "node:assert/strict";
import test from "node:test";

import { BASE_BOARD_TICKERS } from "./board-display.ts";
import {
  getBoardWidthRem,
  resolveBoardLayout,
  shouldUseCompactBoardLayout,
} from "./board-layout.ts";

const BASE_TICKERS = BASE_BOARD_TICKERS;
const GAP_REM = 0.75;

test("keeps the hardcoded column widths when the viewport fits the base board", () => {
  const layout = resolveBoardLayout({
    availableRem: getBoardWidthRem(BASE_TICKERS, GAP_REM) + 0.1,
    baseTickers: BASE_TICKERS,
    gapRem: GAP_REM,
  });

  assert.deepEqual(layout.tickers, BASE_TICKERS);
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
    gapRem: GAP_REM,
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
    gapRem: GAP_REM,
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
