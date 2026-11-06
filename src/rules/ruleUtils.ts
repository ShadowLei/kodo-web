import type { NotificationRuleDTO, WebConsoleMessageDTO } from "@/api/contracts";

/** A rule exactly as the user sees it in the JSON editor. */
export interface StoredRule {
  key: string;
  /** Raw JSON, kept even while invalid so it can be edited again. */
  raw: string;
}

export interface ParsedRule {
  valid: boolean;
  error?: string;
  id: string;
  description: string;
  active: boolean;
  rule?: NotificationRuleDTO;
}

export type RuleStatus = "error" | "inactive" | "active";

const RULE_EXPECTS = new Set(["all", "any", "none"]);

/**
 * The starter rule from the issue, made valid JSON.
 * `$ns` is intentionally a placeholder: the user points it at the namespace
 * they want to check (`Payment`, `Order`, …).
 */
const DEFAULT_RULE = {
  id: "Test-1",
  description: "Shadow Test Rule",
  active: true,
  $ns: "TODO",
  expect: "all",
  match: { amount: { $op: ">=", $val: 1000 } },
  notify: {
    channels: ["web-console"],
    message: "测试失败-Custom",
  },
} as const;

export function defaultRuleJson(): string {
  return JSON.stringify(DEFAULT_RULE, null, 2);
}

export function newRuleKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Parse + validate one editor payload. Invalid rules are still kept in the UI. */
export function parseRule(raw: string): ParsedRule {
  const empty: ParsedRule = {
    valid: false,
    id: "",
    description: "",
    active: true,
  };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (e) {
    return { ...empty, error: `Invalid JSON: ${messageOf(e)}` };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...empty, error: "A rule must be a JSON object." };
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const description =
    typeof record.description === "string" ? record.description : "";
  const active = record.active !== false;

  const error = validateRule(record);
  if (error) {
    return { valid: false, error, id, description, active };
  }

  return {
    valid: true,
    id,
    description,
    active,
    rule: {
      id: typeof record.id === "string" ? record.id : undefined,
      description:
        typeof record.description === "string" ? record.description : undefined,
      active: typeof record.active === "boolean" ? record.active : undefined,
      $ns: typeof record.$ns === "string" ? record.$ns : undefined,
      expect: record.expect as NotificationRuleDTO["expect"],
      match: record.match as NotificationRuleDTO["match"],
      notify: record.notify
        ? {
            channels: (record.notify as { channels?: string[] }).channels,
            message: (record.notify as { message?: string }).message,
          }
        : undefined,
    },
  };
}

export function ruleStatus(parsed: ParsedRule): RuleStatus {
  if (!parsed.valid) return "error";
  if (parsed.active === false) return "inactive";
  return "active";
}

/** Rules to send to the server, plus `alert` lines for rules that were skipped. */
export function splitRulesForCheck(stored: StoredRule[]): {
  rules: NotificationRuleDTO[];
  warnings: WebConsoleMessageDTO[];
} {
  const rules: NotificationRuleDTO[] = [];
  const warnings: WebConsoleMessageDTO[] = [];

  stored.forEach((entry, index) => {
    const parsed = parseRule(entry.raw);
    if (parsed.valid && parsed.rule) {
      rules.push(parsed.rule);
      return;
    }

    const name = parsed.id ? `"${parsed.id}"` : `#${index + 1}`;
    warnings.push({
      level: "alert",
      message: `Rule ${name} skipped — ${parsed.error ?? "invalid rule"}`,
      details: [oneLine(entry.raw)],
    });
  });

  return { rules, warnings };
}

function validateRule(record: Record<string, unknown>): string | undefined {
  if (!RULE_EXPECTS.has(String(record.expect))) {
    return '`expect` must be "all", "any" or "none".';
  }
  if (
    !record.match ||
    typeof record.match !== "object" ||
    Array.isArray(record.match)
  ) {
    return "`match` must be a JSON object.";
  }
  for (const key of ["id", "description", "$ns"]) {
    if (record[key] !== undefined && typeof record[key] !== "string") {
      return `\`${key}\` must be a string.`;
    }
  }
  if (record.active !== undefined && typeof record.active !== "boolean") {
    return "`active` must be true or false.";
  }
  if (record.notify !== undefined) {
    if (
      !record.notify ||
      typeof record.notify !== "object" ||
      Array.isArray(record.notify)
    ) {
      return "`notify` must be a JSON object.";
    }
    const notify = record.notify as Record<string, unknown>;
    if (
      notify.channels !== undefined &&
      (!Array.isArray(notify.channels) ||
        !notify.channels.every((channel) => typeof channel === "string"))
    ) {
      return "`notify.channels` must be an array of strings.";
    }
    if (notify.message !== undefined && typeof notify.message !== "string") {
      return "`notify.message` must be a string.";
    }
  }
  return undefined;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function oneLine(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}
