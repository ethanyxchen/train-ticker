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
        destination: "London St Pancras".length,
        status: "London St Pancras".length,
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
  assert.equal(layout.tickers.destination, "London St Pancras".length);
  assert.equal(layout.tickers.status, "London St Pancras".length);
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
      origin: BASE_TICKERS.status,
      destination: BASE_TICKERS.status,
      status: BASE_TICKERS.status,
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
  assert.equal(layout.tickers.origin, BASE_TICKERS.status);
  assert.equal(layout.tickers.destination, BASE_TICKERS.status);
  assert.equal(layout.tickers.status, BASE_TICKERS.status);
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
        origin: BASE_TICKERS.status,
        destination: BASE_TICKERS.status,
        status: BASE_TICKERS.status,
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

test("keeps origin destination and status widths equal", () => {
  const rows: BoardStationRow[] = [
    {
      originFull: "London Kings Cross",
      originAbbreviated: "KGX",
      destinationFull: "Cambridge",
      destinationAbbreviated: "CBG",
    },
  ];
  const layout = resolveBoardStationLayout({
    availableRem: 120,
    baseTickers: BASE_TICKERS,
    rows,
    gapRem: GAP_REM,
  });

  assert.equal(layout.tickers.origin, layout.tickers.destination);
  assert.equal(layout.tickers.destination, layout.tickers.status);
});
