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
  animationId?: number | string;
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

const splitFlapCharacters = [...SPLIT_FLAP_CHARACTERS];
const SPLIT_FLAP_TIMING_MS = 28;
const REPLAY_SETTLE_MS = 70;
const ANIMATION_BUFFER_MS = 140;

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
    ? "inline-flex cursor-pointer flex-nowrap rounded-[0.18rem] border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--board-header)]"
    : "inline-flex flex-nowrap";

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

function getAnimationDurationMs(length: number) {
  return Math.max(length, 1) * SPLIT_FLAP_TIMING_MS + REPLAY_SETTLE_MS + ANIMATION_BUFFER_MS;
}

function getStaticDigitMode(character: string) {
  return /^[\s0-9]$/.test(character) ? "num" : "alpha";
}

function renderStaticCharacter(character: string, index: number) {
  const displayCharacter = character === " " ? "\u00a0" : character;

  return (
    <span
      key={index}
      className="split-flap-digit"
      data-kind="digit"
      data-mode={getStaticDigitMode(character)}
      aria-hidden="true"
    >
      <span className="split-flap-part top">
        <span className="split-flap-char">{displayCharacter}</span>
        <span className="split-flap-hinge" data-kind="hinge" />
      </span>
      <span className="split-flap-part bottom">
        <span className="split-flap-char">{displayCharacter}</span>
        <span className="split-flap-hinge" data-kind="hinge" />
      </span>
    </span>
  );
}

export function SplitFlapText({
  value,
  length,
  align = "left",
  animationId,
  switchable = true,
}: SplitFlapTextProps) {
  const paddedValue = getPaddedSplitFlapValue(value, length, align);
  const [transientValue, setTransientValue] = useState<string | null>(null);
  const [manualReplayVersion, setManualReplayVersion] = useState(0);
  const [activeAnimationId, setActiveAnimationId] = useState<number | string | null>(
    animationId ?? null,
  );
  const [committedAnimationId, setCommittedAnimationId] = useState<number | string | undefined>(
    undefined,
  );
  const previousAnimationIdRef = useRef<number | string | undefined>(undefined);
  const previousManualReplayVersionRef = useRef(0);
  const hasPendingExternalAnimation =
    animationId !== undefined && animationId !== committedAnimationId;

  useEffect(() => {
    const manualReplayChanged =
      manualReplayVersion !== previousManualReplayVersionRef.current;
    const animationChanged =
      animationId !== undefined && animationId !== previousAnimationIdRef.current;
    const initialExternalAnimation =
      animationChanged && previousAnimationIdRef.current === undefined;

    previousAnimationIdRef.current = animationId;
    previousManualReplayVersionRef.current = manualReplayVersion;

    if (!animationChanged && !manualReplayChanged) {
      return;
    }

    const nextAnimationId = manualReplayChanged
      ? `manual-${manualReplayVersion}`
      : animationId ?? null;

    if (nextAnimationId === null) {
      return;
    }

    if (!manualReplayChanged) {
      setCommittedAnimationId(animationId);
    }

    setActiveAnimationId(nextAnimationId);
    setTransientValue(
      manualReplayChanged || !initialExternalAnimation
        ? getReplayStepValue(paddedValue)
        : null,
    );

    const timeoutId = window.setTimeout(() => {
      setTransientValue(null);
      setActiveAnimationId((currentAnimationId) =>
        currentAnimationId === nextAnimationId ? null : currentAnimationId,
      );
    }, getAnimationDurationMs(length));

    return () => window.clearTimeout(timeoutId);
  }, [animationId, length, manualReplayVersion, paddedValue]);

  const showAnimatedFlap = activeAnimationId !== null || hasPendingExternalAnimation;
  const staticContent = (
    <span
      className="split-flap-display train-ticker-split-flap"
      style={splitFlapStyle}
      aria-hidden="true"
    >
      {Array.from(paddedValue, renderStaticCharacter)}
    </span>
  );

  if (!showAnimatedFlap) {
    return renderHost(
      staticContent,
      switchable,
      paddedValue,
      () =>
        setManualReplayVersion(
          (currentManualReplayVersion) => currentManualReplayVersion + 1,
        ),
    );
  }

  return (
    <SplitFlap
      value={transientValue ?? paddedValue}
      length={length}
      chars={splitFlapCharacters}
      padChar=" "
      padMode={align === "right" ? "start" : "end"}
      timing={SPLIT_FLAP_TIMING_MS}
      hinge
      className="train-ticker-split-flap"
      style={splitFlapStyle}
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
