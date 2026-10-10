'use client';

import { useParams } from 'next/navigation';
import ResponsableCreditDashboard from '../../../components/dashboard/ResponsableCreditDashboard';

export default function ResponsableCreditDetailPage() {
  const params = useParams();
  return (
    <ResponsableCreditDashboard
      section="detail"
      selectedId={String(params.id)}
    />
  );
}
