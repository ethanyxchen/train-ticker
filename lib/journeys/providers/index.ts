import type { JourneySnapshot, SavedJourney } from "@/lib/journeys/types";
import type {
  JourneyProvider,
  JourneySnapshotContext,
} from "@/lib/journeys/providers/base";
import { nationalRailProvider } from "@/lib/journeys/providers/national-rail";
import { tflTubeProvider } from "@/lib/journeys/providers/tfl";

const PROVIDERS: Record<string, JourneyProvider> = {
  [nationalRailProvider.id]: nationalRailProvider,
  [tflTubeProvider.id]: tflTubeProvider,
};

export function getJourneyProvider(providerId: string): JourneyProvider {
  const provider = PROVIDERS[providerId];

  if (!provider) {
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  return provider;
}

export async function loadJourneySnapshot(
  journey: SavedJourney,
  context?: JourneySnapshotContext,
): Promise<JourneySnapshot> {
  try {
    const provider = getJourneyProvider(journey.provider);
    return await provider.getSnapshot(journey, context);
  } catch (error) {
    return {
      journeyId: journey.id,
      provider: journey.provider,
      status: "error",
      headline: "Live lookup failed",
      subheadline:
        error instanceof Error ? error.message : "An unknown error occurred.",
      refreshedAt: new Date().toISOString(),
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
