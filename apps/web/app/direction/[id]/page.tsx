'use client';

import { useParams } from 'next/navigation';
import HierarchieDashboard from '../../../components/dashboard/HierarchieDashboard';

export default function Page() {
  const params = useParams();
  return <HierarchieDashboard base="direction" section="detail" selectedId={String(params.id)} />;
}
