import type { DataNodeDTO, NetworkDTO } from "@/api/contracts";

/** A node ready to be rendered on the canvas. */
export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  ns: string;
  kind: "schema" | "data";
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
      radius: 48,
    };
  });

  const edges: GraphEdge[] = network.linkNodes.map((ln, i) => ({
    id: ln.$id ?? `edge-${i}`,
    from: ln.$from,
    to: ln.$to,
    label: `${ln.expression.$from ?? ""} ${ln.expression.$op ?? ""} ${ln.expression.$to ?? ""}`,
  }));

  return { nodes, edges, width, height };
}

const idOf = (n: { $ns: string; $id?: string | number }) => `${n.$ns}.${n.$id}`;

const LAYER_GAP_X = 230;
const LAYER_GAP_Y = 96;
const NODE_RADIUS = 40;

/** Build a data graph (DataNodes + parent/child edges) from a lookup result. */
export function buildDataGraph(nodes: DataNodeDTO[]): Graph {
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
      x: 140 + depth * LAYER_GAP_X,
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

  const width = 140 + (maxDepth + 1) * LAYER_GAP_X + 120;
  return { nodes: graphNodes, edges, width, height };
}
