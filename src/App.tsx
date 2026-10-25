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

export default function App() {
  const server = useMemo(() => createKodoServer(), []);

  const [networks, setNetworks] = useState<NetworkSummaryDTO[]>([]);
  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(null);

  const [networkCache, setNetworkCache] = useState<Map<string, NetworkDTO>>(new Map());
  const [dataNodesByTab, setDataNodesByTab] = useState<Map<string, DataNodeDTO[]>>(new Map());

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const [options, setOptions] = useState<KodoOptionsDTO>({ tierLimit: 0, limit: 10 });
  const [queryModal, setQueryModal] = useState<QueryModalState | null>(null);
  const [dataNodeModal, setDataNodeModal] = useState<DataNodeDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dataTabCounter = useRef(0);

  const selectNetwork = useCallback(
    async (id: string) => {
      setActiveNetworkId(id);
      try {
        const net = await server.getNetwork(id);
        setNetworkCache((prev) => new Map(prev).set(id, net));
        const tabId = `schema:${id}`;
        setTabs((prev) =>
          prev.some((t) => t.id === tabId)
            ? prev
            : [...prev, { id: tabId, title: net.name, kind: "schema", closable: false }],
        );
        setActiveTabId(tabId);
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
        setDataNodesByTab((prev) => new Map(prev).set(tabId, res.nodes));
        setTabs((prev) => [
          ...prev,
          { id: tabId, title: `${queryModal.ns} · ${res.nodes.length}`, kind: "data", closable: true },
        ]);
        setActiveTabId(tabId);
        setQueryModal(null);
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    },
    [server, queryModal, options],
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          setActiveTabId(next[Math.max(0, idx - 1)]?.id ?? null);
        }
        return next;
      });
      setDataNodesByTab((prev) => {
        const m = new Map(prev);
        m.delete(id);
        return m;
      });
    },
    [activeTabId],
  );

  const activeGraph = useMemo(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return null;
    if (tab.kind === "schema") {
      const networkId = tab.id.slice("schema:".length);
      const net = networkCache.get(networkId);
      return net ? buildSchemaGraph(net) : null;
    }
    return buildDataGraph(dataNodesByTab.get(tab.id) ?? []);
  }, [tabs, activeTabId, networkCache, dataNodesByTab]);

  return (
    <div className="app">
      <TopBar options={options} onChange={setOptions} />
      <div className="app-body">
        <SideMenu networks={networks} activeId={activeNetworkId} onSelect={selectNetwork} />
        <main className="content">
          <TabBar
            tabs={tabs}
            activeId={activeTabId}
            onSelect={setActiveTabId}
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
              <NetworkCanvas graph={activeGraph} onNodeClick={handleNodeClick} />
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

