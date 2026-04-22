const SPLIT_FLAP_SIZE_REM = 1.9;

export const SPLIT_FLAP_CELL = {
  widthRem: SPLIT_FLAP_SIZE_REM,
  heightRem: SPLIT_FLAP_SIZE_REM,
  gapRem: 0.08,
  fontSizeRem: SPLIT_FLAP_SIZE_REM,
  radiusRem: 0.18,
  paddingInlineRem: 0,
} as const;

export function getSplitFlapWidthRem(length: number) {
  return (
    length * SPLIT_FLAP_CELL.widthRem +
    Math.max(length - 1, 0) * SPLIT_FLAP_CELL.gapRem
  );
}

export function getSplitFlapWidth(length: number) {
  return `${getSplitFlapWidthRem(length)}rem`;
}
