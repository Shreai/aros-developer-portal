/**
 * AgentsSection.jsx
 *
 * Agent authoring UI: list, create, edit, run, and evaluate agents.
 * Uses hash-based sub-routing (/agents, /agents/new, /agents/:id).
 * All state is React useState — no router library needed.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAgentFactory } from './useAgentFactory.js';

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="af-spinner-wrap">
      <div className="af-spinner" />
    </div>
  );
}

function BackendUnavailable({ error, onRetry }) {
  return (
    <div className="af-unavailable">
      <div className="af-unavailable-icon">⚠</div>
      <h3>Agent Factory backend unavailable</h3>
      <p>
        The backend at{' '}
        <code>
          {(typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGENT_FACTORY_URL) ||
            'http://localhost:8080/api/v1'}
        </code>{' '}
        could not be reached.
      </p>
      {error && <pre className="af-error-detail">{error}</pre>}
      <p className="af-unavailable-hint">
        Set <code>VITE_AGENT_FACTORY_URL</code> and rebuild, or ensure the backend is running.
      </p>
      <button className="btn btn-outline" onClick={onRetry} style={{ marginTop: 16 }}>
        Retry
      </button>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="af-error-banner">
      <span>{message}</span>
      {onDismiss && (
        <button className="af-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

function JsonResult({ data }) {
  return <pre className="af-json-result">{JSON.stringify(data, null, 2)}</pre>;
}

// ── Token settings panel ───────────────────────────────────────────────────────

function TokenPanel({ token, setToken }) {
  const [draft, setDraft] = useState(token);
  const [saved, setSaved] = useState(false);
  return (
    <div className="af-token-panel">
      <label htmlFor="af-token" className="af-label">
        Developer API Token (stored in sessionStorage, never committed)
      </label>
      <div className="af-token-row">
        <input
          id="af-token"
          type="password"
          className="af-input af-token-input"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          placeholder="Bearer token (optional)"
          autoComplete="off"
        />
        <button
          className="btn btn-primary"
          style={{ marginLeft: 8 }}
          onClick={() => {
            setToken(draft);
            setSaved(true);
          }}
        >
          Save
        </button>
      </div>
      {saved && <span className="af-saved-hint">Token saved for this session.</span>}
    </div>
  );
}

// ── KNOWN MODELS (free-text fallback if no endpoint available) ────────────────

const KNOWN_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'claude-3-haiku',
  'qwen3:14b',
  'qwen3:30b',
  'mistral-7b',
  'llama-3.1-70b',
  'custom',
];

// ── Agent Form (create + edit) ────────────────────────────────────────────────

const EMPTY_FORM = { name: '', role: '', description: '', model: 'gpt-4o', tools: [], skills: [] };

function AgentForm({
  initial,
  availableTools,
  availableSkills,
  onSubmit,
  onCancel,
  loading,
  error,
}) {
  const [form, setForm] = useState(initial || EMPTY_FORM);

  function field(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function toggleList(key, val) {
    setForm((f) => {
      const arr = f[key] || [];
      return {
        ...f,
        [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val],
      };
    });
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
  }

  return (
    <form className="af-form" onSubmit={submit}>
      <ErrorBanner message={error} />

      <div className="af-field">
        <label className="af-label" htmlFor="af-name">
          Agent name *
        </label>
        <input
          id="af-name"
          className="af-input"
          value={form.name}
          onChange={field('name')}
          placeholder="e.g. Sales Analyst"
          required
          disabled={loading}
        />
      </div>

      <div className="af-field">
        <label className="af-label" htmlFor="af-role">
          Role
        </label>
        <input
          id="af-role"
          className="af-input"
          value={form.role}
          onChange={field('role')}
          placeholder="e.g. analyst, researcher, coder"
          disabled={loading}
        />
      </div>

      <div className="af-field">
        <label className="af-label" htmlFor="af-description">
          Description
        </label>
        <textarea
          id="af-description"
          className="af-input af-textarea"
          value={form.description}
          onChange={field('description')}
          placeholder="What does this agent do?"
          rows={3}
          disabled={loading}
        />
      </div>

      <div className="af-field">
        <label className="af-label" htmlFor="af-model">
          Model
        </label>
        <select
          id="af-model"
          className="af-input af-select"
          value={form.model}
          onChange={field('model')}
          disabled={loading}
        >
          {KNOWN_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {availableTools.length > 0 && (
        <div className="af-field">
          <label className="af-label">Tools</label>
          <div className="af-checklist">
            {availableTools.map((t) => {
              const id = t.id || t.name || String(t);
              const label = t.name || id;
              return (
                <label key={id} className="af-check-item">
                  <input
                    type="checkbox"
                    checked={(form.tools || []).includes(id)}
                    onChange={() => toggleList('tools', id)}
                    disabled={loading}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {availableSkills.length > 0 && (
        <div className="af-field">
          <label className="af-label">Skills</label>
          <div className="af-checklist">
            {availableSkills.map((s) => {
              const id = s.id || s.name || String(s);
              const label = s.name || id;
              return (
                <label key={id} className="af-check-item">
                  <input
                    type="checkbox"
                    checked={(form.skills || []).includes(id)}
                    onChange={() => toggleList('skills', id)}
                    disabled={loading}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="af-form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading || !form.name.trim()}>
          {loading ? 'Saving…' : initial ? 'Update agent' : 'Create agent'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Run / Evaluate panel ──────────────────────────────────────────────────────

function RunPanel({ agentId, client }) {
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function run() {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const res = await client.runAgent(agentId, input ? { input } : {});
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="af-run-panel">
      <h4 className="af-panel-title">Run agent</h4>
      <div className="af-field">
        <label className="af-label" htmlFor="af-run-input">
          Input (optional)
        </label>
        <textarea
          id="af-run-input"
          className="af-input af-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter input text for the agent…"
          rows={3}
          disabled={running}
        />
      </div>
      <button className="btn btn-primary" onClick={run} disabled={running}>
        {running ? 'Running…' : 'Run'}
      </button>
      {error && <ErrorBanner message={error} />}
      {result !== null && <JsonResult data={result} />}
    </div>
  );
}

function EvalPanel({ agentId, client }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function evaluate() {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const res = await client.evaluateAgent(agentId);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="af-run-panel">
      <h4 className="af-panel-title">Evaluate agent</h4>
      <p className="af-panel-hint">
        Runs the backend evaluation pipeline and returns a score report.
      </p>
      <button className="btn btn-outline" onClick={evaluate} disabled={running}>
        {running ? 'Evaluating…' : 'Evaluate'}
      </button>
      {error && <ErrorBanner message={error} />}
      {result !== null && <JsonResult data={result} />}
    </div>
  );
}

// ── Agent Detail view ─────────────────────────────────────────────────────────

function AgentDetail({ agentId, availableTools, availableSkills, client, onBack, onUpdated }) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activePanel, setActivePanel] = useState(null); // 'run' | 'eval' | null

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await client.getAgent(agentId);
      setAgent(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [agentId, client]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdate(form) {
    setSaving(true);
    setSaveError('');
    try {
      const updated = await client.updateAgent(agentId, form);
      setAgent(updated);
      setEditing(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <BackendUnavailable error={error} onRetry={load} />;
  if (!agent) return null;

  return (
    <div>
      <div className="af-detail-header">
        <button className="af-back-btn" onClick={onBack}>
          ← Agents
        </button>
        <h3 className="af-detail-title">{agent.name}</h3>
        <div className="af-detail-meta">
          {agent.role && <span className="af-badge">{agent.role}</span>}
          {agent.model && <code className="af-model-tag">{agent.model}</code>}
        </div>
      </div>

      {!editing ? (
        <div className="af-detail-body">
          {agent.description && <p className="af-detail-desc">{agent.description}</p>}

          <div className="af-detail-section">
            <div className="af-detail-row">
              <span className="af-detail-key">ID</span>
              <code className="af-detail-val">{agent.id || agentId}</code>
            </div>
            {agent.tools?.length > 0 && (
              <div className="af-detail-row">
                <span className="af-detail-key">Tools</span>
                <span className="af-detail-val">{agent.tools.join(', ')}</span>
              </div>
            )}
            {agent.skills?.length > 0 && (
              <div className="af-detail-row">
                <span className="af-detail-key">Skills</span>
                <span className="af-detail-val">{agent.skills.join(', ')}</span>
              </div>
            )}
          </div>

          <div className="af-detail-actions">
            <button className="btn btn-outline" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className={`btn ${activePanel === 'run' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActivePanel(activePanel === 'run' ? null : 'run')}
            >
              Run
            </button>
            <button
              className={`btn ${activePanel === 'eval' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActivePanel(activePanel === 'eval' ? null : 'eval')}
            >
              Evaluate
            </button>
          </div>

          {activePanel === 'run' && <RunPanel agentId={agentId} client={client} />}
          {activePanel === 'eval' && <EvalPanel agentId={agentId} client={client} />}
        </div>
      ) : (
        <AgentForm
          initial={{
            name: agent.name || '',
            role: agent.role || '',
            description: agent.description || '',
            model: agent.model || 'gpt-4o',
            tools: agent.tools || [],
            skills: agent.skills || [],
          }}
          availableTools={availableTools}
          availableSkills={availableSkills}
          onSubmit={handleUpdate}
          onCancel={() => {
            setEditing(false);
            setSaveError('');
          }}
          loading={saving}
          error={saveError}
        />
      )}
    </div>
  );
}

// ── Agent List view ───────────────────────────────────────────────────────────

function AgentList({ agents, onSelect, onCreate }) {
  if (agents.length === 0) {
    return (
      <div className="af-empty">
        <p>No agents yet. Create one to get started.</p>
        <button className="btn btn-primary" onClick={onCreate} style={{ marginTop: 16 }}>
          Create agent
        </button>
      </div>
    );
  }
  return (
    <div className="af-list">
      {agents.map((a) => {
        const id = a.id || a.name;
        return (
          <div
            key={id}
            className="af-list-item"
            onClick={() => onSelect(id)}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(id)}
          >
            <div className="af-list-item-name">{a.name}</div>
            <div className="af-list-item-meta">
              {a.role && <span className="af-badge">{a.role}</span>}
              {a.model && <code className="af-model-tag">{a.model}</code>}
              {a.description && (
                <span className="af-list-item-desc">
                  {a.description.slice(0, 80)}
                  {a.description.length > 80 ? '…' : ''}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main AgentsSection ────────────────────────────────────────────────────────

export default function AgentsSection() {
  const { client, token, setToken } = useAgentFactory();

  const [view, setView] = useState('list'); // 'list' | 'new' | 'detail'
  const [selectedId, setSelectedId] = useState(null);

  const [agents, setAgents] = useState([]);
  const [tools, setTools] = useState([]);
  const [skills, setSkills] = useState([]);

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [showToken, setShowToken] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    setLoadError('');
    try {
      const [agentsData, toolsData, skillsData] = await Promise.allSettled([
        client.listAgents(),
        client.listTools(),
        client.listSkills(),
      ]);

      // Agents are the primary resource — if they fail, show unavailable
      if (agentsData.status === 'rejected') {
        const err = agentsData.reason;
        const msg = err.message || String(err);
        if (
          msg.includes('ECONNREFUSED') ||
          msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('Failed to fetch')
        ) {
          setUnavailable(true);
        } else {
          setLoadError(msg);
        }
        setAgents([]);
      } else {
        setAgents(Array.isArray(agentsData.value) ? agentsData.value : []);
      }

      // Tools and skills are supplemental — degrade gracefully
      setTools(
        toolsData.status === 'fulfilled' && Array.isArray(toolsData.value) ? toolsData.value : [],
      );
      setSkills(
        skillsData.status === 'fulfilled' && Array.isArray(skillsData.value)
          ? skillsData.value
          : [],
      );
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreate(form) {
    setCreating(true);
    setCreateError('');
    try {
      await client.createAgent(form);
      await loadAll();
      setView('list');
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function handleSelect(id) {
    setSelectedId(id);
    setView('detail');
  }

  function goList() {
    setView('list');
    setSelectedId(null);
  }

  return (
    <section id="agent-factory" className="section">
      <div className="container">
        {/* Header row */}
        <div className="af-header-row">
          <div>
            <h2>Agent Factory</h2>
            <p className="subtitle">Author, run, and evaluate AI agents.</p>
          </div>
          <div className="af-header-controls">
            <button
              className="btn btn-outline af-token-toggle"
              onClick={() => setShowToken((v) => !v)}
              title="Configure API token"
            >
              {showToken ? 'Hide token' : 'API token'}
            </button>
            {view === 'list' && (
              <button className="btn btn-primary" onClick={() => setView('new')}>
                + New agent
              </button>
            )}
          </div>
        </div>

        {/* Token panel */}
        {showToken && <TokenPanel token={token} setToken={setToken} />}

        {/* Content */}
        {loading ? (
          <Spinner />
        ) : unavailable ? (
          <BackendUnavailable onRetry={loadAll} />
        ) : view === 'list' ? (
          <>
            {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError('')} />}
            <AgentList agents={agents} onSelect={handleSelect} onCreate={() => setView('new')} />
          </>
        ) : view === 'new' ? (
          <div>
            <button className="af-back-btn" onClick={goList}>
              ← Agents
            </button>
            <h3 style={{ marginBottom: 24 }}>Create new agent</h3>
            <AgentForm
              initial={EMPTY_FORM}
              availableTools={tools}
              availableSkills={skills}
              onSubmit={handleCreate}
              onCancel={goList}
              loading={creating}
              error={createError}
            />
          </div>
        ) : view === 'detail' && selectedId ? (
          <AgentDetail
            agentId={selectedId}
            availableTools={tools}
            availableSkills={skills}
            client={client}
            onBack={goList}
            onUpdated={() => loadAll()}
          />
        ) : null}
      </div>
    </section>
  );
}
