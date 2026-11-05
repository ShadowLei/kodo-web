import type { DataNode, INotifier, NotificationRule } from "kodo-core";

import type { WebConsoleMessageDTO } from "./contracts";

/** Keep a failure readable even when a rule hits a lot of nodes. */
const MAX_DETAIL_LINES = 8;

/**
 * kodo-core `INotifier` for the `web-console` channel.
 *
 * kodo-core calls `notify()` for every violated rule; the mock server also
 * calls it with an empty `violated` list for rules that passed, so a query
 * with healthy data still produces the `"<id> Exec Succeed"` line required by
 * the WebConsole. Messages are buffered and drained once per query/check
 * batch, which is what lets the UI draw one clearly separated block per
 * execution.
 */
export class WebConsoleNotifier implements INotifier {
  readonly name = "web-console";

  private messages: WebConsoleMessageDTO[] = [];

  notify(rule: NotificationRule, violated: DataNode<any>[]): void {
    const id = rule.id || "rule";

    if (violated.length === 0) {
      this.messages.push({
        level: "success",
        message: `${id} Exec Succeed`,
      });
      return;
    }

    const details = violated.slice(0, MAX_DETAIL_LINES).map(formatNode);
    if (violated.length > MAX_DETAIL_LINES) {
      details.push(`… and ${violated.length - MAX_DETAIL_LINES} more node(s)`);
    }

    this.messages.push({
      level: "error",
      message: rule.notify?.message
        ? `${id}: ${rule.notify.message}`
        : `${id} Exec Failed`,
      details,
    });
  }

  /** Drop anything left over before a new check starts. */
  reset(): void {
    this.messages = [];
  }

  /** Return the buffered lines and start a fresh buffer. */
  drain(): WebConsoleMessageDTO[] {
    const buffered = this.messages;
    this.messages = [];
    return buffered;
  }
}

function formatNode(node: DataNode<any>): string {
  const id = node.$id === undefined ? "" : ` #${String(node.$id)}`;
  const fields = Object.entries(node.data ?? {})
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(" · ");
  return fields ? `${node.$ns}${id} · ${fields}` : `${node.$ns}${id}`;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
