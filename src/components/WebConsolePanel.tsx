import { useEffect, useRef, useState } from "react";

import type {
  WebConsoleBatchDTO,
  WebConsoleLevel,
  WebConsoleMessageDTO,
} from "@/api/contracts";

interface Props {
  batches: WebConsoleBatchDTO[];
  onClear: () => void;
}

const COLLAPSED_WIDTH = 38;
const DEFAULT_WIDTH = 360;
const MIN_EXPANDED_WIDTH = 260;
const MAX_WIDTH = 620;
const SNAP_COLLAPSE_BELOW = 160;

const ICONS: Record<WebConsoleLevel, string> = {
  success: "✓",
  error: "✕",
  alert: "!",
};

export function WebConsolePanel({ batches, onClear }: Props) {
  const [width, setWidth] = useState(COLLAPSED_WIDTH);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const collapsed = width <= COLLAPSED_WIDTH + 2;
  const totalCount = batches.reduce(
    (count, batch) => count + batch.messages.length,
    0,
  );
  const errorCount = batches.reduce(
    (count, batch) =>
      count + batch.messages.filter((message) => message.level === "error").length,
    0,
  );

  // Keep the newest batch in view when the panel is open.
  useEffect(() => {
    if (collapsed) return;
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [batches.length, collapsed]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: width };
    setDragging(true);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = drag.startWidth + (drag.startX - event.clientX);
    setWidth(Math.max(COLLAPSED_WIDTH, Math.min(MAX_WIDTH, next)));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    setWidth((current) =>
      current < SNAP_COLLAPSE_BELOW
        ? COLLAPSED_WIDTH
        : Math.max(MIN_EXPANDED_WIDTH, current),
    );
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already have been released by the browser.
    }
  };

  return (
    <aside
      className={`web-console ${collapsed ? "collapsed" : ""} ${
        dragging ? "dragging" : ""
      }`}
      style={{ width }}
      aria-label="WebConsole"
    >
      <div
        className="web-console-resizer"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize WebConsole"
        title="Drag left to open, right to hide"
      />

      {collapsed ? (
        <button
          className="web-console-collapsed"
          onClick={() => setWidth(DEFAULT_WIDTH)}
          title="Show WebConsole"
        >
          <span className="web-console-vertical">WebConsole</span>
          {totalCount > 0 && (
            <span
              className={`web-console-badge ${errorCount > 0 ? "has-error" : ""}`}
              title={`${totalCount} message(s), ${errorCount} error(s)`}
            >
              {totalCount}
            </span>
          )}
        </button>
      ) : (
        <>
          <div className="web-console-header">
            <div className="web-console-heading">
              <span className="web-console-heading-dot" />
              WebConsole
              {totalCount > 0 && (
                <span className="web-console-total">{totalCount}</span>
              )}
            </div>
            <div className="web-console-actions">
              <button
                className="web-console-clear"
                onClick={onClear}
                disabled={totalCount === 0}
                title="Clear all WebConsole messages"
              >
                Clear
              </button>
              <button
                className="web-console-hide"
                onClick={() => setWidth(COLLAPSED_WIDTH)}
                title="Hide WebConsole"
                aria-label="Hide WebConsole"
              >
                ›
              </button>
            </div>
          </div>

          <div className="web-console-body" ref={bodyRef}>
            {batches.length === 0 ? (
              <div className="web-console-empty">
                No messages yet. Query with a rule that uses the{" "}
                <code>web-console</code> channel.
              </div>
            ) : (
              batches.map((batch) => (
                <section key={batch.id} className="web-console-batch">
                  <div className="web-console-batch-head">
                    <span className="web-console-time">
                      {formatTime(batch.at)}
                    </span>
                    <span className="web-console-batch-title">
                      {batch.title}
                    </span>
                  </div>
                  {batch.messages.map((message, index) => (
                    <ConsoleEntry
                      key={`${batch.id}-${index}`}
                      message={message}
                    />
                  ))}
                </section>
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function ConsoleEntry({ message }: { message: WebConsoleMessageDTO }) {
  return (
    <div className={`web-console-entry ${message.level}`}>
      <span className="web-console-icon" aria-hidden="true">
        {ICONS[message.level]}
      </span>
      <div className="web-console-entry-body">
        <div className="web-console-message">{message.message}</div>
        {message.details && message.details.length > 0 && (
          <ul className="web-console-details">
            {message.details.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
