'use client';

import { useParams } from 'next/navigation';
import AdminDashboard from '../../../../components/dashboard/AdminDashboard';

export default function AdminDossierDetailPage() {
  const params = useParams();
  return (
    <AdminDashboard
      section="dossier-detail"
      dossierId={String(params.id)}
    />
  );
}
