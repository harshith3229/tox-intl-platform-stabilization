import type { DocumentItem } from '@/lib/api';

export function StatusBadge({ status }: { status: DocumentItem['status'] }) {
  return <span className={`status status-${status}`}>{status}</span>;
}
