export type InlineHtmlSegment =
  | {
      type: "text";
      value: string;
    }
  | {
      type: "link";
      href: string;
      label: string;
    };

const ANCHOR_TAG_PATTERN = /<a\b[^>]*href=(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    );
}

function stripTagsKeepingSpacing(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function normalizeInlineText(value: string): string {
  return decodeHtmlEntities(stripTagsKeepingSpacing(value)).replace(/\s+/g, " ");
}

function sanitizeHref(value: string): string | null {
  const href = decodeHtmlEntities(value).trim();

  if (!href) {
    return null;
  }

  try {
    const parsed = new URL(href, "https://train-ticker.local");

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return href;
  } catch {
    return null;
  }
}

function normalizeSegments(segments: InlineHtmlSegment[]): InlineHtmlSegment[] {
  const merged: InlineHtmlSegment[] = [];

  for (const segment of segments) {
    if (segment.type === "text" && !segment.value.trim()) {
      continue;
    }

    const previous = merged.at(-1);

    if (segment.type === "text" && previous?.type === "text") {
      previous.value += segment.value;
      continue;
    }

    merged.push(segment);
  }

  const first = merged[0];

  if (first?.type === "text") {
    first.value = first.value.trimStart();
  }

  const last = merged.at(-1);

  if (last?.type === "text") {
    last.value = last.value.trimEnd();
  }

  return merged.filter((segment) =>
    segment.type === "text" ? Boolean(segment.value.trim()) : true,
  );
}

export function parseInlineHtml(value: string): InlineHtmlSegment[] {
  const segments: InlineHtmlSegment[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(ANCHOR_TAG_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const [fullMatch, , rawHref = "", rawLabel = ""] = match;
    const leadingText = normalizeInlineText(value.slice(lastIndex, matchIndex));

    if (leadingText.trim()) {
      segments.push({
        type: "text",
        value: leadingText,
      });
    }

    const href = sanitizeHref(rawHref);
    const label = normalizeInlineText(rawLabel).trim();

    if (href && label) {
      segments.push({
        type: "link",
        href,
        label,
      });
    } else {
      const fallbackText = normalizeInlineText(fullMatch);

      if (fallbackText.trim()) {
        segments.push({
          type: "text",
          value: fallbackText,
        });
      }
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  const trailingText = normalizeInlineText(value.slice(lastIndex));

  if (trailingText.trim()) {
    segments.push({
      type: "text",
      value: trailingText,
    });
  }

  return normalizeSegments(segments);
}
