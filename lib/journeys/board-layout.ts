export interface BoardTickers {
  time: number;
  origin: number;
  destination: number;
  operator: number;
  platform: number;
  status: number;
}

export interface BoardStationRow {
  originFull: string;
  originAbbreviated: string;
  destinationFull: string;
  destinationAbbreviated: string;
}

interface ResolveBoardStationLayoutOptions {
  availableRem: number;
  baseTickers: BoardTickers;
  rows: BoardStationRow[];
  gapRem: number;
}

const SPLIT_FLAP_WIDTH_REM = 1.376;
const SPLIT_FLAP_GAP_REM = 0.08;

function getAdditionalTickerWidthRem() {
  return getSplitFlapWidthRem(2) - getSplitFlapWidthRem(1);
}

function getMaxStationLength(
  rows: BoardStationRow[],
  key:
    | "originFull"
    | "originAbbreviated"
    | "destinationFull"
    | "destinationAbbreviated",
  minimum: number,
) {
  return rows.reduce<number>(
    (longest, row) => Math.max(longest, row[key].length),
    minimum,
  );
}

export function getBoardWidthRem(tickers: BoardTickers, gapRem: number) {
  return (
    Object.values(tickers).reduce<number>(
      (width, length) => width + getSplitFlapWidthRem(length),
      0,
    ) +
    (Object.keys(tickers).length - 1) * gapRem
  );
}

export function resolveBoardStationLayout({
  availableRem,
  baseTickers,
  rows,
  gapRem,
}: ResolveBoardStationLayoutOptions) {
  const fullTickers = {
    ...baseTickers,
    origin: getMaxStationLength(rows, "originFull", baseTickers.origin),
    destination: getMaxStationLength(
      rows,
      "destinationFull",
      baseTickers.destination,
    ),
  };
  const abbreviatedTickers = {
    ...baseTickers,
    origin: getMaxStationLength(
      rows,
      "originAbbreviated",
      baseTickers.origin,
    ),
    destination: getMaxStationLength(rows, "destinationAbbreviated", 3),
  };
  const useStationAbbreviations =
    rows.length > 0 && availableRem < getBoardWidthRem(fullTickers, gapRem);
  const minimumTickers = useStationAbbreviations
    ? abbreviatedTickers
    : fullTickers;
  const extraCells = Math.max(
    Math.floor(
      (availableRem - getBoardWidthRem(minimumTickers, gapRem)) /
        getAdditionalTickerWidthRem(),
    ),
    0,
  );
  const tickers = {
    ...minimumTickers,
    origin: minimumTickers.origin + Math.ceil(extraCells / 2),
    status: minimumTickers.status + Math.floor(extraCells / 2),
  };

  return {
    tickers,
    insetRem: Math.max((availableRem - getBoardWidthRem(tickers, gapRem)) / 2, 0),
    useStationAbbreviations,
  };
}

function getSplitFlapWidthRem(length: number) {
  return (
    length * SPLIT_FLAP_WIDTH_REM +
    Math.max(length - 1, 0) * SPLIT_FLAP_GAP_REM
  );
}
