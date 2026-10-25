import type { DataNodeDTO } from "@/api/contracts";

interface Props {
  node: DataNodeDTO;
  onClose: () => void;
}

/** Renders a query-result data node's fields. */
export function DataNodeModal({ node, onClose }: Props) {
  const entries = Object.entries(node.data ?? {});

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {node.$ns} <span className="muted">#{String(node.$id)}</span>
          </h2>
          <button className="btn-icon" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {node.$from && (
            <p className="modal-hint">
              from {node.$from.$ns} #{String(node.$from.$id)}
            </p>
          )}
          {entries.length === 0 ? (
            <p className="muted">No data</p>
          ) : (
            <table className="field-table">
              <tbody>
                {entries.map(([key, val]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td className="mono">{formatValue(val)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function formatValue(val: unknown): string {
  if (val === null) return "null";
  if (val === undefined) return "undefined";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}
