import { useState } from "react";

import type { DataModelDTO } from "@/api/contracts";
import {
  clearDeepSeekKey,
  generateRule,
  readDeepSeekKey,
  saveDeepSeekKey,
} from "@/api/deepseek";
import { parseRule } from "@/rules/ruleUtils";

interface Props {
  prompt: string;
  onPromptChange: (value: string) => void;
  currentRule: string;
  dataModels?: readonly DataModelDTO[];
  onGenerated: (raw: string) => void;
}

/**
 * The DeepSeek section inside the rule editor: one shared API key, a natural
 * language prompt, and a Generate button that writes the rule JSON into the
 * same editor the Custom mode uses.
 */
export function DeepSeekAssist({
  prompt,
  onPromptChange,
  currentRule,
  dataModels,
  onGenerated,
}: Props) {
  const [savedKey, setSavedKey] = useState<string | null>(() => readDeepSeekKey());
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const storeKey = () => {
    const key = keyDraft.trim();
    if (!key) return;
    try {
      saveDeepSeekKey(key);
      setSavedKey(key);
      setEditingKey(false);
      setKeyDraft("");
      setError(null);
    } catch {
      setError("Could not save the API key in this browser's local storage.");
    }
  };

  const deleteKey = () => {
    try {
      clearDeepSeekKey();
      setSavedKey(null);
      setEditingKey(false);
      setKeyDraft("");
      setError(null);
      setInfo(null);
    } catch {
      setError("Could not remove the API key from this browser's local storage.");
    }
  };

  const handleGenerate = async () => {
    if (editingKey) {
      setError("Click OK to save the edited API key before generating.");
      return;
    }
    if (!savedKey) {
      setError("Save your DeepSeek API key before generating.");
      return;
    }
    if (!prompt.trim()) {
      setError("Describe the query condition before generating.");
      return;
    }

    setGenerating(true);
    setError(null);
    setInfo(null);
    try {
      const raw = await generateRule({
        apiKey: savedKey,
        prompt,
        dataModels,
        currentRule,
      });
      onGenerated(raw);
      const parsed = parseRule(raw);
      if (parsed.valid) {
        setInfo("Generated a valid rule. Review the JSON below, then save.");
      } else {
        setError(`Generated JSON is not a valid rule: ${parsed.error}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="deepseek-assist" aria-label="DeepSeek rule assistant">
      <div className="deepseek-field">
        <div className="deepseek-label-row">
          <span className="deepseek-label">DeepSeek API key</span>
          <span className="deepseek-badge">shared by all rules</span>
        </div>
        {savedKey && !editingKey ? (
          <div className="deepseek-key-saved">
            <span
              className="deepseek-key-mask"
              aria-label="DeepSeek API key saved"
              title="Saved in this browser"
            >
              {"•".repeat(18)}
            </span>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                setEditingKey(true);
                setKeyDraft(savedKey);
                setError(null);
              }}
            >
              Edit
            </button>
            <button type="button" className="btn btn-small danger" onClick={deleteKey}>
              Delete
            </button>
          </div>
        ) : (
          <div className="deepseek-key-input">
            <input
              type="password"
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  storeKey();
                }
              }}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
              aria-label="DeepSeek API key"
            />
            <button
              type="button"
              className="btn btn-small"
              onClick={storeKey}
              disabled={!keyDraft.trim()}
            >
              OK
            </button>
            {editingKey && (
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  setEditingKey(false);
                  setKeyDraft("");
                  setError(null);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        )}
        <p className="deepseek-hint">
          Kept in this browser only and sent only to api.deepseek.com.
        </p>
      </div>

      <div className="deepseek-field">
        <label className="deepseek-label" htmlFor="deepseek-prompt">
          Describe the query condition
        </label>
        <textarea
          id="deepseek-prompt"
          className="deepseek-prompt"
          value={prompt}
          onChange={(event) => {
            onPromptChange(event.target.value);
            if (error) setError(null);
            if (info) setInfo(null);
          }}
          placeholder='e.g. "All Payment nodes with amount at least 1000 and status paid or pending"'
          rows={3}
          spellCheck={false}
          autoFocus
        />
      </div>

      <div className="deepseek-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? "Generating…" : "Generate"}
        </button>
        <span className="deepseek-hint">
          query-guide.md is sent as a stable prefix, so DeepSeek can cache it
          between calls.
        </span>
      </div>

      {error && (
        <div className="deepseek-status error" role="alert">
          {error}
        </div>
      )}
      {info && (
        <div className="deepseek-status ok" role="status">
          {info}
        </div>
      )}
    </section>
  );
}
