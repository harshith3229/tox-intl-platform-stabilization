import type { DocumentItem } from './api';

/**
 * How often the dashboard/detail views re-fetch while a job is still in
 * flight. Keeps the UI reasonably fresh without a websocket/SSE channel,
 * which is out of scope for this fix (see BUG_MAP.md, Issue B1).
 */
export const POLL_INTERVAL_MS = 3_000;

const ACTIVE_STATUSES: ReadonlySet<DocumentItem['status']> = new Set(['queued', 'processing']);

export function isActiveStatus(status: DocumentItem['status']): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function hasActiveDocuments(items: ReadonlyArray<Pick<DocumentItem, 'status'>>): boolean {
  return items.some((item) => isActiveStatus(item.status));
}
