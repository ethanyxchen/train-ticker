import assert from "node:assert/strict";
import test from "node:test";

import {
  getBoardWidthRem,
  resolveBoardLayout,
  shouldUseCompactBoardLayout,
  type BoardTickers,
} from "./board-layout.ts";

const BASE_TICKERS: BoardTickers = {
  time: 5,
  origin: 3,
  destination: 3,
  operator: 3,
  platform: 2,
  status: 10,
};
const GAP_REM = 0.75;

test("keeps the hardcoded column widths when the viewport fits the base board", () => {
  const layout = resolveBoardLayout({
    availableRem: getBoardWidthRem(BASE_TICKERS, GAP_REM) + 0.1,
    baseTickers: BASE_TICKERS,
    gapRem: GAP_REM,
  });

  assert.deepEqual(layout.tickers, BASE_TICKERS);
});

test("uses extra space only to expand the status column", () => {
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

  assert.equal(layout.tickers.origin, BASE_TICKERS.origin);
  assert.equal(layout.tickers.destination, BASE_TICKERS.destination);
  assert.equal(layout.tickers.status, BASE_TICKERS.status + 2);
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
