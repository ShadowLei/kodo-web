import type { DataNodeDTO, NetworkDTO, QueryExpressionDTO } from "@/api/contracts";

/** A node ready to be rendered on the canvas. */
export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  ns: string;
  kind: "schema" | "data" | "query";
  isRoot?: boolean;
  data?: Record<string, unknown>;
  dataNode?: DataNodeDTO;
  x: number;
  y: number;
  radius: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** When true, draw arrowheads on both ends (e.g. `==` links). */
  bidirectional?: boolean;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

/** Build a schema graph (namespace nodes + LinkNode edges) from a NetworkDTO. */
export function buildSchemaGraph(network: NetworkDTO): Graph {
  const names = new Set<string>();
  network.linkNodes.forEach((ln) => {
    names.add(ln.$from);
    names.add(ln.$to);
  });
  network.dataModels.forEach((dm) => names.add(dm.name));

  const ordered = Array.from(names);
  const width = 720;
  const height = 620;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 90;

  const nodes: GraphNode[] = ordered.map((name, i) => {
    const angle = (2 * Math.PI * i) / ordered.length - Math.PI / 2;
    return {
      id: name,
      label: name,
      ns: name,
      kind: "schema",
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      radius: 36,
    };
  });

  const edges: GraphEdge[] = network.linkNodes.map((ln, i) => ({
    id: ln.$id ?? `edge-${i}`,
    from: ln.$from,
    to: ln.$to,
    label: `${ln.expression.$from ?? ""} ${ln.expression.$op ?? ""} ${ln.expression.$to ?? ""}`,
    bidirectional: ln.expression.$op === "==",
  }));

  return { nodes, edges, width, height };
}

const idOf = (n: { $ns: string; $id?: string | number }) => `${n.$ns}.${n.$id}`;

const LAYER_GAP_X = 220;
const LAYER_GAP_Y = 92;
const NODE_RADIUS = 36;

export interface QueryInfo {
  ns: string;
  expression: QueryExpressionDTO;
}

/** Build a data graph (DataNodes + parent/child edges) from a lookup result. */
export function buildDataGraph(nodes: DataNodeDTO[], query?: QueryInfo): Graph {
  const childrenOf = new Map<string, DataNodeDTO[]>();
  const roots: DataNodeDTO[] = [];

  nodes.forEach((n) => {
    if (n.$from) {
      const pid = idOf(n.$from);
      const arr = childrenOf.get(pid) ?? [];
      arr.push(n);
      childrenOf.set(pid, arr);
    } else {
      roots.push(n);
    }
  });

  // BFS layering by depth.
  const depthOf = new Map<string, number>();
  const queue: { node: DataNodeDTO; depth: number }[] = roots.map((r) => ({ node: r, depth: 0 }));
  const visited = new Set<string>();

  while (queue.length) {
    const { node, depth } = queue.shift()!;
    const id = idOf(node);
    if (visited.has(id)) continue;
    visited.add(id);
    depthOf.set(id, depth);
    (childrenOf.get(id) ?? []).forEach((k) => queue.push({ node: k, depth: depth + 1 }));
  }

  nodes.forEach((n) => {
    const id = idOf(n);
    if (!depthOf.has(id)) depthOf.set(id, 0);
  });

  const maxDepth = Math.max(0, ...Array.from(depthOf.values()));

  // Group nodes per depth to compute vertical centering.
  const byDepth = new Map<number, DataNodeDTO[]>();
  depthOf.forEach((d, id) => {
    const n = nodes.find((x) => idOf(x) === id)!;
    const arr = byDepth.get(d) ?? [];
    arr.push(n);
    byDepth.set(d, arr);
  });

  const maxSiblings = Math.max(1, ...Array.from(byDepth.values()).map((a) => a.length));
  const height = Math.max(620, maxSiblings * LAYER_GAP_Y + 120);
  const cy = height / 2;

  // The query node occupies the leftmost layer; shift data layers to the right.
  const layerOffset = query ? 1 : 0;

  const graphNodes: GraphNode[] = nodes.map((n) => {
    const id = idOf(n);
    const depth = depthOf.get(id) ?? 0;
    const siblings = byDepth.get(depth) ?? [];
    const idx = siblings.findIndex((s) => idOf(s) === id);
    return {
      id,
      label: n.$ns,
      sublabel: String(n.$id),
      ns: n.$ns,
      kind: "data",
      isRoot: !n.$from,
      data: n.data,
      dataNode: n,
      x: 140 + (depth + layerOffset) * LAYER_GAP_X,
      y: cy + (idx - (siblings.length - 1) / 2) * LAYER_GAP_Y,
      radius: NODE_RADIUS,
    };
  });

  const edges: GraphEdge[] = [];
  nodes.forEach((n) => {
    if (n.$from) {
      edges.push({
        id: `${idOf(n.$from)}->${idOf(n)}`,
        from: idOf(n.$from),
        to: idOf(n),
      });
    }
  });

  // Add the startup QueryNode (the query condition) + edges to its direct results.
  if (query) {
    const queryId = `query:${query.ns}`;
    graphNodes.push({
      id: queryId,
      label: query.ns,
      sublabel: formatExpression(query.expression),
      ns: query.ns,
      kind: "query",
      x: 140,
      y: cy,
      radius: 36,
    });
    roots.forEach((r) => {
      edges.push({
        id: `${queryId}->${idOf(r)}`,
        from: queryId,
        to: idOf(r),
      });
    });
  }

  const width = 140 + (maxDepth + 1 + layerOffset) * LAYER_GAP_X + 120;
  return { nodes: graphNodes, edges, width, height };
}

/* ------------------------- expression formatting ------------------------- */

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(formatValue).join(", ")}]`;
  if (typeof v === "string") return `"${v}"`;
  if (v === null || v === undefined) return String(v);
  return String(v);
}

/** Render a QueryExpression into a compact human-readable string. */
export function formatExpression(exp: QueryExpressionDTO): string {
  const parts: string[] = [];

  for (const key in exp) {
    if (key === "$with" || key === "$where") continue;
    const val = exp[key];
    const isOpValue =
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      "$op" in (val as object);
    if (isOpValue) {
      const op = (val as { $op: string }).$op;
      const opVal = (val as { $val: unknown }).$val;
      parts.push(`${key} ${op} ${formatValue(opVal)}`);
    } else {
      parts.push(`${key} == ${formatValue(val)}`);
    }
  }

  if (exp.$where && exp.$where.length) {
    exp.$where.forEach((w) => parts.push(`(${formatExpression(w)})`));
  }

  const withOp = exp.$with ?? "&&";
  return parts.length ? parts.join(` ${withOp} `) : "(all)";
}
