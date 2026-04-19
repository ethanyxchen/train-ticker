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

export interface ResolvedBoardLayout {
  tickers: BoardTickers;
  insetRem: number;
  useStationAbbreviations: boolean;
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

function getSharedTickerLength(
  rows: BoardStationRow[],
  keys: Array<
    "originFull" | "originAbbreviated" | "destinationFull" | "destinationAbbreviated"
  >,
  minimum: number,
) {
  return keys.reduce<number>(
    (longest, key) => Math.max(longest, getMaxStationLength(rows, key, minimum)),
    minimum,
  );
}

function withSharedColumns(tickers: BoardTickers, sharedLength: number): BoardTickers {
  return {
    ...tickers,
    origin: sharedLength,
    destination: sharedLength,
    status: sharedLength,
  };
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
}: ResolveBoardStationLayoutOptions): ResolvedBoardLayout {
  const fullTickers = withSharedColumns(
    baseTickers,
    getSharedTickerLength(
      rows,
      ["originFull", "destinationFull"],
      baseTickers.status,
    ),
  );
  const abbreviatedTickers = withSharedColumns(
    baseTickers,
    getSharedTickerLength(
      rows,
      ["originAbbreviated", "destinationAbbreviated"],
      baseTickers.status,
    ),
  );
  const useStationAbbreviations =
    rows.length > 0 && availableRem < getBoardWidthRem(fullTickers, gapRem);
  const minimumTickers = useStationAbbreviations
    ? abbreviatedTickers
    : fullTickers;
  const extraSharedCells = Math.max(
    Math.floor(
      (availableRem - getBoardWidthRem(minimumTickers, gapRem)) /
        (getAdditionalTickerWidthRem() * 3),
    ),
    0,
  );
  const tickers = withSharedColumns(
    minimumTickers,
    minimumTickers.origin + extraSharedCells,
  );

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
