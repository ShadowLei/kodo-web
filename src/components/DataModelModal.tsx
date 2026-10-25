import { useState } from "react";
import type { DataModelDTO, KodoFieldType, QueryExpressionDTO } from "@/api/contracts";

interface Props {
  dataModel: DataModelDTO;
  onQuery: (expression: QueryExpressionDTO) => void;
  onClose: () => void;
}

const OPERATORS = [
  "==",
  "===",
  "!=",
  "!==",
  ">",
  ">=",
  "<",
  "<=",
  "IN",
  "!IN",
  "IS NULL",
  "IS NOT NULL",
] as const;

type FieldInput = { op: string; val: string };

function coerce(type: KodoFieldType, s: string): unknown {
  if (type === "number") {
    const n = Number(s);
    return Number.isNaN(n) ? s : n;
  }
  if (type === "boolean") {
    return s === "true" || s === "1";
  }
  return s;
}

function parseValue(type: KodoFieldType, op: string, raw: string): unknown {
  if (op === "IN" || op === "!IN") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map((s) => coerce(type, s));
  }
  return coerce(type, raw);
}

function mapOp(op: string): string {
  if (op === "IS NULL") return "==";
  if (op === "IS NOT NULL") return "!=";
  return op;
}

export function DataModelModal({ dataModel, onQuery, onClose }: Props) {
  const initial = Object.fromEntries(
    dataModel.fields.map((f) => [f.name, { op: "==", val: "" } as FieldInput]),
  );
  const [inputs, setInputs] = useState<Record<string, FieldInput>>(initial);

  const setField = (name: string, patch: Partial<FieldInput>) => {
    setInputs((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  };

  const isNullOp = (op: string) => op === "IS NULL" || op === "IS NOT NULL";

  const handleQuery = () => {
    const expression: QueryExpressionDTO = {};
    dataModel.fields.forEach((f) => {
      const { op, val } = inputs[f.name] ?? { op: "==", val: "" };
      if (val.trim() === "" && !isNullOp(op)) return;
      expression[f.name] = { $op: mapOp(op), $val: parseValue(f.type, op, val) };
    });
    onQuery(expression);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Query {dataModel.name}</h2>
          <button className="btn-icon" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-hint">
            Fill any field below, then query the network.
          </p>
          <table className="field-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Operator</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {dataModel.fields.map((f) => {
                const cur = inputs[f.name] ?? { op: "==", val: "" };
                const isNull = isNullOp(cur.op);
                return (
                  <tr key={f.name}>
                    <td>{f.name}</td>
                    <td className="muted">{f.type}</td>
                    <td>
                      <select
                        value={cur.op}
                        onChange={(e) => setField(f.name, { op: e.target.value })}
                      >
                        {OPERATORS.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={cur.val}
                        disabled={isNull}
                        placeholder={f.type === "number" ? "123" : "value"}
                        onChange={(e) => setField(f.name, { val: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleQuery}>
            Query
          </button>
        </div>
      </div>
    </div>
  );
}
