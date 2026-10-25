import type { NetworkSummaryDTO } from "@/api/contracts";

interface Props {
  networks: NetworkSummaryDTO[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

/** Left menu: each item is a relationship network (a LinkNode list). */
export function SideMenu({ networks, activeId, onSelect }: Props) {
  return (
    <aside className="side-menu">
      <div className="side-menu-title">Networks</div>
      <ul>
        {networks.map((n) => (
          <li
            key={n.id}
            className={n.id === activeId ? "active" : ""}
            onClick={() => onSelect(n.id)}
          >
            {n.name}
          </li>
        ))}
      </ul>
    </aside>
  );
}
