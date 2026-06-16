import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToString } from "react-dom/server";

import { JourneyBoard } from "./journey-board.tsx";
import { BASE_BOARD_TICKERS } from "@/lib/journeys/board-display";
import { createSavedJourney } from "@/lib/journeys/identity";

const journey = createSavedJourney({
  provider: "national-rail",
  origin: {
    id: "STP",
    label: "London St Pancras International",
  },
  destination: {
    id: "LEI",
    label: "Leicester",
  },
});

const layout = {
  tickers: BASE_BOARD_TICKERS,
  availableRem: 88,
};

test("renders a busy ticker board before the first live snapshot", () => {
  const html = renderToString(
    React.createElement(JourneyBoard, {
      journey,
      snapshot: undefined,
      previousSnapshot: undefined,
      layout,
      refreshing: false,
      introAnimationId: 1,
    }),
  );

  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-label="Loading"/);
  assert.match(html, /split-flap-digit/);
});
