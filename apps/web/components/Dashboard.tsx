'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, type DemoUser, type DocumentItem } from '@/lib/api';
import { hasActiveDocuments, POLL_INTERVAL_MS } from '@/lib/polling';
import { StatusBadge } from './StatusBadge';
import { UserSelector } from './UserSelector';

export function Dashboard() {
  const [user, setUser] = useState<DemoUser>('alice');
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [file, setFile] = useState<File>();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const response = await api.listDocuments(user);
      setItems(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load documents');
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    api.listDocuments(user)
      .then((response) => {
        if (!cancelled) setItems(response.items);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load documents');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Keep the list fresh while any job is still queued/processing -- without
  // this, a job that finishes server-side never appears as finished until
  // the user re-uploads or manually navigates (Issue B1, see BUG_MAP.md).
  useEffect(() => {
    if (!hasActiveDocuments(items)) return;
    const intervalId = setInterval(() => {
      load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [items, load]);

  async function upload() {
    if (!file) return;
    try {
      setIsUploading(true);
      setError('');
      const content = await file.text();
      await api.uploadDocument(file.name, content, user);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="pageShell">
      <div className="pageHeading">
        <div>
          <p className="eyebrow">Operations dashboard</p>
          <h1>Document processing jobs</h1>
          <p>Upload a synthetic invoice and review its extraction status.</p>
        </div>
        <UserSelector value={user} onChange={setUser} />
      </div>

      <div className="uploadPanel">
        <div>
          <h2>New document</h2>
          <p>Use one of the supplied files from the samples folder.</p>
        </div>
        <input
          aria-label="Choose document"
          type="file"
          accept=".txt,text/plain"
          onChange={(event) => setFile(event.target.files?.[0])}
        />
        <button type="button" onClick={upload}>
          {isUploading ? 'Uploading...' : 'Upload and process'}
        </button>
      </div>

      {error && <p className="errorBanner">{error}</p>}

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Status</th>
              <th>Attempt</th>
              <th>Updated</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id}>
                <td>{item.fileName}</td>
                <td><StatusBadge status={item.status} /></td>
                <td>{item.attempt}</td>
                <td>{new Date(item.updatedAt).toLocaleTimeString()}</td>
                <td><Link href={`/documents/${item._id}?user=${user}`}>Open</Link></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="emptyState">No documents for this organisation.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
