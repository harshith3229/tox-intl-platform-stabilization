export type DemoUser = 'alice' | 'bob';

export type DocumentItem = {
  _id: string;
  organisationId: string;
  uploadedBy: string;
  fileName: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  attempt: number;
  result?: {
    invoiceNumber?: string;
    supplier?: string;
    total?: number;
    currency?: string;
    date?: string;
    summary?: string;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, user: DemoUser, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-demo-user': user,
      ...init?.headers
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export const api = {
  listDocuments: (user: DemoUser) =>
    request<{ items: DocumentItem[] }>('/api/documents', user),
  getDocument: (id: string, user: DemoUser) =>
    request<{ item: DocumentItem }>(`/api/documents/${id}`, user),
  uploadDocument: (fileName: string, content: string, user: DemoUser) =>
    request<{ item: DocumentItem }>('/api/documents', user, {
      method: 'POST',
      body: JSON.stringify({ fileName, content })
    }),
  retryDocument: (id: string, user: DemoUser) =>
    request<{ item: DocumentItem }>(`/api/documents/${id}/retry`, user, {
      method: 'POST'
    })
};
