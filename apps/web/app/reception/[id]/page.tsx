'use client';

import { useParams } from 'next/navigation';
import ReceptionDashboard from '../../../components/reception/ReceptionDashboard';

export default function Page() {
  const params = useParams();
  return <ReceptionDashboard section="detail" selectedId={String(params.id)} />;
}
