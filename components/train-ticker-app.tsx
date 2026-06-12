"use client";

import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";

import { JourneyCommandMenu } from "@/components/journey-command-menu";
import { JourneyBoard } from "@/components/journey-board";
import { BASE_BOARD_TICKERS } from "@/lib/journeys/board-display";
import {
  resolveBoardLayout,
  type ResolvedBoardLayout,
} from "@/lib/journeys/board-layout";
import { createSavedJourney } from "@/lib/journeys/identity";
import { parseJourneyDefinition } from "@/lib/journeys/schema";
import type {
  JourneyDefinition,
  JourneySnapshot,
  SavedJourney,
} from "@/lib/journeys/types";

const STORAGE_KEY = "train-ticker.journey-definition.v1";
const BOARD_PADDING_REM = 2;
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const pollIntervalValue = Number.parseInt(
  process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? "",
  10,
);
const POLL_INTERVAL_MS =
  Number.isFinite(pollIntervalValue) && pollIntervalValue > 0
    ? pollIntervalValue
    : DEFAULT_POLL_INTERVAL_MS;

function hasSameBoardLayout(
  left: ResolvedBoardLayout,
  right: ResolvedBoardLayout,
) {
  return (
    left.tickers.time === right.tickers.time &&
    left.tickers.origin === right.tickers.origin &&
    left.tickers.destination === right.tickers.destination &&
    left.tickers.operator === right.tickers.operator &&
    left.tickers.platform === right.tickers.platform &&
    left.tickers.status === right.tickers.status &&
    left.availableRem === right.availableRem
  );
}

function toJourneyDefinition(journey: SavedJourney): JourneyDefinition {
  return {
    provider: journey.provider,
    origin: journey.origin,
    destination: journey.destination,
  };
}

export function TrainTickerApp() {
  const [journey, setJourney] = useState<SavedJourney | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return null;
    }

    try {
      return createSavedJourney(parseJourneyDefinition(JSON.parse(stored)));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });
  const [previousSnapshot, setPreviousSnapshot] = useState<JourneySnapshot>();
  const [snapshot, setSnapshot] = useState<JourneySnapshot>();
  const [introCycle, setIntroCycle] = useState(0);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boardStackRef = useRef<HTMLDivElement | null>(null);
  const journeyRef = useRef(journey);
  const snapshotRef = useRef(snapshot);
  const [boardLayout, setBoardLayout] = useState<ResolvedBoardLayout>({
    tickers: BASE_BOARD_TICKERS,
    availableRem: 0,
  });

  useEffect(() => {
    journeyRef.current = journey;
  }, [journey]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (journey) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(toJourneyDefinition(journey)),
      );
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
  }, [journey]);

  const refreshJourney = useEffectEvent(async (currentJourney: SavedJourney | null) => {
    if (!currentJourney) {
      startTransition(() => setPreviousSnapshot(undefined));
      startTransition(() => setSnapshot(undefined));
      setError(null);
      setRefreshing(false);
      return;
    }

    const currentJourneyId = currentJourney.id;

    function isCurrentJourney() {
      return journeyRef.current?.id === currentJourneyId;
    }

    if (!isCurrentJourney()) {
      return;
    }

    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch("/api/journeys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ journey: toJourneyDefinition(currentJourney) }),
      });

      if (!response.ok) {
        throw new Error("Could not refresh live journey.");
      }

      const data = (await response.json()) as { snapshot: JourneySnapshot };
      const nextSnapshot = data.snapshot;

      if (!nextSnapshot || nextSnapshot.journeyId !== currentJourneyId) {
        throw new Error("Could not refresh live journey.");
      }

      if (!isCurrentJourney()) {
        return;
      }

      startTransition(() => {
        setPreviousSnapshot(snapshotRef.current);
        setSnapshot(nextSnapshot);
      });
    } catch (refreshError) {
      if (isCurrentJourney()) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "Could not refresh live journey.",
        );
      }
    } finally {
      if (isCurrentJourney()) {
        setRefreshing(false);
      }
    }
  });

  useEffect(() => {
    queueMicrotask(() => {
      void refreshJourney(journey);
    });

    const intervalId = window.setInterval(() => {
      void refreshJourney(journeyRef.current);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [journey]);

  useEffect(() => {
    function openCommandMenu(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandMenuOpen(true);
      }
    }

    window.addEventListener("keydown", openCommandMenu);

    return () => window.removeEventListener("keydown", openCommandMenu);
  }, []);

  useEffect(() => {
    const boardStackElement = boardStackRef.current;

    if (!boardStackElement) {
      return;
    }

    function updateBoardLayout() {
      const nextBoardStackElement = boardStackRef.current;

      if (!nextBoardStackElement) {
        return;
      }

      const rootFontSize =
        Number.parseFloat(
          window.getComputedStyle(document.documentElement).fontSize,
        ) || 16;
      const nextBoardLayout = resolveBoardLayout({
        availableRem: Math.max(
          nextBoardStackElement.clientWidth / rootFontSize - BOARD_PADDING_REM,
          0,
        ),
        baseTickers: BASE_BOARD_TICKERS,
      });

      setBoardLayout((currentBoardLayout) =>
        hasSameBoardLayout(currentBoardLayout, nextBoardLayout)
          ? currentBoardLayout
          : nextBoardLayout,
      );
    }

    updateBoardLayout();

    const resizeObserver = new ResizeObserver(() => {
      updateBoardLayout();
    });

    resizeObserver.observe(boardStackElement);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <main className="relative flex min-h-dvh w-full flex-1 flex-col overflow-hidden bg-black px-3 py-4 sm:px-5 sm:py-6">
      {error ? (
        <div className="absolute left-3 top-3 z-10 max-w-[min(32rem,calc(100vw-1.5rem))] rounded-md border border-[rgba(236,138,109,0.34)] bg-[rgba(0,0,0,0.72)] px-3 py-2 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--bad)] sm:left-5 sm:top-5">
          {error}
        </div>
      ) : null}

      <div
        className="flex min-h-[calc(100dvh-2rem)] w-full items-center sm:min-h-[calc(100dvh-3rem)]"
        ref={boardStackRef}
      >
        {journey ? (
          <JourneyBoard
            key={journey.id}
            journey={journey}
            snapshot={snapshot}
            previousSnapshot={previousSnapshot}
            layout={boardLayout}
            refreshing={refreshing}
            introCycle={introCycle > 0 ? introCycle : undefined}
            onChangeJourney={() => setCommandMenuOpen(true)}
            onClearJourney={() => {
              journeyRef.current = null;
              snapshotRef.current = undefined;
              setJourney(null);
              setIntroCycle(0);
              startTransition(() => {
                setPreviousSnapshot(undefined);
                setSnapshot(undefined);
              });
              setCommandMenuOpen(true);
            }}
          />
        ) : null}
      </div>

      <JourneyCommandMenu
        currentJourney={journey}
        open={commandMenuOpen || journey === null}
        onClose={() => setCommandMenuOpen(false)}
        onSelectJourney={(definition) => {
          const nextJourney = createSavedJourney(definition);

          journeyRef.current = nextJourney;
          snapshotRef.current = undefined;
          setJourney(nextJourney);
          setIntroCycle((currentIntroCycle) => currentIntroCycle + 1);
          startTransition(() => {
            setPreviousSnapshot(undefined);
            setSnapshot(undefined);
          });
        }}
      />
    </main>
  );
}
