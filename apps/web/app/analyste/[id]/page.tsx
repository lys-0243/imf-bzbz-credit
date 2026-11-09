'use client';

import { useParams } from 'next/navigation';
import PosteDashboard from '../../../components/poste/PosteDashboard';

export default function Page() {
  const params = useParams();
  return <PosteDashboard base="analyste" section="detail" selectedId={String(params.id)} />;
}
