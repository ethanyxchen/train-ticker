export const SPLIT_FLAP_CELL = {
  widthRem: 1.376,
  heightRem: 2.2,
  gapRem: 0.08,
  fontSizeRem: 0.736,
  radiusRem: 0.224,
  paddingInlineRem: 0.144,
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
