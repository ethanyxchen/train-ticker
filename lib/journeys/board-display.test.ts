import assert from "node:assert/strict";
import test from "node:test";

import { getBoardWidthRem } from "./board-layout.ts";
import {
  BASE_BOARD_TICKERS,
  resolveSharedBoardLayout,
} from "./board-display.ts";
import type { SavedJourney } from "./types.ts";

const GAP_REM = 0.75;

const SHORT_JOURNEY: SavedJourney = {
  id: "short",
  name: "York to Leeds",
  provider: "national-rail",
  origin: { id: "YRK", label: "York" },
  destination: { id: "LDS", label: "Leeds" },
};

const LONG_JOURNEY: SavedJourney = {
  id: "long",
  name: "London Liverpool Street to Stratford International",
  provider: "national-rail",
  origin: { id: "LST", label: "London Liverpool Street" },
  destination: { id: "SFA", label: "Stratford International" },
};

test("shared board layout uses one formatting decision across all journeys", () => {
  const availableRem =
    getBoardWidthRem(
      {
        ...BASE_BOARD_TICKERS,
        origin: SHORT_JOURNEY.origin.label.length,
        destination: BASE_BOARD_TICKERS.destination,
      },
      GAP_REM,
    ) + 1;
  const shortLayout = resolveSharedBoardLayout({
    availableRem,
    journeys: [SHORT_JOURNEY],
    gapRem: GAP_REM,
  });
  const longLayout = resolveSharedBoardLayout({
    availableRem,
    journeys: [LONG_JOURNEY],
    gapRem: GAP_REM,
  });
  const sharedLayout = resolveSharedBoardLayout({
    availableRem,
    journeys: [SHORT_JOURNEY, LONG_JOURNEY],
    gapRem: GAP_REM,
  });

  assert.equal(shortLayout.useStationAbbreviations, false);
  assert.equal(longLayout.useStationAbbreviations, true);
  assert.equal(sharedLayout.useStationAbbreviations, true);
  assert.deepEqual(sharedLayout.tickers, longLayout.tickers);
});
