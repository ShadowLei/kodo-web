import type { DataModelDTO } from "@/api/contracts";

import queryGuide from "../../query-guide.md?raw";

/**
 * DeepSeek integration for the rule editor.
 *
 * The API key is a single browser-local value shared by every rule; the issue
 * asks for one key, entered once, not one key per rule. It is stored in
 * `localStorage` and only ever sent to `api.deepseek.com` (which allows CORS
 * from the browser).
 */

const STORAGE_KEY = "kodo-web.deepseek.api-key";
const ENDPOINT = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const REQUEST_TIMEOUT_MS = 60_000;

export function readDeepSeekKey(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function saveDeepSeekKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearDeepSeekKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export interface GenerateRuleRequest {
  apiKey: string;
  prompt: string;
  dataModels?: readonly DataModelDTO[];
  /** The rule currently in the JSON editor, kept as context for rewrites. */
  currentRule?: string;
}

/**
 * Stable system prefix: the guide and generation rules never change between
 * calls, so DeepSeek's automatic context caching can reuse this prefix
 * (`usage.prompt_cache_hit_tokens` in the response). Keep dynamic content
 * (data models, the user prompt, the current rule) in the user message.
 */
const SYSTEM_PROMPT = [
  "You generate notification rules for kodo-web. Output only one JSON object",
  "that conforms to the NotificationRule format below, and nothing else.",
  "Never wrap the JSON in prose or Markdown fences.",
  "",
  "The user describes a condition in natural language. Produce a complete rule:",
  "- Keep a sensible id/description/active.",
  '- Prefer a QueryMatch object for field comparisons, array checks ("IN" / "!IN")',
  "  and simple logical trees.",
  "- Use a CEL expression string only when the condition needs aggregation or",
  "  custom logic.",
  '- Always set notify.channels to ["web-console"] and write a notify.message',
  "  that explains what failing means.",
  "- Use only fields and namespaces provided by the user; never invent fields.",
  "- Validation rules: expect is all/any/none; operator values are >=, >, <, <=,",
  "  ==, ===, !=, !==, IN, !IN; $val for IN/!IN must be an array; CEL must",
  "  return a boolean.",
  "",
  "Here is the authoritative query-guide.md reference:",
  "",
  queryGuide,
].join("\n");

function modelContext(dataModels: readonly DataModelDTO[] | undefined): string {
  if (!dataModels?.length) return "(no data models were provided)";
  return dataModels
    .map(
      (model) =>
        `- ${model.name}: ${
          model.fields.map((field) => `${field.name} (${field.type})`).join(", ") ||
          "(no fields)"
        }`,
    )
    .join("\n");
}

function userPrompt(request: GenerateRuleRequest): string {
  return [
    "Data models in the current network (namespaces and fields):",
    modelContext(request.dataModels),
    "",
    "Condition described by the user:",
    request.prompt.trim(),
    "",
    "Current rule JSON (may be empty; keep useful id/description/notify values,",
    "or rewrite them when the user's description asks for it):",
    request.currentRule?.trim() || "(empty)",
    "",
    "Return one complete NotificationRule JSON object.",
  ].join("\n");
}

interface DeepSeekResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string; type?: string };
}

export class DeepSeekError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "DeepSeekError";
    this.status = status;
  }
}

/** Call DeepSeek and return the generated rule as pretty-printed JSON text. */
export async function generateRule(request: GenerateRuleRequest): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt(request) },
        ],
        temperature: 0.2,
        max_tokens: 2048,
        response_format: { type: "json_object" },
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const reason =
      error instanceof DOMException && error.name === "AbortError"
        ? "DeepSeek did not answer within 60 seconds."
        : "Could not reach DeepSeek. Check your network connection.";
    throw new DeepSeekError(reason);
  } finally {
    clearTimeout(timer);
  }

  let payload: DeepSeekResponse | null = null;
  try {
    payload = (await response.json()) as DeepSeekResponse;
  } catch {
    // A proxy or gateway may return non-JSON; fall through to the status check.
  }

  if (!response.ok) {
    throw new DeepSeekError(
      describeHttpError(response.status, payload),
      response.status,
    );
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new DeepSeekError("DeepSeek returned an empty response.");
  }

  const json = extractJsonObject(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new DeepSeekError(
      `DeepSeek returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new DeepSeekError("DeepSeek did not return a JSON rule object.");
  }

  return `${JSON.stringify(parsed, null, 2)}\n`;
}

/** Pull the JSON object out of a response, tolerating stray Markdown fences. */
export function extractJsonObject(content: string): string {
  let text = content.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

function describeHttpError(status: number, payload: DeepSeekResponse | null): string {
  const detail = payload?.error?.message ? ` ${payload.error.message}` : "";
  if (status === 401) {
    return `DeepSeek rejected the API key. Check the key and try again.${detail}`;
  }
  if (status === 402) {
    return `DeepSeek says the account has insufficient balance.${detail}`;
  }
  if (status === 429) {
    return `DeepSeek rate-limited the request. Try again in a moment.${detail}`;
  }
  if (status >= 500) {
    return `DeepSeek is unavailable right now (HTTP ${status}).${detail}`;
  }
  return `DeepSeek request failed (HTTP ${status}).${detail}`;
}
