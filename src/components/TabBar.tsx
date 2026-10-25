export interface Tab {
  id: string;
  title: string;
  kind: "schema" | "data";
  closable: boolean;
}

interface Props {
  tabs: Tab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function TabBar({ tabs, activeId, onSelect, onClose }: Props) {
  return (
    <div className="tab-bar">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab ${t.id === activeId ? "active" : ""}`}
          onClick={() => onSelect(t.id)}
        >
          <span className={t.kind === "data" ? "tab-dot data" : "tab-dot schema"} />
          <span className="tab-title">{t.title}</span>
          {t.closable && (
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.id);
              }}
              title="Close tab"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
