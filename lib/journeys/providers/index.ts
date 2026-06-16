import type { JourneySnapshot, SavedJourney } from "@/lib/journeys/types";
import type { JourneyProvider } from "@/lib/journeys/providers/base";
import { nationalRailProvider } from "@/lib/journeys/providers/national-rail";

export function getJourneyProvider(providerId: string): JourneyProvider {
  if (providerId !== nationalRailProvider.id) {
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  return nationalRailProvider;
}

export async function loadJourneySnapshot(
  journey: SavedJourney,
): Promise<JourneySnapshot> {
  try {
    const provider = getJourneyProvider(journey.provider);
    return await provider.getSnapshot(journey);
  } catch (error) {
    return {
      journeyId: journey.id,
      provider: journey.provider,
      status: "error",
      headline: "Live lookup failed",
      subheadline:
        error instanceof Error ? error.message : "An unknown error occurred.",
      refreshedAt: new Date().toISOString(),
      routeStops: [journey.origin, journey.destination],
      boardFields: [
        { label: "FROM", value: journey.origin.id },
        { label: "TO", value: journey.destination.id },
        { label: "STAT", value: "ERROR", tone: "bad" },
      ],
      options: [],
      alerts: [],
    };
  }
}
