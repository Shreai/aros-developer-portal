/**
 * useAgentFactory.js
 *
 * React hook that provides a single configured agent-factory client
 * for all authoring views. Reads the base URL from the Vite env var
 * VITE_AGENT_FACTORY_URL (defaulting to http://localhost:8080/api/v1).
 *
 * The token is read from sessionStorage key "af_token" so the user can
 * paste their developer token once per session without it persisting across
 * browser sessions.
 */

import { useState, useCallback } from 'react';
import { createAgentFactoryClient } from '../api/agentFactory.js';

// Stable singleton client — recreated only when token changes
let _client = null;
let _lastToken = undefined;

function getClient(token) {
  if (_client && _lastToken === token) return _client;
  _lastToken = token;
  _client = createAgentFactoryClient({
    // VITE_ vars are inlined at build time; fall back gracefully
    baseUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGENT_FACTORY_URL)
      || 'http://localhost:8080/api/v1',
    token,
    fetchImpl: fetch,
  });
  return _client;
}

/**
 * @returns {{ client, token, setToken }}
 */
export function useAgentFactory() {
  const [token, setTokenState] = useState(() => {
    try {
      return sessionStorage.getItem('af_token') || '';
    } catch {
      return '';
    }
  });

  const setToken = useCallback((t) => {
    try { sessionStorage.setItem('af_token', t); } catch {}
    setTokenState(t);
    _client = null; // force re-creation
  }, []);

  const client = getClient(token);
  return { client, token, setToken };
}
