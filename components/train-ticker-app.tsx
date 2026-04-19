"use client";

import { startTransition, useCallback, useEffect, useState } from "react";

import { JourneyBoard } from "@/components/journey-board";
import { JourneyForm } from "@/components/journey-form";
import {
  createSavedJourney,
  normalizeSavedJourneys,
} from "@/lib/journeys/identity";
import type { JourneySnapshot, SavedJourney } from "@/lib/journeys/types";

const STORAGE_KEY = "train-ticker.saved-journeys.v1";

function toSnapshotMap(items: JourneySnapshot[]): Record<string, JourneySnapshot> {
  return Object.fromEntries(items.map((snapshot) => [snapshot.journeyId, snapshot]));
}

export function TrainTickerApp() {
  const [journeys, setJourneys] = useState<SavedJourney[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, JourneySnapshot>>({});
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="flex w-full flex-1 flex-col gap-3 px-3 py-5 sm:px-5 sm:py-6">
      <div className="mx-auto w-full max-w-[1100px]">
        <JourneyForm
          onAddJourney={(journey) => {
            setJourneys((currentJourneys) => {
              const nextJourney = createSavedJourney(journey);

              if (currentJourneys.some((item) => item.id === nextJourney.id)) {
                return currentJourneys;
              }

              return [...currentJourneys, nextJourney];
            });
          }}
        />
      </div>

      {error ? (
        <div className="mx-auto w-full max-w-[1100px] px-1 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--bad)]">
          {error}
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[1100px] space-y-3">
        {journeys.map((journey) => (
          <JourneyBoard
            key={journey.id}
            journey={journey}
            snapshot={snapshots[journey.id]}
            refreshing={refreshing}
            onRemove={() => {
              setJourneys((currentJourneys) =>
                currentJourneys.filter((item) => item.id !== journey.id),
              );
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
