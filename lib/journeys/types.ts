export type JourneyProviderId = "national-rail" | "tfl-tube";

export type JourneySnapshotTone = "neutral" | "good" | "warn" | "bad";

export type JourneySnapshotStatus = "ok" | "warning" | "error" | "unconfigured";

export interface JourneyLocation {
  id: string;
  label: string;
  secondaryLabel?: string;
}

export interface JourneySearchResult extends JourneyLocation {
  provider: JourneyProviderId;
}

export interface JourneyDefinition {
  provider: JourneyProviderId;
  origin: JourneyLocation;
  destination: JourneyLocation;
}

export interface SavedJourney extends JourneyDefinition {
  id: string;
  name: string;
}

export interface BoardField {
  label: string;
  value: string;
  tone?: JourneySnapshotTone;
}

export interface JourneyOption {
  id: string;
  title: string;
  scheduledDeparture?: string;
  expectedDeparture?: string;
  scheduledArrival?: string;
  expectedArrival?: string;
  durationMinutes?: number;
  platform?: string;
  operator?: string;
  operatorCode?: string;
  note?: string;
}

export interface JourneySnapshot {
  journeyId: string;
  provider: JourneyProviderId;
  status: JourneySnapshotStatus;
  headline: string;
  subheadline: string;
  refreshedAt: string;
  boardFields: BoardField[];
  options: JourneyOption[];
  alerts: string[];
}
