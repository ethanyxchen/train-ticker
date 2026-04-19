const SPLIT_FLAP_SCALE = 1.1;

export const SPLIT_FLAP_CELL = {
  widthRem: 1.376 * SPLIT_FLAP_SCALE,
  heightRem: 2.2 * SPLIT_FLAP_SCALE,
  gapRem: 0.08 * SPLIT_FLAP_SCALE,
  fontSizeRem: 0.736 * SPLIT_FLAP_SCALE,
  radiusRem: 0.224 * SPLIT_FLAP_SCALE,
  paddingInlineRem: 0.144 * SPLIT_FLAP_SCALE,
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
