"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import { JourneyBoard } from "@/components/journey-board";
import { JourneyForm } from "@/components/journey-form";
import { BASE_BOARD_TICKERS } from "@/lib/journeys/board-display";
import {
  resolveBoardLayout,
  type ResolvedBoardLayout,
} from "@/lib/journeys/board-layout";
import {
  createSavedJourney,
  normalizeSavedJourneys,
} from "@/lib/journeys/identity";
import type { JourneySnapshot, SavedJourney } from "@/lib/journeys/types";

const STORAGE_KEY = "train-ticker.saved-journeys.v1";
const BOARD_GAP_REM = 0.75;

function toSnapshotMap(items: JourneySnapshot[]): Record<string, JourneySnapshot> {
  return Object.fromEntries(items.map((snapshot) => [snapshot.journeyId, snapshot]));
}

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
    left.insetRem === right.insetRem
  );
}

export function TrainTickerApp() {
  const [journeys, setJourneys] = useState<SavedJourney[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, JourneySnapshot>>({});
  const [introCycles, setIntroCycles] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boardStackRef = useRef<HTMLDivElement | null>(null);
  const [boardLayout, setBoardLayout] = useState<ResolvedBoardLayout>({
    tickers: BASE_BOARD_TICKERS,
    insetRem: 0,
  });

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SavedJourney[];
        setJourneys(normalizeSavedJourneys(parsed));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journeys));
  }, [hydrated, journeys]);

  const refreshJourneys = useCallback(
    async (currentJourneys = journeys) => {
      if (!currentJourneys.length) {
        startTransition(() => setSnapshots({}));
        setError(null);
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
          body: JSON.stringify({ journeys: currentJourneys }),
        });

        if (!response.ok) {
          throw new Error("Could not refresh live journeys.");
        }

        const data = (await response.json()) as { snapshots: JourneySnapshot[] };
        startTransition(() => {
          setSnapshots(toSnapshotMap(data.snapshots));
        });
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "Could not refresh live journeys.",
        );
      } finally {
        setRefreshing(false);
      }
    },
    [journeys],
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void refreshJourneys(journeys);

    const intervalId = window.setInterval(() => {
      void refreshJourneys(journeys);
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [hydrated, journeys, refreshJourneys]);

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
        availableRem: nextBoardStackElement.clientWidth / rootFontSize,
        baseTickers: BASE_BOARD_TICKERS,
        gapRem: BOARD_GAP_REM,
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
    <main className="flex w-full flex-1 flex-col gap-3 px-3 py-5 sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-[1100px]">
        <JourneyForm
          onAddJourney={(journey) => {
            const nextJourney = createSavedJourney(journey);

            if (journeys.some((item) => item.id === nextJourney.id)) {
              return;
            }

            setIntroCycles((currentIntroCycles) => ({
              ...currentIntroCycles,
              [nextJourney.id]: (currentIntroCycles[nextJourney.id] ?? 0) + 1,
            }));
            setJourneys((currentJourneys) => [...currentJourneys, nextJourney]);
          }}
        />
      </div>

      {error ? (
        <div className="mx-auto w-full max-w-[1100px] px-1 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--bad)]">
          {error}
        </div>
      ) : null}

      <div className="w-full space-y-3" ref={boardStackRef}>
        {journeys.map((journey) => (
          <JourneyBoard
            key={journey.id}
            journey={journey}
            snapshot={snapshots[journey.id]}
            layout={boardLayout}
            refreshing={refreshing}
            introCycle={introCycles[journey.id]}
            onRemove={() => {
              setJourneys((currentJourneys) =>
                currentJourneys.filter((item) => item.id !== journey.id),
              );
              setIntroCycles((currentIntroCycles) => {
                const nextIntroCycles = { ...currentIntroCycles };
                delete nextIntroCycles[journey.id];
                return nextIntroCycles;
              });
              startTransition(() => {
                setSnapshots((currentSnapshots) => {
                  const nextSnapshots = { ...currentSnapshots };
                  delete nextSnapshots[journey.id];
                  return nextSnapshots;
                });
              });
            }}
          />
        ))}
      </div>
    </main>
  );
}
