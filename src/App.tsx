import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createKodoServer } from "@/api";
import type {
  DataModelDTO,
  DataNodeDTO,
  KodoOptionsDTO,
  NetworkDTO,
  NetworkSummaryDTO,
  QueryExpressionDTO,
} from "@/api/contracts";
import { buildDataGraph, buildSchemaGraph } from "@/graph/model";
import type { GraphNode } from "@/graph/model";
import type { PositionMap } from "@/graph/forceLayout";
import { NetworkCanvas } from "@/components/NetworkCanvas";
import { TopBar } from "@/components/TopBar";
import { SideMenu } from "@/components/SideMenu";
import { TabBar, type Tab } from "@/components/TabBar";
import { DataModelModal } from "@/components/DataModelModal";
import { DataNodeModal } from "@/components/DataNodeModal";

interface QueryModalState {
  networkId: string;
  ns: string;
  dataModel: DataModelDTO;
}

interface DataTabResult {
  nodes: DataNodeDTO[];
  ns: string;
  expression: QueryExpressionDTO;
  options: KodoOptionsDTO;
}

const DEFAULT_OPTIONS: KodoOptionsDTO = { tierLimit: 10, limit: 10, recursion: false };

export default function App() {
  const server = useMemo(() => createKodoServer(), []);

  const [networks, setNetworks] = useState<NetworkSummaryDTO[]>([]);
  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(null);

  const [networkCache, setNetworkCache] = useState<Map<string, NetworkDTO>>(new Map());
  const [resultsByTab, setResultsByTab] = useState<Map<string, DataTabResult>>(new Map());

  // Node positions per tab, so re-layouts / drags survive tab switches.
  const [positionsByTab, setPositionsByTab] = useState<Map<string, PositionMap>>(new Map());

  // Tabs & active tab are scoped per network (each menu item keeps its own set).
  const [tabsByNetwork, setTabsByNetwork] = useState<Record<string, Tab[]>>({});
  const [activeTabByNetwork, setActiveTabByNetwork] = useState<Record<string, string>>({});

  const [options, setOptions] = useState<KodoOptionsDTO>(DEFAULT_OPTIONS);
  const [queryModal, setQueryModal] = useState<QueryModalState | null>(null);
  const [dataNodeModal, setDataNodeModal] = useState<DataNodeDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dataTabCounter = useRef(0);

  const tabs = activeNetworkId ? (tabsByNetwork[activeNetworkId] ?? []) : [];
  const activeTabId = activeNetworkId ? (activeTabByNetwork[activeNetworkId] ?? null) : null;

  const selectNetwork = useCallback(
    async (id: string) => {
      setActiveNetworkId(id);
      try {
        const net = await server.getNetwork(id);
        setNetworkCache((prev) => new Map(prev).set(id, net));
        const schemaTabId = `schema:${id}`;
        setTabsByNetwork((prev) => {
          const cur = prev[id] ?? [];
          if (cur.some((t) => t.id === schemaTabId)) return prev;
          return {
            ...prev,
            [id]: [...cur, { id: schemaTabId, title: net.name, kind: "schema", closable: false }],
          };
        });
        // Remember the last active tab for this network (default to the schema tab).
        setActiveTabByNetwork((prev) => ({
          ...prev,
          [id]: prev[id] ?? schemaTabId,
        }));
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    },
    [server],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await server.listNetworks();
        if (cancelled) return;
        setNetworks(list);
        if (list.length) await selectNetwork(list[0].id);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [server, selectNetwork]);

  const handleNodeClick = useCallback(
    async (node: GraphNode) => {
      if (node.kind === "schema" && activeNetworkId) {
        try {
          const dataModel = await server.getDataModel(activeNetworkId, node.ns);
          setQueryModal({ networkId: activeNetworkId, ns: node.ns, dataModel });
        } catch (e) {
          setError(String(e));
        }
      } else if (node.kind === "data" && node.dataNode) {
        setDataNodeModal(node.dataNode);
      } else if (node.kind === "query") {
        // Clicking the QueryNode shows its query condition (like a DataNode).
        setDataNodeModal({
          $ns: node.ns,
          $id: "query",
          data: { condition: node.sublabel ?? "(all)" },
        });
      }
    },
    [server, activeNetworkId],
  );

  const handleQuery = useCallback(
    async (expression: QueryExpressionDTO) => {
      if (!queryModal) return;
      try {
        const res = await server.lookup({
          networkId: queryModal.networkId,
          ns: queryModal.ns,
          expression,
          options,
        });
        const tabId = `data:${dataTabCounter.current++}`;
        const networkId = queryModal.networkId;
        setResultsByTab((prev) =>
          new Map(prev).set(tabId, {
            nodes: res.nodes,
            ns: queryModal.ns,
            expression,
            options,
          }),
        );
        setTabsByNetwork((prev) => ({
          ...prev,
          [networkId]: [
            ...(prev[networkId] ?? []),
            { id: tabId, title: `${queryModal.ns} · ${res.nodes.length}`, kind: "data", closable: true },
          ],
        }));
        setActiveTabByNetwork((prev) => ({ ...prev, [networkId]: tabId }));
        setQueryModal(null);
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    },
    [server, queryModal, options],
  );

  const selectTab = useCallback(
    (tabId: string) => {
      if (!activeNetworkId) return;
      setActiveTabByNetwork((prev) => ({ ...prev, [activeNetworkId]: tabId }));
    },
    [activeNetworkId],
  );

  const closeTab = useCallback(
    (id: string) => {
      if (!activeNetworkId) return;
      setTabsByNetwork((prev) => {
        const cur = prev[activeNetworkId] ?? [];
        const idx = cur.findIndex((t) => t.id === id);
        const next = cur.filter((t) => t.id !== id);
        if ((activeTabByNetwork[activeNetworkId] ?? null) === id) {
          setActiveTabByNetwork((p) => ({
            ...p,
            [activeNetworkId]: next[Math.max(0, idx - 1)]?.id ?? null,
          }));
        }
        return { ...prev, [activeNetworkId]: next };
      });
      setResultsByTab((prev) => {
        const m = new Map(prev);
        m.delete(id);
        return m;
      });
      setPositionsByTab((prev) => {
        const m = new Map(prev);
        m.delete(id);
        return m;
      });
    },
    [activeNetworkId, activeTabByNetwork],
  );

  const activeGraph = useMemo(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return null;
    if (tab.kind === "schema") {
      const networkId = tab.id.slice("schema:".length);
      const net = networkCache.get(networkId);
      return net ? buildSchemaGraph(net) : null;
    }
    const result = resultsByTab.get(tab.id);
    if (!result) return null;
    return buildDataGraph(result.nodes, { ns: result.ns, expression: result.expression });
  }, [tabs, activeTabId, networkCache, resultsByTab]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeResult = activeTabId ? resultsByTab.get(activeTabId) : undefined;

  return (
    <div className="app">
      <TopBar options={options} onChange={setOptions} />
      <div className="app-body">
        <SideMenu networks={networks} activeId={activeNetworkId} onSelect={selectNetwork} />
        <main className="content">
          <TabBar
            tabs={tabs}
            activeId={activeTabId}
            onSelect={selectTab}
            onClose={closeTab}
          />
          {error && (
            <div className="error-banner">
              {error}
              <button className="btn-icon" onClick={() => setError(null)}>✕</button>
            </div>
          )}
          <div className="canvas-area">
            {activeGraph ? (
              <>
                <NetworkCanvas
                  graph={activeGraph}
                  savedPositions={activeTabId ? positionsByTab.get(activeTabId) : undefined}
                  onPositionsCommit={(p) => {
                    if (activeTabId) {
                      setPositionsByTab((prev) => new Map(prev).set(activeTabId, p));
                    }
                  }}
                  onNodeClick={handleNodeClick}
                />
                {activeTab?.kind === "data" && activeResult && (
                  <div className="canvas-options">
                    <div className="canvas-options-title">
                      Query {activeResult.ns}
                    </div>
                    <div className="canvas-options-row">
                      <span>tierLimit</span>
                      <span className="mono">{activeResult.options.tierLimit}</span>
                    </div>
                    <div className="canvas-options-row">
                      <span>limit</span>
                      <span className="mono">{activeResult.options.limit}</span>
                    </div>
                    <div className="canvas-options-row">
                      <span>recursion</span>
                      <span className="mono">{String(activeResult.options.recursion)}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-hint">Select a network from the left menu.</div>
            )}
          </div>
        </main>
      </div>

      {queryModal && (
        <DataModelModal
          dataModel={queryModal.dataModel}
          onQuery={handleQuery}
          onClose={() => setQueryModal(null)}
        />
      )}
      {dataNodeModal && (
        <DataNodeModal node={dataNodeModal} onClose={() => setDataNodeModal(null)} />
      )}
    </div>
  );
}
