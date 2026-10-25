import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Circle, Text, Arrow, Rect } from "react-konva";
import type { Graph, GraphNode } from "@/graph/model";
import { useContainerSize } from "@/hooks/useContainerSize";
import {
  LAYOUT_STRATEGIES,
  computeLayout,
  easeInOutCubic,
  type LayoutStrategy,
  type PositionMap,
} from "@/graph/forceLayout";

interface Props {
  graph: Graph;
  /** Previously saved node positions for this tab (restored on mount). */
  savedPositions?: PositionMap;
  /** Called with the final positions after a drag or re-layout. */
  onPositionsCommit?: (positions: PositionMap) => void;
  onNodeClick?: (node: GraphNode) => void;
}

// "Whimsical Fall" inspired palette: warm, soft autumn tones with dark text on
// pastel fills (instead of white-on-light) so titles stay readable.
const COLORS = {
  query: { fill: "#8D6E63", text: "#FBF3E4", sub: "#EFE0CE" },
  edge: "#C8A878",
  edgeData: "#B8A184",
  edgeLabel: "#6B5844",
  nodeStroke: "#B08968",
  selected: "#FFD43B",
  text: "#3E2F23",
};

// Distinct (pastel) fill per namespace, so different `ns` render in different colors.
const NS_PALETTE = [
  "#F4A259",
  "#A3B18A",
  "#E76F51",
  "#D9A5B3",
  "#8AB6D6",
  "#E9C46A",
  "#94A684",
  "#C89F9C",
  "#D9B48F",
  "#9DB4A0",
];

function nsColor(ns: string): { fill: string; text: string } {
  let h = 0;
  for (let i = 0; i < ns.length; i++) h = (h * 31 + ns.charCodeAt(i)) >>> 0;
  return { fill: NS_PALETTE[h % NS_PALETTE.length], text: COLORS.text };
}

// Rough pixel-width estimate for a single-line text (used to size nodes so
// labels never wrap / fold).
function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62;
}

// Wide text box so labels stay on one line (they may overflow the node).
const TEXT_BOX = 360;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function NetworkCanvas({ graph, savedPositions, onPositionsCommit, onNodeClick }: Props) {
  const { ref, width, height } = useContainerSize<HTMLDivElement>();
  const stageRef = useRef<any>(null);
  const animRef = useRef<number | null>(null);
  const positionsRef = useRef<PositionMap>({});
  const panRef = useRef<{ x: number; y: number } | null>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<LayoutStrategy>("force");

  const [positions, setPositions] = useState<PositionMap>({});

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  // Dynamically scale node size with the available viewport.
  const nodeScale = useMemo(() => {
    if (!width || !height) return 1;
    const m = Math.min(width, height);
    return clamp(m / 900, 0.55, 0.9);
  }, [width, height]);
  const fontScale = clamp(nodeScale, 0.75, 1);

  const fitTo = useCallback(
    (pos: PositionMap): { scale: number; offset: { x: number; y: number } } => {
      const entries = Object.values(pos);
      if (!entries.length || !width || !height) {
        return { scale: 1, offset: { x: 0, y: 0 } };
      }
      const xs = entries.map((p) => p.x);
      const ys = entries.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const gw = Math.max(1, maxX - minX);
      const gh = Math.max(1, maxY - minY);
      const fit = Math.min(width / gw, height / gh) * 0.88;
      const s = clamp(fit, 0.2, 1.25);
      return {
        scale: s,
        offset: {
          x: (width - (minX + maxX) * s) / 2,
          y: (height - (minY + maxY) * s) / 2,
        },
      };
    },
    [width, height],
  );

  // Restore saved positions (or defaults) + fit view when the graph changes.
  useEffect(() => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    const p: PositionMap = {};
    graph.nodes.forEach((n) => {
      p[n.id] = savedPositions?.[n.id] ?? { x: n.x, y: n.y };
    });
    setPositions(p);
    setSelectedId(null);
    const fit = fitTo(p);
    setScale(fit.scale);
    setOffset(fit.offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, width, height]);

  // Cancel any in-flight layout animation on unmount.
  useEffect(() => {
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const scaleBy = 1.06;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? scale * scaleBy : scale / scaleBy;
    const mousePointTo = {
      x: (pointer.x - offset.x) / scale,
      y: (pointer.y - offset.y) / scale,
    };
    setScale(newScale);
    setOffset({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  // --- background pan: drag empty space to move the whole canvas ---
  const handleBackgroundMouseDown = () => {
    const pointer = stageRef.current?.getPointerPosition();
    if (pointer) panRef.current = { x: pointer.x, y: pointer.y };
  };

  const handleStageMouseMove = () => {
    if (!panRef.current) return;
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    const dx = pointer.x - panRef.current.x;
    const dy = pointer.y - panRef.current.y;
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    panRef.current = { x: pointer.x, y: pointer.y };
  };

  const handleStageMouseUp = () => {
    panRef.current = null;
  };

  const handleDragMove = (e: any, id: string) => {
    setPositions((prev) => ({
      ...prev,
      [id]: { x: e.target.x(), y: e.target.y() },
    }));
  };

  const handleDragEnd = (e: any, id: string) => {
    const next = {
      ...positionsRef.current,
      [id]: { x: e.target.x(), y: e.target.y() },
    };
    setPositions(next);
    onPositionsCommit?.(next);
  };

  // Re-run the selected layout and animate nodes to their new positions.
  const relayout = useCallback(() => {
    if (!graph.nodes.length || !width || !height) return;
    if (animRef.current != null) cancelAnimationFrame(animRef.current);

    const from = positions;
    const to = computeLayout(strategy, graph, positions);
    const target = fitTo(to);

    const startScale = scale;
    const startOffset = offset;
    const duration = 700;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const e = easeInOutCubic(t);
      const next: PositionMap = {};
      for (const id in to) {
        const a = from[id] ?? to[id];
        const b = to[id];
        next[id] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      }
      setPositions(next);
      setScale(startScale + (target.scale - startScale) * e);
      setOffset({
        x: startOffset.x + (target.offset.x - startOffset.x) * e,
        y: startOffset.y + (target.offset.y - startOffset.y) * e,
      });
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
        onPositionsCommit?.(to);
      }
    };
    animRef.current = requestAnimationFrame(step);
  }, [graph, positions, strategy, scale, offset, width, height, fitTo, onPositionsCommit]);

  // Compute edge endpoints, shortened to the node boundary.
  const edgeSegments = useMemo(() => {
    return graph.edges.map((edge) => {
      const from = positions[edge.from];
      const to = positions[edge.to];
      if (!from || !to) return null;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const fromNode = graph.nodes.find((n) => n.id === edge.from);
      const toNode = graph.nodes.find((n) => n.id === edge.to);
      const r1 = (fromNode?.radius ?? 34) * nodeScale;
      const r2 = (toNode?.radius ?? 34) * nodeScale;
      const pad1 = edge.bidirectional ? 10 : 0;
      const pad2 = 10;
      const start = { x: from.x + ux * (r1 + pad1), y: from.y + uy * (r1 + pad1) };
      const end = { x: to.x - ux * (r2 + pad2), y: to.y - uy * (r2 + pad2) };
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      return { edge, start, end, mid };
    });
  }, [graph, positions, nodeScale]);

  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    graph.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [graph.nodes]);

  if (!width || !height) {
    return <div ref={ref} className="canvas-host" />;
  }

  return (
    <div ref={ref} className="canvas-host">
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        x={offset.x}
        y={offset.y}
        scaleX={scale}
        scaleY={scale}
        onWheel={handleWheel}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseUp}
      >
        <Layer>
          {/* background: drag empty space to pan, click to clear selection */}
          <Rect
            x={-5000}
            y={-5000}
            width={10000}
            height={10000}
            fill="transparent"
            onClick={() => setSelectedId(null)}
            onMouseDown={handleBackgroundMouseDown}
            listening
          />

          {edgeSegments.map((seg) => {
            if (!seg) return null;
            const isSchema = nodeById.get(seg.edge.from)?.kind === "schema";
            const edgeColor = isSchema ? COLORS.edge : COLORS.edgeData;
            return (
              <Group key={seg.edge.id}>
                <Arrow
                  points={[seg.start.x, seg.start.y, seg.end.x, seg.end.y]}
                  stroke={edgeColor}
                  strokeWidth={isSchema ? 2 : 1.5}
                  fill={edgeColor}
                  pointerLength={9}
                  pointerWidth={9}
                  pointerAtBeginning={!!seg.edge.bidirectional}
                  pointerAtEnding
                />
                {seg.edge.label && (
                  <Text
                    x={seg.mid.x}
                    y={seg.mid.y - 8}
                    text={seg.edge.label}
                    fontSize={11}
                    fontStyle="italic"
                    fill={COLORS.edgeLabel}
                    align="center"
                  />
                )}
              </Group>
            );
          })}

          {graph.nodes.map((node) => {
            const pos = positions[node.id] ?? { x: node.x, y: node.y };
            const isSelected = selectedId === node.id;
            const color = node.kind === "query" ? COLORS.query : nsColor(node.ns);

            const handleClick = () => {
              setSelectedId(node.id);
              onNodeClick?.(node);
            };

            // QueryNode: rounded rectangle with ns (title) + expression (main
            // key), vertically centered, never folded/truncated.
            if (node.kind === "query") {
              const expr = node.sublabel ?? "";
              const fs1 = 12 * fontScale;
              const fs2 = 9 * fontScale;
              const lh1 = fs1 * 1.2;
              const lh2 = fs2 * 1.2;
              const gap = 4;
              const qw = clamp(
                Math.max(estimateTextWidth(node.label, fs1), estimateTextWidth(expr, fs2)) + 24,
                110,
                420,
              );
              const qh = lh1 + gap + lh2 + 16;
              const top = -qh / 2 + 8;
              return (
                <Group
                  key={node.id}
                  x={pos.x}
                  y={pos.y}
                  draggable
                  onDragMove={(e: any) => handleDragMove(e, node.id)}
                  onDragEnd={(e: any) => handleDragEnd(e, node.id)}
                  onClick={handleClick}
                  onTap={handleClick}
                >
                  <Rect
                    x={-qw / 2}
                    y={-qh / 2}
                    width={qw}
                    height={qh}
                    cornerRadius={10}
                    fill={color.fill}
                    stroke={isSelected ? COLORS.selected : COLORS.nodeStroke}
                    strokeWidth={isSelected ? 3 : 1.5}
                    shadowColor={isSelected ? COLORS.selected : "#00000033"}
                    shadowBlur={isSelected ? 16 : 5}
                    shadowOffsetY={isSelected ? 0 : 2}
                  />
                  <Text
                    text={node.label}
                    fontSize={fs1}
                    fontStyle="bold"
                    fill={color.text}
                    width={qw - 12}
                    align="center"
                    x={-qw / 2 + 6}
                    y={top}
                  />
                  <Text
                    text={expr}
                    fontSize={fs2}
                    fill={COLORS.query.sub}
                    width={qw - 12}
                    align="center"
                    x={-qw / 2 + 6}
                    y={top + lh1 + gap}
                  />
                </Group>
              );
            }

            // Circle nodes (schema / data): uniform size; a long label may
            // overflow the circle but stays on a single line (no folding).
            const labelFont = Math.round((node.kind === "schema" ? 13 : 12) * fontScale);
            const subFont = Math.round(10 * fontScale);
            const r = node.radius * nodeScale;

            const lh = labelFont * 1.2;
            const slh = subFont * 1.2;
            const gap = 3 * fontScale;
            const totalH = node.sublabel ? lh + gap + slh : lh;
            const startY = -totalH / 2;

            return (
              <Group
                key={node.id}
                x={pos.x}
                y={pos.y}
                draggable
                onDragMove={(e: any) => handleDragMove(e, node.id)}
                onDragEnd={(e: any) => handleDragEnd(e, node.id)}
                onClick={handleClick}
                onTap={handleClick}
              >
                <Circle
                  radius={r}
                  fill={color.fill}
                  stroke={isSelected ? COLORS.selected : COLORS.nodeStroke}
                  strokeWidth={isSelected ? 4 : 2}
                  shadowColor={isSelected ? COLORS.selected : "#00000044"}
                  shadowBlur={isSelected ? 16 : 6}
                  shadowOffsetY={isSelected ? 0 : 3}
                />
                <Text
                  text={node.label}
                  fontSize={labelFont}
                  fontStyle="bold"
                  fill={color.text}
                  width={TEXT_BOX}
                  align="center"
                  x={-TEXT_BOX / 2}
                  y={startY}
                />
                {node.sublabel && (
                  <Text
                    text={node.sublabel}
                    fontSize={subFont}
                    fill={color.text}
                    width={TEXT_BOX}
                    align="center"
                    x={-TEXT_BOX / 2}
                    y={startY + lh + gap}
                  />
                )}
              </Group>
            );
          })}
        </Layer>
      </Stage>

      <div className="relayout-toolbar">
        <select
          className="relayout-select"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as LayoutStrategy)}
          title="Layout strategy"
        >
          {LAYOUT_STRATEGIES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          className="relayout-btn"
          onClick={relayout}
          title="Re-arrange nodes with the selected strategy"
        >
          <span aria-hidden="true">↻</span> Re-layout
        </button>
      </div>
    </div>
  );
}


