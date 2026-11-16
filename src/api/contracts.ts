/**
 * Wire-format DTOs exchanged with the (simulated) HTTP tier.
 *
 * A real web server would serialize these exact shapes to/from JSON over HTTP.
 * Keeping the front-end talking only to these plain-data contracts (never to
 * `kodo-core` directly) means swapping the `MockKodoServer` for a real HTTP
 * client later is a one-file change.
 */

export type KodoFieldType = "string" | "number" | "boolean" | "date";

/** A single (dynamically provided) field of a data model. */
export interface DataFieldDTO {
  name: string;
  type: KodoFieldType;
}

/** A data model (e.g. `Order`, `Payment`), dynamically provided per business scenario. */
export interface DataModelDTO {
  name: string;
  fields: DataFieldDTO[];
}

/** The `expression` of a LinkNode: how `$from.$fromField` relates to `$to.$toField`. */
export interface LinkExpressionDTO {
  $from?: string;
  $op?: string;
  $to?: string;
  $with?: string;
  $where?: LinkExpressionDTO[];
}

/** A LinkNode as it travels over the wire; namespaces are plain strings. */
export interface LinkNodeDTO {
  $id?: string;
  $from: string;
  $to: string;
  expression: LinkExpressionDTO;
}

export interface NetworkSummaryDTO {
  id: string;
  name: string;
}

/** A whole relationship network = one LinkNodeList + its data models. */
export interface NetworkDTO extends NetworkSummaryDTO {
  linkNodes: LinkNodeDTO[];
  dataModels: DataModelDTO[];
}

/**
 * Query expression: field -> value, or field -> { $op, $val }.
 * `$with` / `$where` mirror kodo-core's boolean composition.
 */
export interface QueryExpressionDTO {
  $with?: "&&" | "||";
  $where?: QueryExpressionDTO[];
  [field: string]: unknown;
}

/** kodo-core's `KodoOption` subset surfaced to the UI. */
export interface KodoOptionsDTO {
  tierLimit: number;
  limit: number;
  recursion?: boolean;
  cache?: boolean;
}

export interface LookupRequestDTO {
  networkId: string;
  ns: string;
  expression: QueryExpressionDTO;
  options: KodoOptionsDTO;
  /** Rules to check against the query result (invalid rules never leave the UI). */
  rules?: NotificationRuleDTO[];
}

/** A reference to another data node (used to reconstruct edges). */
export interface DataNodeRefDTO {
  $ns: string;
  $id?: string | number;
}

/**
 * A query result node. `$from` and `$to` mirror kodo-core 0.2.0's
 * `DataNode.$from` / `DataNode.$to`, the direct DataNode neighbours of the
 * node, so the result network edges can be rebuilt without walking the raw
 * query-node path (`$fromQN`).
 *
 * A node may have several neighbours (e.g. the same row reached through two
 * links), so both lists are de-duplicated references.
 */
export interface DataNodeDTO {
  $ns: string;
  $id?: string | number;
  data: Record<string, unknown>;
  /** Immediate parent DataNodes (kodo-core `DataNode.$from`). */
  $from: DataNodeRefDTO[];
  /** Immediate child DataNodes (kodo-core `DataNode.$to`). */
  $to: DataNodeRefDTO[];
  /**
   * True when the startup QueryNode returned this node directly (one of its
   * `$fromQN` entries has no `$fromDN`). Kept separately from `$from` so the
   * query node keeps its outgoing edges even when a recursive lookup also
   * gives the node data-node parents.
   */
  $fromQuery: boolean;
}

export interface LookupResponseDTO {
  nodes: DataNodeDTO[];
  /** WebConsole output produced while checking this query's rules. */
  console?: WebConsoleBatchDTO;
}

/* ------------------------------------------------------------------ *
 * kodo-core notification rules & the WebConsole channel.
 * ------------------------------------------------------------------ */

export type RuleExpectDTO = "all" | "any" | "none";

/**
 * kodo-core 0.2.0 `QueryMatch<T>`: the target namespace (optional), the
 * quantifier, and the per-node predicate. It is the object form of
 * `NotificationRule.matchExpression`.
 */
export interface QueryMatchDTO {
  $ns?: string;
  expect: RuleExpectDTO;
  match: QueryExpressionDTO;
}

/**
 * A kodo-core 0.2.0 `NotificationRule`, safe to send over the wire as JSON.
 *
 * `matchExpression` is either a CEL expression string (evaluated against
 * `nodes`) or a `QueryMatchDTO` object. kodo-core 0.2.0 moved the old
 * top-level `$ns` / `expect` / `match` fields into this node.
 */
export interface NotificationRuleDTO {
  id?: string;
  description?: string;
  active?: boolean;
  matchExpression: QueryMatchDTO | string;
  notify?: {
    channels?: string[];
    message?: string;
  };
}

export type WebConsoleLevel = "success" | "error" | "alert";

/** One line written to the WebConsole by a notifier (or by the UI itself). */
export interface WebConsoleMessageDTO {
  level: WebConsoleLevel;
  message: string;
  /** Violating-node summaries shown under an error message. */
  details?: string[];
}

/** All lines written during one rule-check execution. */
export interface WebConsoleBatchDTO {
  id: string;
  at: string;
  title: string;
  messages: WebConsoleMessageDTO[];
}
