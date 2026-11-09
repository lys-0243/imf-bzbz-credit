'use client';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiFetch } from '../../lib/api';
import { dashStyles as styles } from './DashboardShell';

type AgentDossier = {
  id: string;
  reference: string;
  type: string;
  produitLabel: string;
  etat: string;
  etatLabel: string;
  client: {
    fullName: string;
    commune?: { name: string } | null;
    zone?: { name: string } | null;
  };
  montantSouhaite?: number | null;
  devise?: string | null;
};

type AgentOption = {
  id: string;
  displayName: string;
  email: string;
  zone: { id: string; code: string; name: string } | null;
  statut?: 'disponible' | 'occupe' | 'a_valider';
  dossiersEnCours: number;
  dossiersActifs?: number;
  dossiersAValider?: number;
  dossiers?: AgentDossier[];
};

function statutLabel(statut: AgentOption['statut']) {
  if (statut === 'a_valider') return 'Dossier(s) à valider';
  if (statut === 'occupe') return 'Occupé';
  return 'Disponible';
}

function statutClass(statut: AgentOption['statut']) {
  if (statut === 'a_valider') return `${styles.badge} ${styles.badgeWarn}`;
  if (statut === 'occupe') return styles.badgeOk;
  return styles.badge;
}

export function AgentsChargeView() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<AgentOption[]>('/affectation/agents');
        if (!cancelled) {
          setAgents(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Erreur de chargement');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className={styles.pageTitle}>Agents</h1>
      <p className={styles.assignHint}>Charge et dossiers en cours par agent (toutes zones).</p>

      {error ? <p className={styles.listError}>{error}</p> : null}
      {loading ? <p className={styles.itemMeta}>Chargement…</p> : null}

      {!loading && !error && agents.length === 0 ? (
        <div className={styles.emptyState}>
          <div>
            <h2>Aucun agent</h2>
            <p>Aucun agent actif pour le moment.</p>
          </div>
        </div>
      ) : null}

      {!loading && agents.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Zone</th>
                <th>E-mail</th>
                <th>Statut</th>
                <th>Dossiers</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const open = expanded === a.id;
                return (
                  <Fragment key={a.id}>
                    <tr
                      className={open ? styles.trActive : undefined}
                      onClick={() => setExpanded(open ? null : a.id)}
                    >
                      <td>
                        <strong>{a.displayName}</strong>
                      </td>
                      <td>{a.zone?.name || 'Sans zone'}</td>
                      <td>{a.email}</td>
                      <td>
                        <span className={statutClass(a.statut)}>{statutLabel(a.statut)}</span>
                      </td>
                      <td>
                        {a.dossiersEnCours} dossier{a.dossiersEnCours > 1 ? 's' : ''}
                      </td>
                    </tr>
                    {open ? (
                      <tr className={styles.agentDetailRow}>
                        <td colSpan={5}>
                          {(a.dossiers || []).length === 0 ? (
                            <p className={styles.itemMeta}>Aucun dossier en charge.</p>
                          ) : (
                            <table className={styles.agentNestedTable}>
                              <thead>
                                <tr>
                                  <th>Référence</th>
                                  <th>Client</th>
                                  <th>Produit</th>
                                  <th>État</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(a.dossiers || []).map((d) => (
                                  <tr
                                    key={d.id}
                                    onClick={() => router.push(`/responsable-credit/${d.id}`)}
                                  >
                                    <td>
                                      <strong>{d.reference}</strong>
                                    </td>
                                    <td>{d.client.fullName}</td>
                                    <td>{d.produitLabel || d.type}</td>
                                    <td>
                                      <span className={styles.badge}>{d.etatLabel}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
