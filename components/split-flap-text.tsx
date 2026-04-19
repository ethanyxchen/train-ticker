"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { JourneySnapshotTone } from "@/lib/journeys/types";

interface SplitFlapTextProps {
  value: string;
  length: number;
  align?: "left" | "right";
  tone?: JourneySnapshotTone;
  cycle?: number;
  switchable?: boolean;
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

function getSplitFlapTrackStyle(index: number) {
  return {
    animationDelay: `${index * 18}ms`,
  } satisfies CSSProperties;
}

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
  cycle,
  switchable = true,
}: SplitFlapTextProps) {
  const sanitized = value.toUpperCase().replace(/\s+/g, " ").slice(0, length);
  const padded =
    align === "right"
      ? sanitized.padStart(length, " ")
      : sanitized.padEnd(length, " ");
  const paddedRef = useRef(padded);
  const cycleRef = useRef(cycle);
  const [previousPadded, setPreviousPadded] = useState(padded);
  const [switchCounts, setSwitchCounts] = useState(() =>
    Array.from({ length }, () => 0),
  );

  function switchTicker(index: number) {
    setPreviousPadded(paddedRef.current);
    setSwitchCounts((currentSwitchCounts) =>
      Array.from(
        { length },
        (_, currentIndex) =>
          (currentSwitchCounts[currentIndex] ?? 0) +
          (currentIndex === index ? 1 : 0),
      ),
    );
  }

  useLayoutEffect(() => {
    if (paddedRef.current === padded) {
      return;
    }

    setPreviousPadded(paddedRef.current);
    paddedRef.current = padded;
    setSwitchCounts((currentSwitchCounts) =>
      Array.from(
        { length },
        (_, index) => (currentSwitchCounts[index] ?? 0) + 1,
      ),
    );
  }, [length, padded]);

  useEffect(() => {
    if (cycleRef.current === cycle) {
      return;
    }

    cycleRef.current = cycle;

    if (switchable) {
      setPreviousPadded(paddedRef.current);
      setSwitchCounts((currentSwitchCounts) =>
        Array.from(
          { length },
          (_, index) => (currentSwitchCounts[index] ?? 0) + 1,
        ),
      );
    }
  }, [cycle, length, switchable]);

  const characters = padded.split("");
  const previousCharacters = (switchable ? previousPadded : padded).split("");
  const content = characters.map((character, index) => {
    const previousCharacter = previousCharacters[index] ?? " ";
    const visiblePreviousCharacter =
      previousCharacter === " " ? "\u00A0" : previousCharacter;
    const visibleCharacter = character === " " ? "\u00A0" : character;
    const cellClassName = [
      "relative inline-flex shrink-0 overflow-hidden border border-[#0d0e10] bg-[linear-gradient(180deg,var(--board-cell-top),var(--board-cell-bottom))] font-mono font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_16px_rgba(0,0,0,0.22)]",
      "before:absolute before:inset-x-0 before:top-1/2 before:z-20 before:h-px before:-translate-y-1/2 before:bg-[var(--board-divider)]",
      switchable
        ? "cursor-pointer p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--board-header)]"
        : "",
      toneClasses[tone],
    ].join(" ");
    const track = (
      <span
        className={[
          "absolute inset-x-0 top-0 flex h-[200%] flex-col",
          switchable ? "split-flap-track" : "",
        ].join(" ")}
        style={switchable ? getSplitFlapTrackStyle(index) : undefined}
      >
        <span className="flex h-1/2 items-center justify-center">
          {visiblePreviousCharacter}
        </span>
        <span className="flex h-1/2 items-center justify-center">
          {visibleCharacter}
        </span>
      </span>
    );

    if (!switchable) {
      return (
        <span
          key={`${switchCounts[index] ?? 0}-${index}`}
          className={cellClassName}
          style={splitFlapCellStyle}
        >
          {track}
        </span>
      );
    }

    return (
      <button
        type="button"
        aria-label={`Switch ticker cell ${index + 1} ${
          character.trim() || "blank"
        }`}
        onClick={() => switchTicker(index)}
        key={`${switchCounts[index] ?? 0}-${index}`}
        className={cellClassName}
        style={splitFlapCellStyle}
      >
        {track}
      </button>
    );
  });
  const className = "inline-flex max-w-full flex-nowrap overflow-hidden";

  return (
    <div className={className} style={splitFlapStyle}>
      {content}
    </div>
  );
}
