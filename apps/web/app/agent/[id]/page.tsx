'use client';

import { useParams } from 'next/navigation';
import AgentDashboard from '../../../components/dashboard/AgentDashboard';

export default function AgentDossierPage() {
  const params = useParams();
  return (
    <AgentDashboard section="detail" selectedId={String(params.id)} />
  );
}
