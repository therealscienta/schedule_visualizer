import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../utils/api';
import type { ApiToken, ServerProject } from '../types';

const EXPIRY_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'Never' },
];

// What creating a token returns: the listing, plus the token, which is never shown again
type CreatedToken = ApiToken & { token: string };

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const cardClass = 'bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6';

export function ApiTokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [projects, setProjects] = useState<ServerProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'write'>('read');
  const [projectId, setProjectId] = useState('');
  const [expiry, setExpiry] = useState('90');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [tokenList, projectList] = await Promise.all([
        apiFetch<ApiToken[]>('/tokens'),
        apiFetch<ServerProject[]>('/projects'),
      ]);
      setTokens(tokenList);
      setProjects(projectList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your tokens');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setIsSubmitting(true);
    try {
      const result = await apiFetch<CreatedToken>('/tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          scope,
          projectId: projectId || null,
          expiresInDays: expiry === 'never' ? null : Number(expiry),
        }),
      });
      setCreated(result);
      setCopied(false);
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the token');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (token: ApiToken): Promise<void> => {
    if (!confirm(`Revoke "${token.name}"? Anything using it will stop working.`)) return;
    setError('');
    try {
      await apiFetch(`/tokens/${token.id}`, { method: 'DELETE' });
      setTokens((current) => current.filter((t) => t.id !== token.id));
      setCreated((current) => (current?.id === token.id ? null : current));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not revoke the token');
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
    } catch {
      // No clipboard access here; the token is selectable in the box above the button
    }
  };

  const origin = window.location.origin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">API tokens</h1>
          <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Back to App
          </Link>
        </div>

        {error && (
          <div role="alert" className="mb-6 p-3 text-sm rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {created && (
          <div role="status" className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700">
            <p className="font-medium text-green-800 dark:text-green-300">
              Token “{created.name}” created. Copy it now, it won’t be shown again.
            </p>
            <div className="flex gap-2 mt-3">
              <code
                data-testid="new-token"
                className="flex-1 px-3 py-2 text-sm font-mono break-all select-all bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded-lg text-gray-900 dark:text-gray-100"
              >
                {created.token}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">Try it:</p>
            <pre className="mt-1 p-3 text-xs overflow-x-auto bg-gray-900 text-gray-100 rounded-lg">
              {`curl -H "Authorization: Bearer ${created.token}" ${origin}/api/v1/me`}
            </pre>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="mt-3 text-sm text-green-800 dark:text-green-300 hover:underline"
            >
              Done
            </button>
          </div>
        )}

        <form onSubmit={handleCreate} className={`${cardClass} p-6`}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Create a token</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="token-name" className={labelClass}>Name</label>
              <input
                id="token-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="What will use it, e.g. Nightly deploy"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="token-scope" className={labelClass}>Access</label>
              <select
                id="token-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as 'read' | 'write')}
                className={inputClass}
              >
                <option value="read">Read only</option>
                <option value="write">Read and write</option>
              </select>
            </div>
            <div>
              <label htmlFor="token-project" className={labelClass}>Projects</label>
              <select
                id="token-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={inputClass}
              >
                <option value="">All my projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.role === 'owner' ? project.name : `${project.name} (${project.role})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="token-expiry" className={labelClass}>Expires after</label>
              <select
                id="token-expiry"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className={inputClass}
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create token
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            A token acts as you, with the access you have to projects and schedules. Read-only tokens can’t change anything.
          </p>
        </form>

        <div className={`${cardClass} overflow-hidden`}>
          {isLoading ? (
            <p className="p-6 text-center text-gray-500 dark:text-gray-400">Loading...</p>
          ) : tokens.length === 0 ? (
            <p className="p-6 text-center text-gray-500 dark:text-gray-400">No tokens yet.</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {tokens.map((token) => (
                <li key={token.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-2 font-medium text-gray-900 dark:text-gray-100">
                      <span className="break-words">{token.name}</span>
                      <span className="font-mono text-xs font-normal text-gray-500 dark:text-gray-400">{token.prefix}…</span>
                      {token.expired && (
                        <span className="px-2 py-0.5 text-xs font-normal rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          Expired
                        </span>
                      )}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <span>{token.scope === 'write' ? 'Read and write' : 'Read only'}</span>
                      <span>{token.projectName ?? 'All projects'}</span>
                      <span>
                        Last used <span>{token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'Never'}</span>
                      </span>
                      <span>
                        Expires <span>{token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : 'Never'}</span>
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(token)}
                    aria-label={`Revoke ${token.name}`}
                    className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${cardClass} p-6`}>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Using a token</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Send it as a bearer token to <code className="font-mono">/api/v1</code>. Scripts can list and change schedules,
            keep a project’s schedules in sync with a file, and ask when schedules run and overlap.
          </p>
          <pre className="mt-3 p-3 text-xs overflow-x-auto bg-gray-900 text-gray-100 rounded-lg">
            {`curl -H "Authorization: Bearer YOUR_TOKEN" ${origin}/api/v1/schedules`}
          </pre>
          <p className="mt-3 text-sm">
            <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
              OpenAPI description
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
