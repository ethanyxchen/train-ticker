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
  getMaxSplitFlapForwardStepCount,
  getMaxSplitFlapInitialStepCount,
  getNextSplitFlapValue,
  getPaddedSplitFlapValue,
  getSplitFlapValueAfterSteps,
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
  spinning?: boolean;
}

type SplitFlapStyle = CSSProperties & {
  "--train-ticker-flap-gap": string;
  "--train-ticker-flap-width": string;
  "--train-ticker-flap-height": string;
  "--train-ticker-flap-radius": string;
  "--train-ticker-flap-padding-inline": string;
};

type DrivenReplayFrame = {
  value: string;
  previousValue: string;
  version: number;
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
const SPLIT_FLAP_TIMING_MS = 80;
const REPLAY_SETTLE_MS = 70;
const ANIMATION_BUFFER_MS = 140;

function getReplayLabel(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : "blank";
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
  return length * SPLIT_FLAP_TIMING_MS + REPLAY_SETTLE_MS + ANIMATION_BUFFER_MS;
}

function getInitialAnimationDurationMs(value: string) {
  return getAnimationDurationMs(getMaxSplitFlapInitialStepCount(value));
}

function getForwardAnimationDurationMs(from: string, to: string) {
  return getAnimationDurationMs(getMaxSplitFlapForwardStepCount(from, to));
}

function getReplayAnimationTimings(
  replayStartValue: string | null,
  targetValue: string,
) {
  if (replayStartValue === null) {
    return {
      settleDelay: null,
      clearDelay: getInitialAnimationDurationMs(targetValue),
    };
  }

  const settleDelay = getInitialAnimationDurationMs(replayStartValue);

  return {
    settleDelay,
    clearDelay:
      settleDelay + getForwardAnimationDurationMs(replayStartValue, targetValue),
  };
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

function renderFlapCharacter(character: string) {
  return character === " " ? "\u00a0" : character;
}

function renderAnimatedCharacter(
  value: string,
  previousValue: string,
  index: number,
  version: number,
) {
  return (
    <span
      key={index}
      className="split-flap-digit"
      data-kind="digit"
      data-mode={getStaticDigitMode(value)}
      aria-hidden="true"
    >
      <span className="split-flap-part top">
        <span className="split-flap-char">{renderFlapCharacter(value)}</span>
        <span className="split-flap-hinge" data-kind="hinge" />
      </span>
      <span className="split-flap-part bottom">
        <span className="split-flap-char">
          {renderFlapCharacter(previousValue)}
        </span>
        <span className="split-flap-hinge" data-kind="hinge" />
      </span>
      <span
        key={`top-${version}`}
        className="split-flap-part top animated final"
      >
        <span className="split-flap-char">
          {renderFlapCharacter(previousValue)}
        </span>
        <span className="split-flap-hinge" data-kind="hinge" />
      </span>
      <span
        key={`bottom-${version}`}
        className="split-flap-part bottom animated final"
      >
        <span className="split-flap-char">{renderFlapCharacter(value)}</span>
        <span className="split-flap-hinge" data-kind="hinge" />
      </span>
    </span>
  );
}

function renderDrivenReplayContent(frame: DrivenReplayFrame, length: number) {
  return (
    <span
      className="split-flap-display train-ticker-split-flap"
      style={splitFlapStyle}
      aria-hidden="true"
    >
      {Array.from({ length }, (_, index) =>
        renderAnimatedCharacter(
          frame.value[index] ?? " ",
          frame.previousValue[index] ?? " ",
          index,
          frame.version,
        ),
      )}
    </span>
  );
}

export function SplitFlapText({
  value,
  length,
  align = "left",
  animationId,
  switchable = true,
  spinning = false,
}: SplitFlapTextProps) {
  const paddedValue = getPaddedSplitFlapValue(value, length, align);
  const [transientValue, setTransientValue] = useState<string | null>(null);
  const [spinningReplayFrame, setSpinningReplayFrame] =
    useState<DrivenReplayFrame | null>(null);
  const [drivenReplayFrame, setDrivenReplayFrame] =
    useState<DrivenReplayFrame | null>(null);
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
    if (!spinning) {
      return;
    }

    let step = 0;
    const intervalId = window.setInterval(() => {
      step += 1;
      setSpinningReplayFrame({
        previousValue: getSplitFlapValueAfterSteps(paddedValue, step - 1),
        value: getSplitFlapValueAfterSteps(paddedValue, step),
        version: step,
      });
    }, SPLIT_FLAP_TIMING_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [length, paddedValue, spinning]);

  useEffect(() => {
    if (spinning) {
      return;
    }

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

    if (manualReplayChanged) {
      let step = 1;
      let settleTimeoutId: number | undefined;
      const totalSteps = SPLIT_FLAP_CHARACTERS.length;

      setActiveAnimationId(nextAnimationId);
      setTransientValue(null);
      setDrivenReplayFrame({
        previousValue: paddedValue,
        value: getSplitFlapValueAfterSteps(paddedValue, step),
        version: manualReplayVersion * totalSteps + step,
      });

      const intervalId = window.setInterval(() => {
        step += 1;

        setDrivenReplayFrame({
          previousValue: getSplitFlapValueAfterSteps(paddedValue, step - 1),
          value: getSplitFlapValueAfterSteps(paddedValue, step),
          version: manualReplayVersion * totalSteps + step,
        });

        if (step >= totalSteps) {
          window.clearInterval(intervalId);
          settleTimeoutId = window.setTimeout(() => {
            setDrivenReplayFrame(null);
            setActiveAnimationId((currentAnimationId) =>
              currentAnimationId === nextAnimationId ? null : currentAnimationId,
            );
          }, REPLAY_SETTLE_MS + ANIMATION_BUFFER_MS);
        }
      }, SPLIT_FLAP_TIMING_MS);

      return () => {
        window.clearInterval(intervalId);

        if (settleTimeoutId !== undefined) {
          window.clearTimeout(settleTimeoutId);
        }
      };
    }

    const replayStartValue =
      !initialExternalAnimation ? getNextSplitFlapValue(paddedValue) : null;
    const replayTimings = getReplayAnimationTimings(
      replayStartValue,
      paddedValue,
    );

    setActiveAnimationId(nextAnimationId);
    setDrivenReplayFrame(null);
    setTransientValue(replayStartValue);

    const settleTimeoutId =
      replayTimings.settleDelay === null
        ? undefined
        : window.setTimeout(() => {
            setTransientValue(null);
          }, replayTimings.settleDelay);

    const timeoutId = window.setTimeout(() => {
      setTransientValue(null);
      setActiveAnimationId((currentAnimationId) =>
        currentAnimationId === nextAnimationId ? null : currentAnimationId,
      );
    }, replayTimings.clearDelay);

    return () => {
      if (settleTimeoutId !== undefined) {
        window.clearTimeout(settleTimeoutId);
      }

      window.clearTimeout(timeoutId);
    };
  }, [animationId, manualReplayVersion, paddedValue, spinning]);

  const activeDrivenReplayFrame = spinning
    ? spinningReplayFrame
    : drivenReplayFrame;
  const showAnimatedFlap =
    (spinning && spinningReplayFrame !== null) ||
    activeAnimationId !== null ||
    hasPendingExternalAnimation;
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

  if (activeDrivenReplayFrame !== null) {
    return renderHost(
      renderDrivenReplayContent(activeDrivenReplayFrame, length),
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
