'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DOSSIER_ETAT_LABELS,
  formatMontantSouhaite,
  montantSouhaiteFromPayload,
  type DossierEtat,
  type ProduitCreditDto,
} from '@imf/shared';
import { ApiError, apiFetch } from '../../lib/api';
import { dashStyles, etatBadgeClass } from '../dashboard/DashboardShell';
import { DossierSearchField } from '../dashboard/DossierViewsCore';
import { PageError, PageLoading } from '../dashboard/PageState';
import styles from './reception.module.css';

export type ReceptionRow = {
  id: string;
  reference: string;
  type?: string;
  produit?: ProduitCreditDto | null;
  etat: DossierEtat;
  updatedAt: string;
  payload?: Record<string, unknown> | null;
  client: { fullName: string; phone: string };
};

/** Même libellés que l’application mobile pour les anciens dossiers sans produit. */
const TYPE_LABELS: Record<string, string> = {
  DARE_DARE: 'Crédit Dare-Dare',
  INDIVIDUEL: 'Crédit Individuel',
  SALAIRE: 'Crédit Salaire',
  AGR: 'Crédit AGR',
};

export function produitLabelOf(row: Pick<ReceptionRow, 'produit' | 'type'>) {
  return row.produit?.label || TYPE_LABELS[row.type || ''] || row.type || '—';
}

export function formatDateCourte(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Recherche serveur (référence, nom, téléphone, produit) — dossiers créés par l’utilisateur. */
export function useReceptionDossiers(q: string) {
  const [rows, setRows] = useState<ReceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const term = q.trim();
    apiFetch<ReceptionRow[]>(`/dossiers${term ? `?q=${encodeURIComponent(term)}` : ''}`)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Recherche impossible');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, reload]);

  return { rows, loading, error, refresh: () => setReload((k) => k + 1) };
}

export function ReceptionDossierTable({
  rows,
  loading,
  error,
  onRetry,
}: {
  rows: ReceptionRow[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  const router = useRouter();
  return (
    <section>
      <div className={styles.listHead}>
        <h2>Dossiers</h2>
        <span className={styles.count}>
          {loading ? '…' : `${rows.length} résultat${rows.length === 1 ? '' : 's'}`}
        </span>
      </div>
      {error ? (
        <PageError title="Impossible de charger la liste" message={error} onRetry={onRetry} compact />
      ) : null}
      {loading && rows.length === 0 ? (
        <PageLoading title="Chargement" detail="Récupération des dossiers…" compact />
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <div className={dashStyles.emptyState}>
          <div>
            <h2>Aucun dossier</h2>
            <p>Les demandes que vous enregistrez apparaîtront ici.</p>
          </div>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div className={dashStyles.tableWrap}>
          <table className={dashStyles.table}>
            <thead>
              <tr>
                <th>Mise à jour</th>
                <th>Client</th>
                <th>Montant souhaité</th>
                <th>Type de crédit</th>
                <th>État</th>
                <th>Référence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const { montantSouhaite, devise } = montantSouhaiteFromPayload(
                  d.payload as Record<string, any> | null | undefined,
                );
                return (
                  <tr key={d.id} onClick={() => router.push(`/reception/${d.id}`)}>
                    <td className={styles.dateCell}>{formatDateCourte(d.updatedAt)}</td>
                    <td>
                      <strong>{d.client.fullName}</strong>
                    </td>
                    <td>
                      <strong>{formatMontantSouhaite(montantSouhaite, devise)}</strong>
                    </td>
                    <td>{produitLabelOf(d)}</td>
                    <td>
                      <span className={etatBadgeClass(d.etat)}>
                        {DOSSIER_ETAT_LABELS[d.etat] || d.etat}
                      </span>
                    </td>
                    <td>{d.reference}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/** Accueil : salutation + recherche + liste (écran d’accueil mobile). */
export function ReceptionAccueil({ prenom }: { prenom: string }) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const list = useReceptionDossiers(q);

  return (
    <div>
      <header className={dashStyles.boardHero}>
        <p className={dashStyles.boardHeroEyebrow}>Réception</p>
        <h1 className={dashStyles.boardHeroTitle}>Bonjour{prenom ? `, ${prenom}` : ''}</h1>
        <p className={dashStyles.boardHeroText}>
          Enregistrez les demandes de crédit : elles sont transmises au responsable crédit.
        </p>
        <DossierSearchField value={search} onChange={setSearch} onSubmit={() => setQ(search)} />
      </header>
      <ReceptionDossierTable rows={list.rows} loading={list.loading} error={list.error} onRetry={list.refresh} />
    </div>
  );
}

/** Onglet « Dossiers ». */
export function ReceptionDossiersPage() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const list = useReceptionDossiers(q);
  return (
    <div>
      <h1 className={dashStyles.pageTitle}>Dossiers</h1>
      <div className={dashStyles.toolbar}>
        <DossierSearchField value={search} onChange={setSearch} onSubmit={() => setQ(search)} />
      </div>
      <ReceptionDossierTable rows={list.rows} loading={list.loading} error={list.error} onRetry={list.refresh} />
    </div>
  );
}
