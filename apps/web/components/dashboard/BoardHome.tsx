'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import {
  dashStyles as styles,
  etatBadgeClass,
  formatMontantDossier,
  type SidebarDossier,
} from './DashboardShell';
import { DossierSearchField, matchesDossierQuery } from './DossierViewsCore';

export type BoardStat = {
  key: string;
  label: string;
  value: number;
  href: string;
  tone?: 'default' | 'warn' | 'ok' | 'muted';
};

function statusMessage(
  name: string,
  counts: {
    nouveaux: number;
    enCours: number;
    retournes: number;
    termines: number;
  },
) {
  if (counts.retournes > 0) {
    return {
      title: `Bonjour${name ? `, ${name}` : ''}`,
      text: `Attention : ${counts.retournes} dossier${counts.retournes > 1 ? 's' : ''} renvoyé${counts.retournes > 1 ? 's' : ''} nécessitent votre action.`,
      tone: 'warn' as const,
    };
  }
  if (counts.nouveaux > 0) {
    return {
      title: `Bonjour${name ? `, ${name}` : ''}`,
      text: `Vous avez ${counts.nouveaux} nouveau${counts.nouveaux > 1 ? 'x' : ''} dossier${counts.nouveaux > 1 ? 's' : ''} attribué${counts.nouveaux > 1 ? 's' : ''}. Bonne journée de travail.`,
      tone: 'ok' as const,
    };
  }
  if (counts.enCours > 0) {
    return {
      title: `Bonjour${name ? `, ${name}` : ''}`,
      text: `${counts.enCours} dossier${counts.enCours > 1 ? 's' : ''} en cours. Continuez vos descentes et rapports.`,
      tone: 'default' as const,
    };
  }
  return {
    title: `Bonjour${name ? `, ${name}` : ''}`,
    text: 'Votre file est à jour. Aucun dossier en attente pour le moment.',
    tone: 'muted' as const,
  };
}

function cardClass(key: string) {
  switch (key) {
    case 'nouveaux':
      return styles.boardCardGreen;
    case 'en_cours':
      return styles.boardCardBlue;
    case 'retournes':
      return styles.boardCardRed;
    case 'termines':
      return styles.boardCardYellow;
    default:
      return styles.boardCardBlue;
  }
}

function CardIcon({ kind }: { kind: string }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
  } as const;
  switch (kind) {
    case 'nouveaux':
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'en_cours':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case 'retournes':
      return (
        <svg {...props}>
          <path d="M9 14l-4-4 4-4" />
          <path d="M5 10h11a4 4 0 010 8h-1" />
        </svg>
      );
    case 'termines':
      return (
        <svg {...props}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    default:
      return null;
  }
}

export function BoardHome({
  title = 'Tableau de bord',
  stats,
  recent,
  onSelectDossier,
}: {
  title?: string;
  stats: BoardStat[];
  recent: SidebarDossier[];
  onSelectDossier: (id: string) => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const counts = {
    nouveaux: stats.find((s) => s.key === 'nouveaux')?.value ?? 0,
    enCours: stats.find((s) => s.key === 'en_cours')?.value ?? 0,
    retournes: stats.find((s) => s.key === 'retournes')?.value ?? 0,
    termines: stats.find((s) => s.key === 'termines')?.value ?? 0,
  };
  const msg = statusMessage(user?.displayName?.split(/\s+/)[0] || '', counts);

  const filtered = useMemo(
    () => recent.filter((d) => matchesDossierQuery(d, appliedQuery)),
    [recent, appliedQuery],
  );

  return (
    <div style={{ margin: 50 }}>
      <header className={styles.boardHero}>
        <p className={styles.boardHeroEyebrow}>{title}</p>
        <h1 className={styles.boardHeroTitle}>{msg.title}</h1>
        <p className={styles.boardHeroText}>{msg.text}</p>
        <DossierSearchField
          value={search}
          onChange={setSearch}
          onSubmit={() => setAppliedQuery(search)}
          placeholder="Nom, référence, type de crédit…"
        />
      </header>

      <div className={styles.boardCards}>
        {stats.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`${styles.boardCard} ${cardClass(s.key)}`}
            onClick={() => router.push(s.href)}
          >
            <div className={styles.boardCardTop}>
              <span className={styles.boardCardLabel}>{s.label}</span>
              <span className={styles.boardCardIcon} aria-hidden>
                <CardIcon kind={s.key} />
              </span>
            </div>
            <span className={styles.boardCardValue}>{s.value}</span>
            <span className={styles.boardCardLink}>Ouvrir la liste →</span>
          </button>
        ))}
      </div>

      <section className={styles.section}>
        <h2>10 derniers dossiers travaillés</h2>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div>
              <h2>Aucun historique</h2>
              <p>
                {appliedQuery.trim()
                  ? 'Aucun dossier ne correspond à votre recherche.'
                  : 'Les dossiers récemment mis à jour apparaîtront ici.'}
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Client</th>
                  <th>Type crédit</th>
                  <th>Montant souhaité</th>
                  <th>État</th>
                  <th>Mise à jour</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} onClick={() => onSelectDossier(d.id)}>
                    <td>
                      <strong>{d.reference}</strong>
                    </td>
                    <td>{d.client.fullName}</td>
                    <td>{d.type}</td>
                    <td>
                      <strong>{formatMontantDossier(d)}</strong>
                    </td>
                    <td>
                      <span className={etatBadgeClass(d.etat)}>{d.etatLabel}</span>
                    </td>
                    <td className={styles.itemMeta}>
                      {d.updatedAt
                        ? new Date(d.updatedAt).toLocaleString('fr-FR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
