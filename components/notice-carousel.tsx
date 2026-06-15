"use client";

import { useMemo, type CSSProperties } from "react";

import { parseInlineHtml } from "@/lib/journeys/inline-html";

interface NoticeCarouselProps {
  notices: readonly string[];
}

const NOTICE_SEPARATOR = "•••";

type NoticeMarqueeStyle = CSSProperties & {
  "--notice-marquee-duration": string;
};

export function getNoticeMessages(notices: readonly string[]) {
  return notices.map((notice) => notice.trim()).filter(Boolean);
}

function getNoticePlainText(notice: string) {
  return parseInlineHtml(notice)
    .map((segment) => (segment.type === "link" ? segment.label : segment.value))
    .join("");
}

export function getNoticeMarqueeText(notices: readonly string[]) {
  return getNoticeMessages(notices)
    .map(getNoticePlainText)
    .join(` ${NOTICE_SEPARATOR} `);
}

function NoticeMessage({ notice }: { notice: string }) {
  return (
    <>
      {parseInlineHtml(notice).map((segment, index) =>
        segment.type === "link" ? (
          <span
            key={`${segment.href}:${index}`}
            className="notice-led-link"
          >
            {segment.label}
          </span>
        ) : (
          <span key={`${segment.value}:${index}`}>{segment.value}</span>
        ),
      )}
    </>
  );
}

function NoticeMarqueeMessage({ messages }: { messages: readonly string[] }) {
  return (
    <div className="notice-led-message">
      {messages.map((message, index) => (
        <span key={`${message}:${index}`} className="notice-led-item">
          {index > 0 ? (
            <span className="notice-led-separator">{NOTICE_SEPARATOR}</span>
          ) : null}
          <NoticeMessage notice={message} />
        </span>
      ))}
    </div>
  );
}

export function NoticeCarousel({ notices }: NoticeCarouselProps) {
  const messages = useMemo(() => getNoticeMessages(notices), [notices]);
  const marqueeText = useMemo(() => getNoticeMarqueeText(messages), [messages]);
  const marqueeStyle: NoticeMarqueeStyle = {
    "--notice-marquee-duration": `${Math.max(18, marqueeText.length / 6)}s`,
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label="Live notices"
      className="notice-led-board"
      style={marqueeStyle}
    >
      <p className="sr-only">{marqueeText}</p>
      <div className="notice-led-window" aria-hidden="true">
        <div className="notice-led-track">
          <NoticeMarqueeMessage messages={messages} />
          <NoticeMarqueeMessage messages={messages} />
        </div>
      </div>
    </aside>
  );
}
