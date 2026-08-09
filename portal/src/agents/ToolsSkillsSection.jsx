/**
 * ToolsSkillsSection.jsx
 *
 * Combined list + add view for Tools and Skills, backed by the
 * agent-factory backend endpoints GET/POST /tools and GET/POST /skills.
 * Degrades gracefully when the backend is unreachable.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAgentFactory } from './useAgentFactory.js';

// ── Shared helpers (local, not exported — no cross-file coupling) ─────────────

function Spinner() {
  return (
    <div className="af-spinner-wrap">
      <div className="af-spinner" />
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

function BackendUnavailable({ onRetry }) {
  return (
    <div className="af-unavailable">
      <div className="af-unavailable-icon">⚠</div>
      <h3>Agent Factory backend unavailable</h3>
      <p>Tools and Skills cannot be loaded while the backend is unreachable.</p>
      <button className="btn btn-outline" onClick={onRetry} style={{ marginTop: 16 }}>
        Retry
      </button>
    </div>
  );
}

// ── Generic "Item" card ───────────────────────────────────────────────────────

function ItemCard({ item }) {
  const name = item.name || item.id || 'Unnamed';
  const description = item.description || item.desc || '';
  const version = item.version || '';
  return (
    <div className="af-item-card">
      <div className="af-item-name">{name}</div>
      {version && (
        <span className="af-badge" style={{ marginBottom: 6 }}>
          v{version}
        </span>
      )}
      {description && <p className="af-item-desc">{description}</p>}
      <div className="af-item-meta">
        {Object.entries(item)
          .filter(([k]) => !['name', 'description', 'desc', 'id', 'version'].includes(k))
          .slice(0, 3)
          .map(([k, v]) => (
            <span key={k} className="af-item-field">
              <strong>{k}:</strong> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </span>
          ))}
      </div>
    </div>
  );
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddForm({ label, fields, onSubmit, onCancel, loading, error }) {
  const init = Object.fromEntries(fields.map((f) => [f.key, f.default || '']));
  const [form, setForm] = useState(init);

  function field(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function submit(e) {
    e.preventDefault();
    const required = fields.find((f) => f.required && !form[f.key]?.trim());
    if (required) return;
    onSubmit(form);
  }

  return (
    <form className="af-form af-add-form" onSubmit={submit}>
      <ErrorBanner message={error} />
      {fields.map((f) => (
        <div key={f.key} className="af-field">
          <label className="af-label" htmlFor={`af-add-${f.key}`}>
            {f.label}
            {f.required ? ' *' : ''}
          </label>
          {f.type === 'textarea' ? (
            <textarea
              id={`af-add-${f.key}`}
              className="af-input af-textarea"
              value={form[f.key]}
              onChange={field(f.key)}
              placeholder={f.placeholder || ''}
              rows={3}
              disabled={loading}
            />
          ) : (
            <input
              id={`af-add-${f.key}`}
              className="af-input"
              value={form[f.key]}
              onChange={field(f.key)}
              placeholder={f.placeholder || ''}
              required={f.required}
              disabled={loading}
            />
          )}
        </div>
      ))}
      <div className="af-form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Adding…' : `Add ${label}`}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const TOOL_FIELDS = [
  { key: 'name', label: 'Tool name', required: true, placeholder: 'e.g. web_search' },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'What this tool does',
  },
  { key: 'endpoint', label: 'Endpoint URL', placeholder: 'https://...' },
];

const SKILL_FIELDS = [
  { key: 'name', label: 'Skill name', required: true, placeholder: 'e.g. reasoning' },
  { key: 'version', label: 'Version', placeholder: '1.0.0' },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'What this skill provides',
  },
];

// ── Tab panel ─────────────────────────────────────────────────────────────────

function TabPanel({ type, items, fields, onCreate, loading, saving, saveError }) {
  const [adding, setAdding] = useState(false);

  function handleSubmit(form) {
    onCreate(form, () => setAdding(false));
  }

  return (
    <div>
      <div className="af-tab-header">
        <span className="af-tab-count">
          {items.length} {type}
          {items.length !== 1 ? 's' : ''}
        </span>
        {!adding && (
          <button className="btn btn-outline" onClick={() => setAdding(true)}>
            + Add {type}
          </button>
        )}
      </div>

      {adding && (
        <AddForm
          label={type}
          fields={fields}
          onSubmit={handleSubmit}
          onCancel={() => setAdding(false)}
          loading={saving}
          error={saveError}
        />
      )}

      {items.length === 0 && !adding ? (
        <div className="af-empty">
          <p>No {type}s yet. Add one above.</p>
        </div>
      ) : (
        <div className="af-item-grid">
          {items.map((item, i) => (
            <ItemCard key={item.id || item.name || i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ToolsSkillsSection() {
  const { client } = useAgentFactory();

  const [activeTab, setActiveTab] = useState('tools'); // 'tools' | 'skills'
  const [tools, setTools] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    setLoadError('');
    try {
      const [toolsRes, skillsRes] = await Promise.allSettled([
        client.listTools(),
        client.listSkills(),
      ]);

      const failed = toolsRes.status === 'rejected' && skillsRes.status === 'rejected';
      if (failed) {
        const msg = toolsRes.reason?.message || String(toolsRes.reason);
        if (
          msg.includes('ECONNREFUSED') ||
          msg.includes('fetch') ||
          msg.includes('Failed to fetch')
        ) {
          setUnavailable(true);
        } else {
          setLoadError(msg);
        }
      }

      setTools(
        toolsRes.status === 'fulfilled' && Array.isArray(toolsRes.value) ? toolsRes.value : [],
      );
      setSkills(
        skillsRes.status === 'fulfilled' && Array.isArray(skillsRes.value) ? skillsRes.value : [],
      );
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreateTool(form, done) {
    setSaving(true);
    setSaveError('');
    try {
      await client.createTool(form);
      await loadAll();
      done();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSkill(form, done) {
    setSaving(true);
    setSaveError('');
    try {
      await client.createSkill(form);
      await loadAll();
      done();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="tools-skills" className="section">
      <div className="container">
        <h2>Tools &amp; Skills</h2>
        <p className="subtitle">Manage reusable building blocks for your agents.</p>

        {loading ? (
          <Spinner />
        ) : unavailable ? (
          <BackendUnavailable onRetry={loadAll} />
        ) : (
          <>
            {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError('')} />}

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: 24 }}>
              <button
                className={`tab ${activeTab === 'tools' ? 'active' : ''}`}
                onClick={() => setActiveTab('tools')}
              >
                Tools ({tools.length})
              </button>
              <button
                className={`tab ${activeTab === 'skills' ? 'active' : ''}`}
                onClick={() => setActiveTab('skills')}
              >
                Skills ({skills.length})
              </button>
            </div>

            {activeTab === 'tools' && (
              <TabPanel
                type="tool"
                items={tools}
                fields={TOOL_FIELDS}
                onCreate={handleCreateTool}
                loading={loading}
                saving={saving}
                saveError={saveError}
              />
            )}

            {activeTab === 'skills' && (
              <TabPanel
                type="skill"
                items={skills}
                fields={SKILL_FIELDS}
                onCreate={handleCreateSkill}
                loading={loading}
                saving={saving}
                saveError={saveError}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
