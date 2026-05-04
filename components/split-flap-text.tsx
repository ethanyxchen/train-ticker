"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SplitFlap } from "react-split-flap";

import {
  SPLIT_FLAP_CELL,
  getSplitFlapWidth,
  getSplitFlapWidthRem,
} from "@/lib/journeys/split-flap-metrics";
import {
  SPLIT_FLAP_CHARACTERS,
  getPaddedSplitFlapValue,
} from "@/lib/journeys/split-flap-display";
import type { JourneySnapshotTone } from "@/lib/journeys/types";

export { SPLIT_FLAP_CELL, getSplitFlapWidth, getSplitFlapWidthRem };

interface SplitFlapTextProps {
  value: string;
  length: number;
  align?: "left" | "right";
  tone?: JourneySnapshotTone;
  cycle?: number;
  animateOnMount?: boolean;
  switchable?: boolean;
}

type SplitFlapStyle = CSSProperties & {
  "--train-ticker-flap-gap": string;
  "--train-ticker-flap-width": string;
  "--train-ticker-flap-height": string;
  "--train-ticker-flap-radius": string;
  "--train-ticker-flap-padding-inline": string;
};

const splitFlapStyle = {
  fontSize: `${SPLIT_FLAP_CELL.fontSizeRem}rem`,
  "--train-ticker-flap-gap": `${SPLIT_FLAP_CELL.gapRem}rem`,
  "--train-ticker-flap-width": `${SPLIT_FLAP_CELL.widthRem}rem`,
  "--train-ticker-flap-height": `${SPLIT_FLAP_CELL.heightRem}rem`,
  "--train-ticker-flap-radius": `${SPLIT_FLAP_CELL.radiusRem}rem`,
  "--train-ticker-flap-padding-inline": `${SPLIT_FLAP_CELL.paddingInlineRem}rem`,
} satisfies SplitFlapStyle;

const toneColors: Record<JourneySnapshotTone, string> = {
  neutral: "var(--board-text)",
  good: "var(--good)",
  warn: "var(--warn)",
  bad: "var(--bad)",
};
const splitFlapCharacters = [...SPLIT_FLAP_CHARACTERS];
const REPLAY_SETTLE_MS = 70;

function getReplayLabel(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : "blank";
}

function getReplayStepValue(value: string) {
  return Array.from(value, (character) => {
    const index = SPLIT_FLAP_CHARACTERS.indexOf(character);

    return index === -1
      ? character
      : SPLIT_FLAP_CHARACTERS[(index + 1) % SPLIT_FLAP_CHARACTERS.length];
  }).join("");
}

function renderHost(
  children: ReactNode,
  switchable: boolean,
  value: string,
  onReplay: () => void,
) {
  const className = switchable
    ? "inline-flex max-w-full cursor-pointer flex-nowrap overflow-hidden rounded-[0.18rem] border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--board-header)]"
    : "inline-flex max-w-full flex-nowrap overflow-hidden";

  if (!switchable) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button
      type="button"
      aria-label={`Replay split flap ${getReplayLabel(value)}`}
      onClick={onReplay}
      className={className}
    >
      {children}
    </button>
  );
}

export function SplitFlapText({
  value,
  length,
  align = "left",
  tone = "neutral",
  cycle,
  switchable = true,
}: SplitFlapTextProps) {
  const paddedValue = getPaddedSplitFlapValue(value, length, align);
  const [transientValue, setTransientValue] = useState<string | null>(null);
  const [manualReplayVersion, setManualReplayVersion] = useState(0);
  const previousCycleRef = useRef<number | undefined>(undefined);
  const previousManualReplayVersionRef = useRef(0);

  useEffect(() => {
    const cycleChanged =
      cycle !== undefined && cycle !== previousCycleRef.current;
    const manualReplayChanged =
      manualReplayVersion !== previousManualReplayVersionRef.current;

    previousCycleRef.current = cycle;
    previousManualReplayVersionRef.current = manualReplayVersion;

    if (!cycleChanged && !manualReplayChanged) {
      return;
    }

    setTransientValue(getReplayStepValue(paddedValue));

    const timeoutId = window.setTimeout(() => {
      setTransientValue(null);
    }, REPLAY_SETTLE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [cycle, manualReplayVersion, paddedValue]);

  return (
    <SplitFlap
      value={transientValue ?? paddedValue}
      length={length}
      chars={splitFlapCharacters}
      padChar=" "
      padMode={align === "right" ? "start" : "end"}
      timing={28}
      hinge
      className="train-ticker-split-flap"
      style={splitFlapStyle}
      background="linear-gradient(180deg,var(--board-cell-top),var(--board-cell-bottom))"
      fontColor={toneColors[tone]}
      render={(children) =>
        renderHost(children, switchable, paddedValue, () =>
          setManualReplayVersion(
            (currentManualReplayVersion) => currentManualReplayVersion + 1,
          ),
        )
      }
    />
  );
}
