'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AuthGate from '../AuthGate';
import { ApiError, apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { DashboardShell, dashStyles as styles, type SidebarDossier } from './DashboardShell';
import { DossierDetailView, type DossierDetailData } from './DossierDetailView';
import { DossierListView, matchesDossierQuery } from './DossierViews';
import { PageError, PageLoading, PageStateBlock } from './PageState';
import { ProfileView } from './ProfileView';
import { PronosticPanel } from './PronosticPanel';

export type HierarchieBase = 'conformite' | 'direction';
export type HierarchieSection = 'list' | 'detail' | 'profile';

type Action = {
  toEtat: string;
  label: string;
  tone: 'primary' | 'secondary' | 'danger';
  commentaireRequis?: boolean;
};

/** Actions possibles selon le rôle et l'état (les règles métier sont vérifiées par l'API). */
function actionsPour(role: string, etat: string): { actions: Action[]; aide: string } {
  if (etat === 'CONFORMITE' && (role === 'CONFORMITE' || role === 'ADMIN')) {
    return {
      aide: 'Contrôlez la conformité réglementaire du dossier, puis transmettez-le à la direction.',
      actions: [
        { toEtat: 'DIRECTION', label: 'Transmettre à la direction', tone: 'primary' },
        { toEtat: 'RETOUR_ANALYSTE', label: 'Retour à l’analyste', tone: 'secondary', commentaireRequis: true },
        { toEtat: 'REJETE', label: 'Rejeter', tone: 'danger', commentaireRequis: true },
      ],
    };
  }
  if (etat === 'DIRECTION' && (role === 'DG' || role === 'ADMIN')) {
    return {
      aide: 'Saisissez d’abord le PV du comité (onglet Fiches › PV comité). Au-delà du seuil défini dans les paramètres, le dossier doit passer au Conseil d’administration.',
      actions: [
        { toEtat: 'A_DECAISSER', label: 'Approuvé — à décaisser', tone: 'primary' },
        { toEtat: 'CONSEIL', label: 'Transmettre au Conseil (APPRO PCA)', tone: 'secondary' },
        { toEtat: 'REJETE', label: 'Rejeter', tone: 'danger' },
      ],
    };
  }
  if (etat === 'CONSEIL' && (role === 'CA' || role === 'ADMIN')) {
    return {
      aide: 'Saisissez la décision du Conseil dans le mémo (onglet Fiches › Mémo PCA).',
      actions: [
        { toEtat: 'A_DECAISSER', label: 'Approuvé — à décaisser', tone: 'primary' },
        { toEtat: 'REJETE', label: 'Rejeter', tone: 'danger' },
      ],
    };
  }
  if (etat === 'A_DECAISSER') {
    return {
      aide: 'Crédit approuvé : imprimez les documents (onglet Fiches › Documents) et faites-les signer.',
      actions: [],
    };
  }
  return { aide: 'Aucune action attendue de votre part à cette étape.', actions: [] };
}

const TONE_CLASS: Record<Action['tone'], string> = {
  primary: styles.btnPrimary,
  secondary: styles.btnSecondary,
  danger: styles.btnDanger,
};

function HierarchieDetail({ id, onDone }: { id: string; onDone: () => void }) {
  const { user } = useAuth();
  const [data, setData] = useState<(DossierDetailData & { etat: string }) | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    apiFetch<DossierDetailData>(`/instruction/dossiers/${id}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Erreur');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function transition(a: Action) {
    if (a.commentaireRequis && !comment.trim()) {
      setError('Indiquez un commentaire pour cette action');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/workflow/dossiers/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ toEtat: a.toEtat, comment: comment.trim() || undefined }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Transition impossible');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <PageStateBlock>
        <PageError title="Impossible de charger le dossier" message={error} />
      </PageStateBlock>
    );
  }
  if (!data || !user) {
    return (
      <PageStateBlock>
        <PageLoading title="Chargement du dossier" detail="Analyse, fiches et décisions…" />
      </PageStateBlock>
    );
  }

  const { actions, aide } = actionsPour(user.role, data.etat);
  return (
    <div>
      <PronosticPanel dossierId={data.id} />
      <div className={styles.assignPanel}>
        <h2 className={styles.assignTitle}>Décision</h2>
        <p className={styles.assignHint}>{aide}</p>
        {actions.length ? (
          <>
            <label className={styles.assignMeta} htmlFor="hierarchie-commentaire">
              Commentaire (obligatoire pour un retour ou un rejet)
            </label>
            <textarea
              id="hierarchie-commentaire"
              className={styles.assignTextarea}
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={busy}
            />
            <div className={styles.assignRow} style={{ marginTop: 12 }}>
              {actions.map((a) => (
                <button
                  key={a.toEtat}
                  type="button"
                  className={`${styles.btn} ${TONE_CLASS[a.tone]}`}
                  disabled={busy}
                  onClick={() => void transition(a)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {error ? <p className={styles.listError}>{error}</p> : null}
      </div>
      <DossierDetailView data={data} canManageDocs={false} pendingActions={[]} />
    </div>
  );
}

function HierarchieWorkspace({
  base,
  section,
  selectedId,
}: {
  base: HierarchieBase;
  section: HierarchieSection;
  selectedId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SidebarDossier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<SidebarDossier[]>('/instruction/dossiers')
      .then((d) => {
        if (!cancelled) {
          setRows(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Erreur de chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const filtered = useMemo(() => rows.filter((d) => matchesDossierQuery(d, search)), [rows, search]);

  return (
    <DashboardShell base={base}>
      {section === 'list' ? (
        <DossierListView
          title={base === 'conformite' ? 'Dossiers en conformité' : 'Dossiers — direction et conseil'}
          dossiers={filtered}
          search={search}
          onSearchChange={setSearch}
          onSelect={(id) => router.push(`/${base}/${id}`)}
          loading={loading}
          error={error}
          lastColumn="agent"
        />
      ) : null}
      {section === 'detail' && selectedId ? (
        <HierarchieDetail
          id={selectedId}
          onDone={() => {
            setVersion((v) => v + 1);
            router.push(`/${base}`);
          }}
        />
      ) : null}
      {section === 'profile' ? <ProfileView /> : null}
    </DashboardShell>
  );
}

export default function HierarchieDashboard({
  base,
  section = 'list',
  selectedId,
}: {
  base: HierarchieBase;
  section?: HierarchieSection;
  selectedId?: string;
}) {
  const roles = base === 'conformite' ? ['CONFORMITE', 'ADMIN'] : ['DG', 'CA', 'ADMIN'];
  return (
    <AuthGate roles={roles} hideSession>
      <HierarchieWorkspace base={base} section={section} selectedId={selectedId} />
    </AuthGate>
  );
}
