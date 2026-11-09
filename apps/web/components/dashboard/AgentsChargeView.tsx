'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
      <p className={styles.assignHint}>
        Charge et dossiers en cours par agent (toutes zones).
      </p>

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
        <div className={styles.agentsList}>
          {agents.map((a) => {
            const open = expanded === a.id;
            return (
              <div key={a.id} className={styles.agentCard}>
                <button
                  type="button"
                  className={styles.agentCardHeader}
                  onClick={() => setExpanded(open ? null : a.id)}
                >
                  <div>
                    <strong>{a.displayName}</strong>
                    <p className={styles.assignMeta}>
                      {a.zone?.name || 'Sans zone'} · {a.email}
                    </p>
                  </div>
                  <div className={styles.agentCardMeta}>
                    <span className={statutClass(a.statut)}>
                      {statutLabel(a.statut)}
                    </span>
                    <span className={styles.agentCharge}>
                      {a.dossiersEnCours} dossier
                      {a.dossiersEnCours > 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
                {open ? (
                  <div className={styles.agentCardBody}>
                    {(a.dossiers || []).length === 0 ? (
                      <p className={styles.itemMeta}>Aucun dossier en charge.</p>
                    ) : (
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
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
                                onClick={() =>
                                  router.push(`/responsable-credit/${d.id}`)
                                }
                              >
                                <td>
                                  <strong>{d.reference}</strong>
                                </td>
                                <td>{d.client.fullName}</td>
                                <td>{d.produitLabel || d.type}</td>
                                <td>
                                  <span className={styles.badge}>
                                    {d.etatLabel}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

