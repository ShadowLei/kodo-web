import type { KodoOptionsDTO } from "@/api/contracts";

interface Props {
  options: KodoOptionsDTO;
  onChange: (options: KodoOptionsDTO) => void;
}

/** Top bar with the kodo KodoOption inputs (tierLimit / limit). */
export function TopBar({ options, onChange }: Props) {
  const setNum = (key: "tierLimit" | "limit", raw: string) => {
    const n = parseInt(raw, 10);
    onChange({ ...options, [key]: Number.isNaN(n) ? 0 : n });
  };

  return (
    <header className="top-bar">
      <div className="brand">
        <span className="brand-mark">K</span>
        <span className="brand-name">Kodo Web</span>
      </div>

      <div className="top-options">
        <label className="option">
          <span>tierLimit</span>
          <input
            type="number"
            min={0}
            value={options.tierLimit}
            onChange={(e) => setNum("tierLimit", e.target.value)}
            title="Maximum number of relationship tiers to explore (0 = unlimited)"
          />
        </label>
        <label className="option">
          <span>limit</span>
          <input
            type="number"
            min={1}
            value={options.limit}
            onChange={(e) => setNum("limit", e.target.value)}
            title="Forced result limit per query"
          />
        </label>
      </div>
    </header>
  );
}
