import assert from "node:assert/strict";
import test from "node:test";

import {
  getBoardWidthRem,
  resolveBoardStationLayout,
  type BoardTickers,
  type BoardStationRow,
} from "./board-layout.ts";

const BASE_TICKERS: BoardTickers = {
  time: 5,
  origin: 3,
  destination: 22,
  operator: 3,
  platform: 2,
  status: 7,
};
const GAP_REM = 0.75;

test("keeps full station names when the viewport can fit them", () => {
  const rows: BoardStationRow[] = [
    {
      originFull: "London St Pancras",
      originAbbreviated: "STP",
      destinationFull: "Leicester",
      destinationAbbreviated: "LEI",
    },
  ];
  const availableRem =
    getBoardWidthRem(
      {
        ...BASE_TICKERS,
        origin: "London St Pancras".length,
        destination: BASE_TICKERS.destination,
      },
      GAP_REM,
    ) + 0.1;
  const layout = resolveBoardStationLayout({
    availableRem,
    baseTickers: BASE_TICKERS,
    rows,
    gapRem: GAP_REM,
  });

  assert.equal(layout.useStationAbbreviations, false);
  assert.equal(layout.tickers.origin, "London St Pancras".length);
  assert.equal(layout.tickers.destination, BASE_TICKERS.destination);
});

test("switches to abbreviations when the viewport cannot fit the longest names", () => {
  const rows: BoardStationRow[] = [
    {
      originFull: "London St Pancras International",
      originAbbreviated: "STP",
      destinationFull: "Birmingham New Street",
      destinationAbbreviated: "BHM",
    },
  ];
  const abbreviatedWidthRem = getBoardWidthRem(
    {
      ...BASE_TICKERS,
      origin: 3,
      destination: 3,
    },
    GAP_REM,
  );
  const layout = resolveBoardStationLayout({
    availableRem: abbreviatedWidthRem + 0.1,
    baseTickers: BASE_TICKERS,
    rows,
    gapRem: GAP_REM,
  });

  assert.equal(layout.useStationAbbreviations, true);
  assert.equal(layout.tickers.origin, 3);
  assert.equal(layout.tickers.destination, 3);
});

test("uses a dynamic cutoff derived from the current row lengths", () => {
  const shortRows: BoardStationRow[] = [
    {
      originFull: "York",
      originAbbreviated: "YRK",
      destinationFull: "Leeds",
      destinationAbbreviated: "LDS",
    },
  ];
  const longRows: BoardStationRow[] = [
    {
      originFull: "London Liverpool Street",
      originAbbreviated: "LST",
      destinationFull: "Stratford International",
      destinationAbbreviated: "SFA",
    },
  ];
  const availableRem =
    getBoardWidthRem(
      {
        ...BASE_TICKERS,
        origin: "York".length,
        destination: BASE_TICKERS.destination,
      },
      GAP_REM,
    ) + 1;
  const shortLayout = resolveBoardStationLayout({
    availableRem,
    baseTickers: BASE_TICKERS,
    rows: shortRows,
    gapRem: GAP_REM,
  });
  const longLayout = resolveBoardStationLayout({
    availableRem,
    baseTickers: BASE_TICKERS,
    rows: longRows,
    gapRem: GAP_REM,
  });

  assert.equal(shortLayout.useStationAbbreviations, false);
  assert.equal(longLayout.useStationAbbreviations, true);
});
