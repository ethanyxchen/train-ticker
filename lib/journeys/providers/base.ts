import type {
  JourneyOption,
  JourneySearchResult,
  JourneySnapshot,
  JourneyProviderId,
  SavedJourney,
} from "@/lib/journeys/types";

export interface JourneySnapshotContext {
  timeWindowHours?: number;
  scheduledOptions?: JourneyOption[];
}

export interface JourneyProvider {
  id: JourneyProviderId;
  search(query: string): Promise<JourneySearchResult[]>;
  getSnapshot(
    journey: SavedJourney,
    context?: JourneySnapshotContext,
  ): Promise<JourneySnapshot>;
}
