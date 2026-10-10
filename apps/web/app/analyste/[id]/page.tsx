'use client';

import { useParams } from 'next/navigation';
import AnalysteDashboard from '../../../components/dashboard/AnalysteDashboard';

export default function AnalysteDetailPage() {
  const params = useParams();
  return (
    <AnalysteDashboard section="detail" selectedId={String(params.id)} />
  );
}
