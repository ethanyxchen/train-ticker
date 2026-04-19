import { NextResponse } from "next/server";

import { loadJourneySnapshot } from "@/lib/journeys/providers";
import { parseSavedJourneys } from "@/lib/journeys/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { journeys?: unknown };
    const journeys = parseSavedJourneys(body.journeys);
    const snapshots = await Promise.all(journeys.map(loadJourneySnapshot));

    return NextResponse.json({ snapshots });
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
