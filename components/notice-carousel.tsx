"use client";

import { useEffect, useMemo, useState } from "react";

import { parseInlineHtml } from "@/lib/journeys/inline-html";

interface NoticeCarouselProps {
  notices: readonly string[];
}

interface NoticeCarouselContentProps {
  messages: readonly string[];
  noticeKey: string;
}

const NOTICE_ROTATION_MS = 8_000;

export function getNoticeMessages(notices: readonly string[]) {
  return notices.map((notice) => notice.trim()).filter(Boolean);
}

export function getNoticeCarouselIndex(
  currentIndex: number,
  direction: -1 | 1,
  noticeCount: number,
) {
  if (noticeCount <= 0) {
    return 0;
  }

  return (currentIndex + direction + noticeCount) % noticeCount;
}

function NoticeMessage({ notice }: { notice: string }) {
  return (
    <>
      {parseInlineHtml(notice).map((segment, index) =>
        segment.type === "link" ? (
          <a
            key={`${segment.href}:${index}`}
            href={segment.href}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--board-header)] underline decoration-[rgba(223,186,75,0.42)] decoration-1 underline-offset-4 transition hover:text-[var(--paper)]"
          >
            {segment.label}
          </a>
        ) : (
          <span key={`${segment.value}:${index}`}>{segment.value}</span>
        ),
      )}
    </>
  );
}

function NoticeCarouselContent({
  messages,
  noticeKey,
}: NoticeCarouselContentProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleIndex = Math.min(activeIndex, messages.length - 1);
  const hasMultipleNotices = messages.length > 1;

  useEffect(() => {
    if (!hasMultipleNotices) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) =>
        getNoticeCarouselIndex(currentIndex, 1, messages.length),
      );
    }, NOTICE_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [hasMultipleNotices, messages.length, noticeKey]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label="Live notices"
      aria-live="polite"
      className="mt-4 overflow-hidden rounded-md border border-[rgba(223,186,75,0.24)] bg-[rgba(223,186,75,0.08)]"
    >
      <div className="flex min-h-14 items-stretch">
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 sm:px-4">
          <div className="shrink-0 text-[0.68rem] uppercase tracking-[0.16em] text-[var(--board-header)]">
            Notice
          </div>
          <p
            key={`${noticeKey}:${visibleIndex}`}
            className="min-w-0 text-[0.86rem] leading-snug text-[var(--paper)]"
          >
            <NoticeMessage notice={messages[visibleIndex] ?? ""} />
          </p>
        </div>

        {hasMultipleNotices ? (
          <div className="flex shrink-0 border-l border-[rgba(223,186,75,0.2)]">
            <button
              type="button"
              aria-label="Previous notice"
              title="Previous notice"
              className="grid w-10 place-items-center border-0 bg-transparent text-lg text-[var(--board-header)] transition hover:bg-[rgba(223,186,75,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--board-header)]"
              onClick={() =>
                setActiveIndex((currentIndex) =>
                  getNoticeCarouselIndex(currentIndex, -1, messages.length),
                )
              }
            >
              <span aria-hidden="true">‹</span>
            </button>
            <div className="flex min-w-10 items-center justify-center border-x border-[rgba(223,186,75,0.2)] px-2 text-[0.66rem] tabular-nums text-[rgba(247,244,238,0.62)]">
              {visibleIndex + 1}/{messages.length}
            </div>
            <button
              type="button"
              aria-label="Next notice"
              title="Next notice"
              className="grid w-10 place-items-center border-0 bg-transparent text-lg text-[var(--board-header)] transition hover:bg-[rgba(223,186,75,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--board-header)]"
              onClick={() =>
                setActiveIndex((currentIndex) =>
                  getNoticeCarouselIndex(currentIndex, 1, messages.length),
                )
              }
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function NoticeCarousel({ notices }: NoticeCarouselProps) {
  const messages = useMemo(() => getNoticeMessages(notices), [notices]);
  const noticeKey = messages.join("\u001f");

  if (messages.length === 0) {
    return null;
  }

  return (
    <NoticeCarouselContent
      key={noticeKey}
      messages={messages}
      noticeKey={noticeKey}
    />
  );
}
