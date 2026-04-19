"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  SPLIT_FLAP_CELL,
  getSplitFlapWidth,
  getSplitFlapWidthRem,
} from "@/lib/journeys/split-flap-metrics";
import {
  getSplitFlapSequence,
  normalizeSplitFlapCharacter,
} from "@/lib/journeys/split-flap-sequence";
import type { JourneySnapshotTone } from "@/lib/journeys/types";

export { SPLIT_FLAP_CELL, getSplitFlapWidth, getSplitFlapWidthRem };

interface SplitFlapTextProps {
  value: string;
  length: number;
  align?: "left" | "right";
  tone?: JourneySnapshotTone;
  cycle?: number;
  switchable?: boolean;
}

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

type SplitFlapTrackStyle = CSSProperties & {
  "--split-flap-frame-count": number;
};

function getSplitFlapTrackStyle(
  index: number,
  frameCount: number,
): SplitFlapTrackStyle {
  const stepCount = Math.max(frameCount - 1, 1);

  return {
    animationDelay: `${index * 18}ms`,
    animationDuration: `${Math.max(stepCount * 28, 180)}ms`,
    animationTimingFunction: `steps(${stepCount}, end)`,
    height: `${frameCount * 100}%`,
    "--split-flap-frame-count": frameCount,
  };
}

const toneClasses: Record<JourneySnapshotTone, string> = {
  neutral: "text-[var(--board-text)]",
  good: "text-[var(--good)]",
  warn: "text-[var(--warn)]",
  bad: "text-[var(--bad)]",
};

export function SplitFlapText({
  value,
  length,
  align = "left",
  tone = "neutral",
  cycle,
  switchable = true,
}: SplitFlapTextProps) {
  const sanitized = value.toUpperCase().replace(/\s+/g, " ").slice(0, length);
  const padded = Array.from(
    (
      align === "right"
        ? sanitized.padStart(length, " ")
        : sanitized.padEnd(length, " ")
    ),
    normalizeSplitFlapCharacter,
  ).join("");
  const displayedPaddedRef = useRef(padded);
  const cycleRef = useRef(cycle);
  const [startPadded, setStartPadded] = useState(padded);
  const [switchState, setSwitchState] = useState(() => ({
    runs: Array.from({ length }, () => 0),
    forcedCycleRuns: Array.from({ length }, () => -1),
  }));

  function switchTicker(index: number) {
    setStartPadded(displayedPaddedRef.current);
    setSwitchState((currentSwitchState) => ({
      runs: Array.from(
        { length },
        (_, currentIndex) =>
          (currentSwitchState.runs[currentIndex] ?? 0) +
          (currentIndex === index ? 1 : 0),
      ),
      forcedCycleRuns: Array.from({ length }, (_, currentIndex) =>
        currentIndex === index
          ? (currentSwitchState.runs[currentIndex] ?? 0) + 1
          : (currentSwitchState.forcedCycleRuns[currentIndex] ?? -1),
      ),
    }));
  }

  useLayoutEffect(() => {
    if (displayedPaddedRef.current === padded) {
      return;
    }

    const previousPadded = displayedPaddedRef.current;

    setStartPadded(previousPadded);
    displayedPaddedRef.current = padded;
    setSwitchState((currentSwitchState) => ({
      runs: Array.from(
        { length },
        (_, index) =>
          (currentSwitchState.runs[index] ?? 0) +
          (previousPadded[index] === padded[index] ? 0 : 1),
      ),
      forcedCycleRuns: Array.from(
        { length },
        (_, index) =>
          previousPadded[index] === padded[index]
            ? (currentSwitchState.forcedCycleRuns[index] ?? -1)
            : -1,
      ),
    }));
  }, [length, padded]);

  useEffect(() => {
    if (cycleRef.current === cycle) {
      return;
    }

    cycleRef.current = cycle;

    if (!switchable) {
      return;
    }

    setStartPadded(displayedPaddedRef.current);
    setSwitchState((currentSwitchState) => ({
      runs: Array.from(
        { length },
        (_, index) => (currentSwitchState.runs[index] ?? 0) + 1,
      ),
      forcedCycleRuns: Array.from(
        { length },
        (_, index) => (currentSwitchState.runs[index] ?? 0) + 1,
      ),
    }));
  }, [cycle, length, switchable]);

  const characters = padded.split("");
  const startCharacters = (switchable ? startPadded : padded).split("");
  const content = characters.map((character, index) => {
    const currentSwitchRun = switchState.runs[index] ?? 0;
    const startCharacter = startCharacters[index] ?? " ";
    const forceFullCycle =
      (switchState.forcedCycleRuns[index] ?? -1) === currentSwitchRun;
    const shouldAnimate =
      switchable && (startCharacter !== character || forceFullCycle);
    const sequence = shouldAnimate
      ? getSplitFlapSequence(startCharacter, character, {
          forceFullCycle,
        })
      : [character];
    const frameStyle = {
      height: `${100 / sequence.length}%`,
    } satisfies CSSProperties;
    const visibleCharacter = character === " " ? "\u00A0" : character;
    const cellClassName = [
      "relative isolate inline-flex shrink-0 overflow-hidden border border-[#0d0e10] bg-[linear-gradient(180deg,var(--board-cell-top),var(--board-cell-bottom))] font-mono font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_16px_rgba(0,0,0,0.22)]",
      "before:absolute before:inset-x-0 before:top-1/2 before:z-20 before:h-px before:-translate-y-1/2 before:bg-[var(--board-divider)]",
      switchable
        ? "cursor-pointer p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--board-header)]"
        : "",
      toneClasses[tone],
    ].join(" ");
    const track = shouldAnimate ? (
      <span
        className="split-flap-track absolute inset-x-0 top-0 flex flex-col"
        style={getSplitFlapTrackStyle(index, sequence.length)}
      >
        {sequence.map((sequenceCharacter, sequenceIndex) => (
          <span
            key={`${currentSwitchRun}-${sequenceIndex}-${sequenceCharacter}`}
            className="flex items-center justify-center"
            style={frameStyle}
          >
            {sequenceCharacter === " " ? "\u00A0" : sequenceCharacter}
          </span>
        ))}
      </span>
    ) : (
      <span className="absolute inset-0 flex items-center justify-center">
        {visibleCharacter}
      </span>
    );

    if (!switchable) {
      return (
        <span
          key={`${currentSwitchRun}-${index}`}
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
        key={`${currentSwitchRun}-${index}`}
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
