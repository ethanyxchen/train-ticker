export interface BoardTickers {
  time: number;
  origin: number;
  destination: number;
  operator: number;
  platform: number;
  status: number;
}

export interface ResolvedBoardLayout {
  tickers: BoardTickers;
  insetRem: number;
}

interface ResolveBoardLayoutOptions {
  availableRem: number;
  baseTickers: BoardTickers;
  gapRem: number;
}

const SPLIT_FLAP_WIDTH_REM = 1.376;
const SPLIT_FLAP_GAP_REM = 0.08;

function getAdditionalTickerWidthRem() {
  return getSplitFlapWidthRem(2) - getSplitFlapWidthRem(1);
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

export function resolveBoardLayout({
  availableRem,
  baseTickers,
  gapRem,
}: ResolveBoardLayoutOptions): ResolvedBoardLayout {
  const extraStatusCells = Math.max(
    Math.floor(
      (availableRem - getBoardWidthRem(baseTickers, gapRem)) /
        getAdditionalTickerWidthRem(),
    ),
    0,
  );
  const tickers = {
    ...baseTickers,
    status: baseTickers.status + extraStatusCells,
  };

  return {
    tickers,
    insetRem: Math.max((availableRem - getBoardWidthRem(tickers, gapRem)) / 2, 0),
  };
}

function getSplitFlapWidthRem(length: number) {
  return (
    length * SPLIT_FLAP_WIDTH_REM +
    Math.max(length - 1, 0) * SPLIT_FLAP_GAP_REM
  );
}
