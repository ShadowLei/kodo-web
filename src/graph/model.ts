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

/**
 * Parent ids of a data node that actually exist in this result and are not
 * repeated, so a node reached twice through the same parent gets one edge.
 */
function uniqueParentIds(n: DataNodeDTO, known: Set<string>): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  n.$from.forEach((parent) => {
    const pid = idOf(parent);
    if (!known.has(pid) || seen.has(pid)) return;
    seen.add(pid);
    ids.push(pid);
  });
  return ids;
}

const LAYER_GAP_X = 220;
const LAYER_GAP_Y = 92;
const NODE_RADIUS = 36;

export interface QueryInfo {
  ns: string;
  expression: QueryExpressionDTO;
}

/** Build a data graph (DataNodes + parent/child edges) from a lookup result. */
export function buildDataGraph(nodes: DataNodeDTO[], query?: QueryInfo): Graph {
  const nodeIds = new Set(nodes.map(idOf));
  const childrenOf = new Map<string, DataNodeDTO[]>();
  const parentIdsOf = new Map<string, string[]>();
  const nodesWithoutParent: DataNodeDTO[] = [];

  // A node may have several parents (kodo-core records every query path that
  // reached it), so both the child index and the edges are built per parent.
  nodes.forEach((n) => {
    const id = idOf(n);
    const parentIds = uniqueParentIds(n, nodeIds);
    parentIdsOf.set(id, parentIds);
    if (parentIds.length === 0) nodesWithoutParent.push(n);
    parentIds.forEach((pid) => {
      const arr = childrenOf.get(pid) ?? [];
      arr.push(n);
      childrenOf.set(pid, arr);
    });
  });

  // Direct results of the startup query anchor the layout, even when a
  // recursive lookup also gave them data-node parents (a cycle). Without this
  // anchor every node would look like a root and collapse into one column, and
  // the query -> result edges would be lost.
  const querySeeds = nodes.filter((n) => n.$fromQuery);
  const seeds = querySeeds.length ? querySeeds : nodesWithoutParent;

  // BFS layering by depth. The `visited` set also protects against a cycle in
  // the parent graph (e.g. mutually recursive links), which would otherwise
  // enqueue nodes forever.
  const depthOf = new Map<string, number>();
  const queue: { node: DataNodeDTO; depth: number }[] = seeds.map((r) => ({ node: r, depth: 0 }));
  const visited = new Set<string>();

  while (queue.length) {
    const { node, depth } = queue.shift()!;
    const id = idOf(node);
    if (visited.has(id)) continue;
    visited.add(id);
    depthOf.set(id, depth);
    (childrenOf.get(id) ?? []).forEach((k) => {
      if (!visited.has(idOf(k))) queue.push({ node: k, depth: depth + 1 });
    });
  }

  // Anything the anchor walk missed (disconnected or only reached backwards)
  // still gets a layer rather than being dropped from the layout.
  nodes.forEach((n) => {
    const id = idOf(n);
    if (!depthOf.has(id)) depthOf.set(id, 0);
  });

  const maxDepth = Math.max(0, ...Array.from(depthOf.values()));
  const layers: DataNodeDTO[][] = Array.from({ length: maxDepth + 1 }, () => []);
  nodes.forEach((n) => {
    layers[depthOf.get(idOf(n)) ?? 0].push(n);
  });

  // Reorder each layer by the average position of its neighbours in the
  // adjacent layer (a few barycenter sweeps). This keeps related nodes close
  // and removes most edge crossings without moving nodes out of their layer.
  orderLayers(layers, depthOf, parentIdsOf);

  const maxSiblings = Math.max(1, ...layers.map((layer) => layer.length));
  const height = Math.max(620, maxSiblings * LAYER_GAP_Y + 120);
  const cy = height / 2;

  // The query node occupies the leftmost layer; shift data layers to the right.
  const layerOffset = query ? 1 : 0;

  const graphNodes: GraphNode[] = [];
  layers.forEach((layer, depth) => {
    layer.forEach((n, idx) => {
      graphNodes.push({
        id: idOf(n),
        label: n.$ns,
        sublabel: String(n.$id),
        ns: n.$ns,
        kind: "data",
        isRoot: n.$fromQuery,
        data: n.data,
        dataNode: n,
        x: 140 + (depth + layerOffset) * LAYER_GAP_X,
        y: cy + (idx - (layer.length - 1) / 2) * LAYER_GAP_Y,
        radius: NODE_RADIUS,
      });
    });
  });

  const edges: GraphEdge[] = [];
  nodes.forEach((n) => {
    uniqueParentIds(n, nodeIds).forEach((pid) => {
      edges.push({
        id: `${pid}->${idOf(n)}`,
        from: pid,
        to: idOf(n),
      });
    });
  });

  // Connect the startup QueryNode to the nodes it returned directly.
  if (query) {
    const queryId = `query:${query.ns}`;
    const queryTargets = querySeeds.length ? querySeeds : nodesWithoutParent;
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
    queryTargets.forEach((r) => {
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

/** Stable barycenter ordering of each layer (a few sweeps, both directions). */
function orderLayers(
  layers: DataNodeDTO[][],
  depthOf: Map<string, number>,
  parentIdsOf: Map<string, string[]>,
): void {
  const indexInLayer = new Map<string, number>();
  const reindex = () => {
    layers.forEach((layer) => layer.forEach((n, i) => indexInLayer.set(idOf(n), i)));
  };
  reindex();

  const childIdsOf = new Map<string, string[]>();
  parentIdsOf.forEach((parentIds, id) => {
    parentIds.forEach((pid) => {
      const arr = childIdsOf.get(pid) ?? [];
      arr.push(id);
      childIdsOf.set(pid, arr);
    });
  });

  const averageIndex = (ids: string[], targetDepth: number): number | null => {
    let sum = 0;
    let count = 0;
    ids.forEach((id) => {
      if (depthOf.get(id) !== targetDepth) return;
      const idx = indexInLayer.get(id);
      if (idx === undefined) return;
      sum += idx;
      count++;
    });
    return count ? sum / count : null;
  };

  const sortLayer = (layer: DataNodeDTO[], score: (n: DataNodeDTO) => number | null) =>
    layer
      .map((node, index) => ({ node, index, score: score(node) }))
      .sort((a, b) => {
        const av = a.score ?? a.index;
        const bv = b.score ?? b.index;
        return av === bv ? a.index - b.index : av - bv;
      })
      .map((entry) => entry.node);

  for (let pass = 0; pass < 4; pass++) {
    for (let d = 1; d < layers.length; d++) {
      layers[d] = sortLayer(layers[d], (n) => averageIndex(parentIdsOf.get(idOf(n)) ?? [], d - 1));
      reindex();
    }
    for (let d = layers.length - 2; d >= 0; d--) {
      layers[d] = sortLayer(layers[d], (n) => averageIndex(childIdsOf.get(idOf(n)) ?? [], d + 1));
      reindex();
    }
  }
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
