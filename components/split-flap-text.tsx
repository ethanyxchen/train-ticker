import type { CSSProperties } from "react";

import type { JourneySnapshotTone } from "@/lib/journeys/types";

interface SplitFlapTextProps {
  value: string;
  length: number;
  align?: "left" | "right";
  tone?: JourneySnapshotTone;
}

export const SPLIT_FLAP_CELL = {
  widthRem: 1.376,
  heightRem: 2.2,
  gapRem: 0.08,
  fontSizeRem: 0.736,
  radiusRem: 0.224,
  paddingInlineRem: 0.144,
} as const;

const splitFlapStyle = {
  gap: `${SPLIT_FLAP_CELL.gapRem}rem`,
} satisfies CSSProperties;

const splitFlapCellStyle = {
  width: `${SPLIT_FLAP_CELL.widthRem}rem`,
  height: `${SPLIT_FLAP_CELL.heightRem}rem`,
  borderRadius: `${SPLIT_FLAP_CELL.radiusRem}rem`,
  paddingInline: `${SPLIT_FLAP_CELL.paddingInlineRem}rem`,
  fontSize: `${SPLIT_FLAP_CELL.fontSizeRem}rem`,
} satisfies CSSProperties;

const toneClasses: Record<JourneySnapshotTone, string> = {
  neutral: "text-[var(--board-text)]",
  good: "text-[var(--good)]",
  warn: "text-[var(--warn)]",
  bad: "text-[var(--bad)]",
};

export function getSplitFlapWidthRem(length: number) {
  return (
    length * SPLIT_FLAP_CELL.widthRem +
    Math.max(length - 1, 0) * SPLIT_FLAP_CELL.gapRem
  );
}

export function getSplitFlapWidth(length: number) {
  return `${getSplitFlapWidthRem(length)}rem`;
}

export function SplitFlapText({
  value,
  length,
  align = "left",
  tone = "neutral",
}: SplitFlapTextProps) {
  const sanitized = value.toUpperCase().replace(/\s+/g, " ").slice(0, length);
  const padded =
    align === "right"
      ? sanitized.padStart(length, " ")
      : sanitized.padEnd(length, " ");

  return (
    <div
      className="inline-flex max-w-full flex-nowrap overflow-hidden"
      style={splitFlapStyle}
    >
      {padded.split("").map((character, index) => (
        <span
          key={`${character}-${index}`}
          className={[
            "relative inline-flex shrink-0 items-center justify-center border border-[#0d0e10] bg-[linear-gradient(180deg,var(--board-cell-top),var(--board-cell-bottom))] font-mono font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_16px_rgba(0,0,0,0.22)]",
            "before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:bg-[var(--board-divider)]",
            toneClasses[tone],
          ].join(" ")}
          style={splitFlapCellStyle}
        >
          <span className="relative z-10">
            {character === " " ? "\u00A0" : character}
          </span>
        </span>
      ))}
    </div>
  );
}
