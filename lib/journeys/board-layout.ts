import { getSplitFlapWidthRem } from "@/lib/journeys/split-flap-metrics";

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
  availableRem: number;
}

interface ResolveBoardLayoutOptions {
  availableRem: number;
  baseTickers: BoardTickers;
}

export function getTickerRowWidthRem(lengths: readonly number[], gapRem: number) {
  return (
    lengths.reduce<number>(
      (width, length) => width + getSplitFlapWidthRem(length),
      0,
    ) +
    Math.max(lengths.length - 1, 0) * gapRem
  );
}

export function getBoardWidthRem(tickers: BoardTickers, gapRem: number) {
  return getTickerRowWidthRem(Object.values(tickers), gapRem);
}

export function shouldUseCompactBoardLayout(
  availableRem: number,
  tickers: BoardTickers,
  gapRem: number,
) {
  return availableRem < getBoardWidthRem(tickers, gapRem);
}

export function resolveBoardLayout({
  availableRem,
  baseTickers,
}: ResolveBoardLayoutOptions): ResolvedBoardLayout {
  return {
    tickers: baseTickers,
    availableRem,
  };
}
