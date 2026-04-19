export async function fetchJson<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Upstream request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

export function formatIsoTime(value?: string | null): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatBoardValue(value?: string | null, fallback = "--"): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed;
}

export function stripHtml(value?: string | null): string {
  if (!value) {
    return "";
  }

  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function dedupeText(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as string[];
}

export function appendSearchParams(
  input: string,
  params: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(input);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export function delayMinutes(scheduled?: string, live?: string): number | null {
  if (!scheduled || !live || !/^\d{2}:\d{2}$/.test(scheduled) || !/^\d{2}:\d{2}$/.test(live)) {
    return null;
  }

  const [scheduledHours, scheduledMinutes] = scheduled.split(":").map(Number);
  const [liveHours, liveMinutes] = live.split(":").map(Number);
  const scheduledTotal = scheduledHours * 60 + scheduledMinutes;
  const liveTotal = liveHours * 60 + liveMinutes;

  return liveTotal - scheduledTotal;
}

export function formatPence(value?: number | null): string {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value / 100);
}

export function normalizeEnvValue(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
