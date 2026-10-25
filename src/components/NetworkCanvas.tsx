import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Circle, Text, Arrow, Rect } from "react-konva";
import type { Graph, GraphNode } from "@/graph/model";
import { useContainerSize } from "@/hooks/useContainerSize";

interface Props {
  graph: Graph;
  onNodeClick?: (node: GraphNode) => void;
}

const COLORS = {
  schema: { fill: "#4c6ef5", text: "#ffffff" },
  data: { fill: "#12b886", text: "#ffffff" },
  root: { fill: "#f08c00", text: "#ffffff" },
  edge: "#868e96",
  edgeData: "#adb5bd",
};

export function NetworkCanvas({ graph, onNodeClick }: Props) {
  const { ref, width, height } = useContainerSize<HTMLDivElement>();
  const stageRef = useRef<any>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Node positions live in state so dragging updates the connecting edges.
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    const p: Record<string, { x: number; y: number }> = {};
    graph.nodes.forEach((n) => (p[n.id] = { x: n.x, y: n.y }));
    setPositions(p);
    setSelectedId(null);
  }, [graph]);

  // Auto-fit the graph into view when it changes.
  useEffect(() => {
    if (!graph.nodes.length || !width || !height) return;
    const xs = graph.nodes.map((n) => n.x);
    const ys = graph.nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const gw = Math.max(1, maxX - minX);
    const gh = Math.max(1, maxY - minY);
    const fit = Math.min(width / gw, height / gh) * 0.9;
    const s = Math.min(Math.max(fit, 0.2), 1.6);
    setScale(s);
    setOffset({
      x: (width - (minX + maxX) * s) / 2,
      y: (height - (minY + maxY) * s) / 2,
    });
  }, [graph, width, height]);

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

  const handleDragMove = (e: any, id: string) => {
    setPositions((prev) => ({
      ...prev,
      [id]: { x: e.target.x(), y: e.target.y() },
    }));
  };

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
      const r1 = fromNode?.radius ?? 40;
      const r2 = toNode?.radius ?? 40;
      const start = { x: from.x + ux * r1, y: from.y + uy * r1 };
      const end = { x: to.x - ux * (r2 + 10), y: to.y - uy * (r2 + 10) };
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      return { edge, start, end, mid };
    });
  }, [graph, positions]);

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
      >
        <Layer>
          {/* background: click/drag empty space to pan */}
          <Rect
            x={-5000}
            y={-5000}
            width={10000}
            height={10000}
            fill="transparent"
            onClick={() => setSelectedId(null)}
            draggable
            onDragEnd={(e: any) => setOffset({ x: e.target.x(), y: e.target.y() })}
            onDragMove={(e: any) => setOffset({ x: e.target.x(), y: e.target.y() })}
            listening
          />

          {edgeSegments.map((seg) => {
            if (!seg) return null;
            const isSchema = nodeById.get(seg.edge.from)?.kind === "schema";
            return (
              <Group key={seg.edge.id}>
                <Arrow
                  points={[seg.start.x, seg.start.y, seg.end.x, seg.end.y]}
                  stroke={isSchema ? COLORS.edge : COLORS.edgeData}
                  strokeWidth={isSchema ? 2 : 1.5}
                  fill={isSchema ? COLORS.edge : COLORS.edgeData}
                  pointerLength={9}
                  pointerWidth={9}
                />
                {seg.edge.label && (
                  <Text
                    x={seg.mid.x}
                    y={seg.mid.y - 8}
                    text={seg.edge.label}
                    fontSize={11}
                    fontStyle="italic"
                    fill="#495057"
                    align="center"
                  />
                )}
              </Group>
            );
          })}

          {graph.nodes.map((node) => {
            const pos = positions[node.id] ?? { x: node.x, y: node.y };
            const isSelected = selectedId === node.id;
            const color =
              node.kind === "schema"
                ? COLORS.schema
                : node.isRoot
                  ? COLORS.root
                  : COLORS.data;
            const r = node.radius;

            return (
              <Group
                key={node.id}
                x={pos.x}
                y={pos.y}
                draggable
                onDragMove={(e: any) => handleDragMove(e, node.id)}
                onClick={() => {
                  setSelectedId(node.id);
                  onNodeClick?.(node);
                }}
                onTap={() => {
                  setSelectedId(node.id);
                  onNodeClick?.(node);
                }}
              >
                <Circle
                  radius={r}
                  fill={color.fill}
                  stroke={isSelected ? "#ffd43b" : "#ffffff"}
                  strokeWidth={isSelected ? 4 : 2}
                  shadowColor="#00000044"
                  shadowBlur={6}
                  shadowOffsetY={3}
                />
                <Text
                  text={node.label}
                  fontSize={node.kind === "schema" ? 13 : 12}
                  fontStyle="bold"
                  fill={color.text}
                  width={r * 2}
                  align="center"
                  offsetY={node.sublabel ? 6 : 3}
                  y={-r}
                  x={-r}
                />
                {node.sublabel && (
                  <Text
                    text={node.sublabel}
                    fontSize={10}
                    fill={color.text}
                    width={r * 2}
                    align="center"
                    offsetY={-9}
                    y={-r}
                    x={-r}
                  />
                )}
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
