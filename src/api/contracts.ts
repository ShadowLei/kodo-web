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
}

/** A reference to another data node (used to reconstruct edges). */
export interface DataNodeRefDTO {
  $ns: string;
  $id?: string | number;
}

/**
 * A query result node. `$from` points at the node that produced it
 * (its `$fromQN.$fromDN`), so the result network edges can be rebuilt.
 */
export interface DataNodeDTO {
  $ns: string;
  $id?: string | number;
  data: Record<string, unknown>;
  $from?: DataNodeRefDTO | null;
}

export interface LookupResponseDTO {
  nodes: DataNodeDTO[];
}
