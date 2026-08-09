/**
 * agentFactory.js
 *
 * API client for the shre-agent-factory FastAPI backend.
 *
 * Usage:
 *   import { createAgentFactoryClient } from './api/agentFactory.js';
 *   const client = createAgentFactoryClient({ baseUrl, token });
 *
 * The baseUrl defaults to the VITE_AGENT_FACTORY_URL env var (Vite injects
 * at build time) or falls back to http://localhost:8080/api/v1.
 *
 * Both baseUrl and fetchImpl are injectable for testability — pass a mock
 * fetch function to avoid any network calls in tests.
 */

const DEFAULT_BASE_URL = (() => {
  // import.meta.env is available in Vite builds but not in Node/vitest node env
  try {
    return (
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGENT_FACTORY_URL) ||
      'http://localhost:8080/api/v1'
    );
  } catch {
    return 'http://localhost:8080/api/v1';
  }
})();

/**
 * Create an agent-factory API client.
 *
 * @param {object} opts
 * @param {string}   [opts.baseUrl]   - Backend base URL (no trailing slash)
 * @param {string}   [opts.token]     - Bearer token for Authorization header
 * @param {Function} [opts.fetchImpl] - Fetch implementation (default: global.fetch)
 */
export function createAgentFactoryClient({
  baseUrl = DEFAULT_BASE_URL,
  token = '',
  fetchImpl = typeof fetch !== 'undefined' ? fetch : null,
} = {}) {
  if (!fetchImpl) {
    throw new Error(
      'No fetch implementation available. Pass fetchImpl to createAgentFactoryClient.',
    );
  }

  const base = baseUrl.replace(/\/$/, '');

  function headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  async function request(method, path, body) {
    const url = `${base}${path}`;
    const opts = {
      method,
      headers: headers(),
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetchImpl(url, opts);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) {
      const err = new Error(
        `Agent Factory API error ${res.status}: ${typeof data === 'object' ? JSON.stringify(data) : data}`,
      );
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    // ── Agents ─────────────────────────────────────────────────
    /** List all agents */
    listAgents: () => request('GET', '/agents'),
    /** Get a single agent by id */
    getAgent: (id) => request('GET', `/agents/${id}`),
    /** Create a new agent */
    createAgent: (payload) => request('POST', '/agents', payload),
    /** Update an existing agent */
    updateAgent: (id, payload) => request('PATCH', `/agents/${id}`, payload),
    /** Run an agent */
    runAgent: (id, payload = {}) => request('POST', `/agents/${id}/run`, payload),
    /** Evaluate an agent */
    evaluateAgent: (id, payload = {}) => request('POST', `/agents/${id}/evaluate`, payload),

    // ── Tools ───────────────────────────────────────────────────
    /** List all tools */
    listTools: () => request('GET', '/tools'),
    /** Create a tool */
    createTool: (payload) => request('POST', '/tools', payload),
    /** Update a tool */
    updateTool: (id, payload) => request('PATCH', `/tools/${id}`, payload),

    // ── Skills ──────────────────────────────────────────────────
    /** List all skills */
    listSkills: () => request('GET', '/skills'),
    /** Create a skill */
    createSkill: (payload) => request('POST', '/skills', payload),

    // ── Requirements ────────────────────────────────────────────
    /** Post requirements */
    createRequirement: (payload) => request('POST', '/requirements', payload),
    /** Analyze gap for a requirement */
    analyzeGap: (id, payload = {}) => request('POST', `/requirements/${id}/analyze-gap`, payload),

    // ── Audit Logs ──────────────────────────────────────────────
    /** Get audit logs */
    listAuditLogs: () => request('GET', '/audit-logs'),
  };
}

export const DEFAULT_AGENT_FACTORY_URL = DEFAULT_BASE_URL;
