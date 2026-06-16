import { NextResponse } from "next/server";

import { createSavedJourney } from "@/lib/journeys/identity";
import { loadJourneySnapshot } from "@/lib/journeys/providers";
import { parseJourneyDefinition } from "@/lib/journeys/schema";
import { enforceRateLimit, RATE_LIMIT_POLICIES } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = await enforceRateLimit(
    request,
    RATE_LIMIT_POLICIES.journeys,
  );

  if (rateLimited) {
    return rateLimited;
  }

  try {
    const body = (await request.json()) as { journey?: unknown };
    const journey = createSavedJourney(parseJourneyDefinition(body.journey));
    const snapshot = await loadJourneySnapshot(journey);

    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load journey.",
      },
      { status: 400 },
    );
  }
}
