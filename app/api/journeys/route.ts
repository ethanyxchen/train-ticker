import { NextResponse } from "next/server";

import { loadJourneySnapshot } from "@/lib/journeys/providers";
import { parseSavedJourneys } from "@/lib/journeys/schema";
import { tryLoadScheduledOptionsForJourneys } from "@/lib/journeys/providers/national-rail-timetable";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseTimeWindowHours(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(value), 1), 6);
}

function parseWindowStartAt(value: unknown) {
  if (typeof value !== "string") {
    return new Date();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      journeys?: unknown;
      timeWindowHours?: unknown;
      windowStartAt?: unknown;
    };
    const journeys = parseSavedJourneys(body.journeys);
    const timeWindowHours = parseTimeWindowHours(body.timeWindowHours);
    const windowStartAt = parseWindowStartAt(body.windowStartAt);
    const nationalRailJourneys = journeys.filter(
      (journey) => journey.provider === "national-rail",
    );
    const { optionsByJourneyId, alert } = await tryLoadScheduledOptionsForJourneys(
      nationalRailJourneys,
      timeWindowHours,
      windowStartAt,
    );
    const snapshots = await Promise.all(
      journeys.map((journey) =>
        loadJourneySnapshot(journey, {
          timeWindowHours,
          windowStartAt: windowStartAt.toISOString(),
          scheduledOptions: optionsByJourneyId[journey.id],
        }),
      ),
    );
    const mergedSnapshots = alert
      ? snapshots.map((snapshot) =>
          snapshot.provider === "national-rail"
            ? {
                ...snapshot,
                alerts: [alert, ...snapshot.alerts],
              }
            : snapshot,
        )
      : snapshots;

    return NextResponse.json({ snapshots: mergedSnapshots });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load journeys.",
      },
      { status: 400 },
    );
  }
}
