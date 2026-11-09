'use client';

import { Suspense } from 'react';
import AuthGate from '../AuthGate';
import { AgentsChargeView } from '../dashboard/AgentsChargeView';
import { DashboardShell } from '../dashboard/DashboardShell';
import { ProfileView } from '../dashboard/ProfileView';
import { DossierWorkspace } from './DossierWorkspace';
import { FileTravail } from './FileTravail';
import { RechercheManuels } from './Manuels';
import { TableauDeBord } from './TableauDeBord';

export type PosteBase = 'responsable-credit' | 'analyste' | 'conformite' | 'direction';
export type PosteSection = 'dashboard' | 'file' | 'detail' | 'manuels' | 'agents' | 'profile';

const ROLES: Record<PosteBase, string[]> = {
  'responsable-credit': ['RESPONSABLE_CREDIT', 'ADMIN'],
  analyste: ['ANALYSTE', 'ADMIN'],
  conformite: ['CONFORMITE', 'ADMIN'],
  direction: ['DG', 'DGA', 'CA', 'ADMIN'],
};

const TITRES: Record<PosteBase, string> = {
  'responsable-credit': 'File du responsable crédit',
  analyste: 'File d’analyse',
  conformite: 'File de conformité',
  direction: 'Dossiers à décider',
};

/** Poste de décision commun aux rôles du circuit (RC, analyste, conformité, direction / CA). */
export default function PosteDashboard({
  base,
  section,
  selectedId,
}: {
  base: PosteBase;
  section: PosteSection;
  selectedId?: string;
}) {
  return (
    <AuthGate roles={ROLES[base]} hideSession>
      <DashboardShell base={base}>
        {section === 'dashboard' ? <TableauDeBord base={base} /> : null}
        {section === 'file' ? (
          <Suspense fallback={null}>
            <FileTravail base={base} titre={TITRES[base]} />
          </Suspense>
        ) : null}
        {section === 'detail' && selectedId ? <DossierWorkspace id={selectedId} base={base} /> : null}
        {section === 'manuels' ? <RechercheManuels /> : null}
        {section === 'agents' ? <AgentsChargeView /> : null}
        {section === 'profile' ? <ProfileView /> : null}
      </DashboardShell>
    </AuthGate>
  );
}
