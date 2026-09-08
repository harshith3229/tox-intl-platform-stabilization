import { DocumentDetail } from '@/components/DocumentDetail';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ user?: string }>;
};

export default async function DocumentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { user } = await searchParams;
  return <DocumentDetail documentId={id} initialUser={user === 'bob' ? 'bob' : 'alice'} />;
}
