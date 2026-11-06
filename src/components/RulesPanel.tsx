import { useEffect, useMemo, useState } from "react";

import {
  defaultRuleJson,
  parseRule,
  ruleStatus,
  type StoredRule,
} from "@/rules/ruleUtils";

interface Props {
  rules: StoredRule[];
  onAdd: (raw: string) => void;
  onUpdate: (key: string, raw: string) => void;
  onRemove: (key: string) => void;
}

interface EditorState {
  key?: string;
}

const STATUS_LABEL = {
  error: "JSON error — this rule is skipped",
  inactive: "Inactive rule",
  active: "Active rule",
} as const;

export function RulesPanel({ rules, onAdd, onUpdate, onRemove }: Props) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorText, setEditorText] = useState("");
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);

  const openAdd = () => {
    setEditor({});
    setEditorText(defaultRuleJson());
    setConfirmingKey(null);
  };

  const openEdit = (rule: StoredRule) => {
    setEditor({ key: rule.key });
    setEditorText(rule.raw);
    setConfirmingKey(null);
  };

  const closeEditor = () => setEditor(null);

  const saveEditor = () => {
    if (!editor) return;
    if (editor.key) onUpdate(editor.key, editorText);
    else onAdd(editorText);
    setEditor(null);
  };

  useEffect(() => {
    if (!editor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditor(null);
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        saveEditor();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editor, editorText]);

  const parsedEditor = useMemo(() => parseRule(editorText), [editorText]);

  return (
    <>
      <section className="rules-panel" aria-label="Notification rules">
        <div className="rules-header">
          <div className="rules-title">
            Rules
            <span className="rules-count">{rules.length}</span>
          </div>
          <button
            className="rules-add"
            onClick={openAdd}
            title="Add a rule"
            aria-label="Add a rule"
          >
            +
          </button>
        </div>

        <div className="rules-list">
          {rules.length === 0 ? (
            <div className="rules-empty">
              No rules yet. Use <strong>+</strong> to add one.
            </div>
          ) : (
            rules.map((rule, index) => {
              const parsed = parseRule(rule.raw);
              const status = ruleStatus(parsed);
              const id = parsed.id || `Rule #${index + 1}`;
              const description =
                parsed.description ||
                (parsed.valid ? "(no description)" : "Invalid JSON");
              const title = `${id}: ${description}`;
              const confirming = confirmingKey === rule.key;

              return (
                <div key={rule.key} className={`rule-row ${status}`}>
                  <span
                    className={`rule-state-dot ${status}`}
                    title={STATUS_LABEL[status]}
                  />
                  {confirming ? (
                    <div className="rule-confirm">
                      <span>Delete this rule?</span>
                      <button
                        className="rule-confirm-cancel"
                        onClick={() => setConfirmingKey(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="rule-confirm-delete"
                        onClick={() => {
                          onRemove(rule.key);
                          setConfirmingKey(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="rule-main">
                        <div className="rule-title" title={title}>
                          {title}
                        </div>
                        {status === "error" && (
                          <div className="rule-error" title={parsed.error}>
                            {parsed.error}
                          </div>
                        )}
                      </div>
                      <div className="rule-actions">
                        <button
                          className="rule-action"
                          onClick={() => openEdit(rule)}
                          title="Edit rule"
                          aria-label={`Edit rule ${id}`}
                        >
                          ✎
                        </button>
                        <button
                          className="rule-action danger"
                          onClick={() => setConfirmingKey(rule.key)}
                          title="Delete rule"
                          aria-label={`Delete rule ${id}`}
                        >
                          🗑
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {editor && (
        <div className="modal-backdrop" onClick={closeEditor}>
          <div
            className="modal-panel rule-editor-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{editor.key ? "Edit rule" : "Add rule"}</h2>
              <button className="btn-icon" onClick={closeEditor} title="Close">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-hint">
                Edit the kodo-core rule JSON. Rules run automatically on every
                query and are written to the WebConsole through the{" "}
                <code>web-console</code> channel. Point <code>$ns</code> at the
                namespace you want to check (for example <code>Payment</code>).
              </p>
              <textarea
                className={`rule-json-editor ${parsedEditor.valid ? "" : "invalid"}`}
                value={editorText}
                onChange={(event) => setEditorText(event.target.value)}
                spellCheck={false}
                autoFocus
                aria-label="Rule JSON"
              />
              {parsedEditor.valid ? (
                <div className="rule-json-status ok">
                  Valid rule
                  {parsedEditor.id ? ` · ${parsedEditor.id}` : ""}
                </div>
              ) : (
                <div className="rule-json-status error">
                  {parsedEditor.error}
                  <span className="rule-json-note">
                    It will still be saved and shown in red, but skipped by
                    checks.
                  </span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={closeEditor}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveEditor}>
                {editor.key ? "Save rule" : "Add rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
