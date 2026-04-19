import { NextResponse } from "next/server";

import { isJourneyProviderId } from "@/lib/journeys/schema";
import { getJourneyProvider } from "@/lib/journeys/providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  const query = searchParams.get("q")?.trim() ?? "";

  if (!isJourneyProviderId(provider)) {
    return NextResponse.json(
      { error: "Unsupported provider." },
      { status: 400 },
    );
  }

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await getJourneyProvider(provider).search(query);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Search provider failed.",
      },
      { status: 500 },
    );
  }
}
