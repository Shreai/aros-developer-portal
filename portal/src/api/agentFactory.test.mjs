/**
 * agentFactory.test.mjs
 *
 * Unit tests for the API client. All network calls are intercepted via
 * an injected fetchImpl — no real HTTP requests are made.
 *
 * Run from aros-developer-portal/:
 *   npx vitest run portal/src/api/agentFactory.test.mjs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createAgentFactoryClient } from './agentFactory.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeMockFetch(status, body) {
  return async (_url, _opts) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
}

function makeCapturingFetch(status = 200, body = {}) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

// ── client factory ────────────────────────────────────────────────────────────

describe('createAgentFactoryClient', () => {
  it('throws if no fetch implementation is available', () => {
    expect(() => createAgentFactoryClient({ fetchImpl: null })).toThrow(/No fetch implementation/);
  });

  it('strips a trailing slash from baseUrl', async () => {
    const mockFetch = makeCapturingFetch(200, []);
    const client = createAgentFactoryClient({
      baseUrl: 'http://localhost:8080/api/v1/',
      fetchImpl: mockFetch,
    });
    await client.listAgents();
    expect(mockFetch.calls[0].url).toBe('http://localhost:8080/api/v1/agents');
  });
});

// ── bearer token ──────────────────────────────────────────────────────────────

describe('Bearer-token support', () => {
  it('adds Authorization header when token is provided', async () => {
    const mockFetch = makeCapturingFetch(200, []);
    const client = createAgentFactoryClient({
      baseUrl: 'http://localhost:8080/api/v1',
      token: 'my-secret-token',
      fetchImpl: mockFetch,
    });
    await client.listAgents();
    expect(mockFetch.calls[0].opts.headers['Authorization']).toBe('Bearer my-secret-token');
  });

  it('omits Authorization header when no token is provided', async () => {
    const mockFetch = makeCapturingFetch(200, []);
    const client = createAgentFactoryClient({
      baseUrl: 'http://localhost:8080/api/v1',
      fetchImpl: mockFetch,
    });
    await client.listAgents();
    expect(mockFetch.calls[0].opts.headers['Authorization']).toBeUndefined();
  });
});

// ── agents ────────────────────────────────────────────────────────────────────

describe('Agents endpoints', () => {
  let client;
  let mockFetch;

  beforeEach(() => {
    mockFetch = makeCapturingFetch(200, []);
    client = createAgentFactoryClient({
      baseUrl: 'http://localhost:8080/api/v1',
      fetchImpl: mockFetch,
    });
  });

  it('listAgents — GET /agents', async () => {
    mockFetch = makeCapturingFetch(200, [{ id: '1', name: 'TestAgent' }]);
    const c = createAgentFactoryClient({
      baseUrl: 'http://localhost:8080/api/v1',
      fetchImpl: mockFetch,
    });
    const result = await c.listAgents();
    expect(mockFetch.calls[0].url).toBe('http://localhost:8080/api/v1/agents');
    expect(mockFetch.calls[0].opts.method).toBe('GET');
    expect(result).toEqual([{ id: '1', name: 'TestAgent' }]);
  });

  it('getAgent — GET /agents/:id', async () => {
    await client.getAgent('abc-123');
    expect(mockFetch.calls[0].url).toBe('http://localhost:8080/api/v1/agents/abc-123');
    expect(mockFetch.calls[0].opts.method).toBe('GET');
  });

  it('createAgent — POST /agents with body', async () => {
    const payload = { name: 'MyAgent', role: 'analyst', model: 'gpt-4o' };
    await client.createAgent(payload);
    expect(mockFetch.calls[0].opts.method).toBe('POST');
    expect(mockFetch.calls[0].url).toBe('http://localhost:8080/api/v1/agents');
    expect(JSON.parse(mockFetch.calls[0].opts.body)).toEqual(payload);
  });

  it('updateAgent — PATCH /agents/:id with body', async () => {
    await client.updateAgent('xyz', { name: 'Updated' });
    expect(mockFetch.calls[0].opts.method).toBe('PATCH');
    expect(mockFetch.calls[0].url).toContain('/agents/xyz');
  });

  it('runAgent — POST /agents/:id/run', async () => {
    await client.runAgent('xyz', { input: 'hello' });
    expect(mockFetch.calls[0].url).toBe('http://localhost:8080/api/v1/agents/xyz/run');
    expect(mockFetch.calls[0].opts.method).toBe('POST');
  });

  it('evaluateAgent — POST /agents/:id/evaluate', async () => {
    await client.evaluateAgent('xyz');
    expect(mockFetch.calls[0].url).toBe('http://localhost:8080/api/v1/agents/xyz/evaluate');
  });
});

// ── tools & skills ────────────────────────────────────────────────────────────

describe('Tools and Skills endpoints', () => {
  let client;
  let mockFetch;

  beforeEach(() => {
    mockFetch = makeCapturingFetch(200, []);
    client = createAgentFactoryClient({
      baseUrl: 'http://localhost:8080/api/v1',
      fetchImpl: mockFetch,
    });
  });

  it('listTools — GET /tools', async () => {
    await client.listTools();
    expect(mockFetch.calls[0].url).toBe('http://localhost:8080/api/v1/tools');
    expect(mockFetch.calls[0].opts.method).toBe('GET');
  });

  it('createTool — POST /tools', async () => {
    await client.createTool({ name: 'search', description: 'web search' });
    expect(mockFetch.calls[0].opts.method).toBe('POST');
  });

  it('listSkills — GET /skills', async () => {
    await client.listSkills();
    expect(mockFetch.calls[0].url).toBe('http://localhost:8080/api/v1/skills');
  });

  it('createSkill — POST /skills', async () => {
    await client.createSkill({ name: 'reasoning', version: '1' });
    expect(mockFetch.calls[0].opts.method).toBe('POST');
  });
});

// ── error handling ────────────────────────────────────────────────────────────

describe('Error handling', () => {
  it('throws an error with status on non-2xx response', async () => {
    const client = createAgentFactoryClient({
      baseUrl: 'http://localhost:8080/api/v1',
      fetchImpl: makeMockFetch(404, { detail: 'Not found' }),
    });
    await expect(client.getAgent('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('throws an error on 500 server error', async () => {
    const client = createAgentFactoryClient({
      baseUrl: 'http://localhost:8080/api/v1',
      fetchImpl: makeMockFetch(500, { detail: 'Internal Server Error' }),
    });
    await expect(client.listAgents()).rejects.toThrow('Agent Factory API error 500');
  });

  it('propagates network errors (backend unreachable)', async () => {
    const client = createAgentFactoryClient({
      baseUrl: 'http://localhost:8080/api/v1',
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    await expect(client.listAgents()).rejects.toThrow('ECONNREFUSED');
  });

  it('handles non-JSON response bodies gracefully', async () => {
    const client = createAgentFactoryClient({
      baseUrl: 'http://localhost:8080/api/v1',
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable (plain text)',
      }),
    });
    await expect(client.listAgents()).rejects.toMatchObject({ status: 503 });
  });
});

// ── audit logs ───────────────────────────────────────────────────────────────

describe('Audit logs endpoint', () => {
  it('listAuditLogs — GET /audit-logs', async () => {
    const mockFetch = makeCapturingFetch(200, []);
    const client = createAgentFactoryClient({
      baseUrl: 'http://localhost:8080/api/v1',
      fetchImpl: mockFetch,
    });
    await client.listAuditLogs();
    expect(mockFetch.calls[0].url).toBe('http://localhost:8080/api/v1/audit-logs');
  });
});
