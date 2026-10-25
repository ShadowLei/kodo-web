import type { Graph, GraphNode } from "./model";

export type PositionMap = Record<string, { x: number; y: number }>;

export type LayoutStrategy = "force" | "lr" | "tb" | "spiral";

export const LAYOUT_STRATEGIES: { id: LayoutStrategy; label: string }[] = [
  { id: "force", label: "Force" },
  { id: "lr", label: "Left → Right" },
  { id: "tb", label: "Top → Bottom" },
  { id: "spiral", label: "Spiral" },
];

/** Dispatch a layout strategy; `initial` seeds force-directed runs. */
export function computeLayout(
  strategy: LayoutStrategy,
  graph: Graph,
  initial: PositionMap,
): PositionMap {
  switch (strategy) {
    case "lr":
      return layeredLayout(graph, "lr");
    case "tb":
      return layeredLayout(graph, "tb");
    case "spiral":
      return spiralLayout(graph);
    case "force":
    default:
      return forceDirectedLayout(graph, initial);
  }
}

/**
 * A simple Fruchterman–Reingold force-directed layout.
 *
 * Spreads nodes apart (repulsion), pulls connected nodes together (attraction)
 * and adds a light centering gravity, so edges are untangled and crossings are
 * reduced. `initial` seeds the simulation with the current positions so the
 * result stays visually stable between runs.
 */
export function forceDirectedLayout(
  graph: Graph,
  initial: PositionMap,
  iterations = 300,
): PositionMap {
  const nodes = graph.nodes;
  if (nodes.length === 0) return {};

  const width = Math.max(graph.width, 400);
  const height = Math.max(graph.height, 400);

  const pos: PositionMap = {};
  const disp: PositionMap = {};
  nodes.forEach((n) => {
    const p = initial[n.id] ?? { x: n.x, y: n.y };
    pos[n.id] = { x: p.x, y: p.y };
    disp[n.id] = { x: 0, y: 0 };
  });

  const area = width * height;
  // Cap the ideal separation so connected nodes stay reasonably close.
  const k = Math.min(Math.sqrt(area / nodes.length), 150);
  const cx = width / 2;
  const cy = height / 2;

  for (let it = 0; it < iterations; it++) {
    const t = Math.max(0.05, 1 - it / iterations); // cooling factor

    nodes.forEach((n) => {
      disp[n.id].x = 0;
      disp[n.id].y = 0;
    });

    // Repulsion between all pairs.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = pos[a.id].x - pos[b.id].x;
        const dy = pos[a.id].y - pos[b.id].y;
        const d2 = Math.max(dx * dx + dy * dy, 0.01);
        const d = Math.sqrt(d2);
        const force = (k * k) / d;
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        disp[a.id].x += fx;
        disp[a.id].y += fy;
        disp[b.id].x -= fx;
        disp[b.id].y -= fy;
      }
    }

    // Attraction along edges.
    graph.edges.forEach((e) => {
      const a = pos[e.from];
      const b = pos[e.to];
      if (!a || !b) return;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (d * d) / k;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      disp[e.from].x -= fx;
      disp[e.from].y -= fy;
      disp[e.to].x += fx;
      disp[e.to].y += fy;
    });

    // Apply displacement (capped) + centering gravity + clamp to bounds.
    nodes.forEach((n) => {
      const d = disp[n.id];
      const dist = Math.sqrt(d.x * d.x + d.y * d.y) || 1;
      const limited = Math.min(dist, t * k);
      pos[n.id].x += (d.x / dist) * limited + (cx - pos[n.id].x) * 0.06 * t;
      pos[n.id].y += (d.y / dist) * limited + (cy - pos[n.id].y) * 0.06 * t;
      pos[n.id].x = clamp(pos[n.id].x, 60, width - 60);
      pos[n.id].y = clamp(pos[n.id].y, 60, height - 60);
    });
  }

  return pos;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ---------------------- additional layout strategies ---------------------- */

interface BfsResult {
  order: GraphNode[];
  depth: Map<string, number>;
}

/** Breadth-first traversal from the graph roots (nodes with no incoming edge). */
function bfs(graph: Graph): BfsResult {
  const nodes = graph.nodes;
  const inDeg = new Map<string, number>();
  nodes.forEach((n) => inDeg.set(n.id, 0));
  graph.edges.forEach((e) => {
    if (inDeg.has(e.to)) inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  });

  const roots = nodes.filter((n) => (inDeg.get(n.id) ?? 0) === 0);
  const start = roots.length ? roots : nodes.slice(0, 1);

  const depth = new Map<string, number>();
  const order: GraphNode[] = [];
  const visited = new Set<string>();
  const queue: GraphNode[] = [...start];
  start.forEach((r) => depth.set(r.id, 0));

  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);
    order.push(cur);
    const d = depth.get(cur.id) ?? 0;
    graph.edges.forEach((e) => {
      if (e.from === cur.id && !depth.has(e.to)) {
        depth.set(e.to, d + 1);
        const t = nodes.find((n) => n.id === e.to);
        if (t) queue.push(t);
      }
    });
  }

  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      order.push(n);
      depth.set(n.id, 0);
    }
  });

  return { order, depth };
}

/** Layered (tree) layout: left-to-right or top-to-bottom. */
export function layeredLayout(graph: Graph, direction: "lr" | "tb"): PositionMap {
  const nodes = graph.nodes;
  if (!nodes.length) return {};

  const { depth } = bfs(graph);

  const byDepth = new Map<number, GraphNode[]>();
  depth.forEach((d, id) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    const arr = byDepth.get(d) ?? [];
    arr.push(n);
    byDepth.set(d, arr);
  });

  const maxDepth = Math.max(0, ...Array.from(depth.values()));
  const maxSiblings = Math.max(1, ...Array.from(byDepth.values()).map((a) => a.length));

  const width = Math.max(graph.width, 400);
  const height = Math.max(graph.height, 400);
  const hGap = (width - 140) / Math.max(1, maxDepth + 1);
  const vGap = (height - 120) / maxSiblings;

  const pos: PositionMap = {};
  nodes.forEach((n) => {
    const d = depth.get(n.id) ?? 0;
    const siblings = byDepth.get(d) ?? [];
    const idx = siblings.findIndex((s) => s.id === n.id);
    const center = idx - (siblings.length - 1) / 2;
    if (direction === "lr") {
      pos[n.id] = { x: 70 + d * hGap, y: height / 2 + center * vGap };
    } else {
      pos[n.id] = { x: width / 2 + center * hGap, y: 70 + d * vGap };
    }
  });

  return pos;
}

/** Spiral (vortex) layout: nodes arranged along a golden-angle spiral. */
export function spiralLayout(graph: Graph): PositionMap {
  const nodes = graph.nodes;
  if (!nodes.length) return {};

  const { order } = bfs(graph);
  const width = Math.max(graph.width, 400);
  const height = Math.max(graph.height, 400);
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) / 2 - 80;
  const n = order.length;

  // Golden angle (~137.5°) distributes nodes evenly around the spiral.
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  // Start the spiral off-center so the (wider) query node never overlaps others.
  const minR = 70;

  const pos: PositionMap = {};
  order.forEach((node, i) => {
    const angle = i * GOLDEN_ANGLE;
    const t = n <= 1 ? 0 : Math.sqrt(i / (n - 1));
    const r = minR + t * (maxR - minR);
    pos[node.id] = { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });

  return pos;
}
