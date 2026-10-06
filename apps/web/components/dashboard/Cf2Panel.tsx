'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CF2_SECTION_META,
  newCf2DepenseAutre,
  newCf2FamilyMember,
  newCf2Reference,
  normalizeCf2Analyse,
  sumDepensesFamiliales,
  totalDepensesPrivees,
  type Cf21Data,
  type Cf2Analyse,
  type Cf2DepensesFamiliales,
  type Cf2SectionKey,
} from '@imf/shared';
import { dashStyles as styles } from './DashboardShell';

type Props = {
  analyse: Cf2Analyse | null | undefined;
  devise?: string;
  disabled?: boolean;
  busy?: boolean;
  onSave?: (analyse: Cf2Analyse) => void | Promise<void>;
};

function FormBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.detailTableBlock}>
      <h3 className={styles.detailTableTitle}>{title}</h3>
      <div className={styles.tableWrap}>
        <table className={`${styles.detailDataTable} ${styles.cf1FormTable}`}>
          <thead>
            <tr>
              <th>Champ</th>
              <th>Valeur</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function FormRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <tr>
      <td className={styles.cf1FormLabel}>{label}</td>
      <td className={styles.cf1FormValue}>{children}</td>
    </tr>
  );
}

function AmountField({
  value,
  devise,
  disabled,
  onChange,
}: {
  value: string;
  devise: string;
  disabled?: boolean;
  onChange: (raw: string) => void;
}) {
  return (
    <div className={styles.cf1AmountField}>
      <span className={styles.cf1DeviseBadge}>{devise}</span>
      <input
        type="number"
        className={styles.cf1FormControl}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function formatMoney(n: number, devise: string): string {
  return `${n.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${devise}`;
}

const DEPENSE_ROWS: Array<{
  key: keyof Cf2DepensesFamiliales;
  label: string;
  amount?: boolean;
}> = [
  { key: 'nourriture', label: 'Nourriture', amount: true },
  { key: 'combustible', label: 'Combustible de cuisson (braise ou autres) / énergie', amount: true },
  { key: 'loyer', label: 'Loyer', amount: true },
  { key: 'transport', label: 'Transport', amount: true },
  { key: 'communication', label: 'Communication', amount: true },
  { key: 'habillement', label: 'Habillement', amount: true },
  { key: 'education', label: 'Education (frais scolaires et autres exigences)', amount: true },
  { key: 'soinsMedicaux', label: 'Soins médicaux', amount: true },
  { key: 'services', label: 'Services ((Factures eau, électricité…)', amount: true },
];

const SECTION_SHORT: Record<Cf2SectionKey, string> = {
  cf21: 'Famille',
  cf22: 'Activité',
  cf23: 'Saison',
  cf24: 'Calculs',
  cf25: 'Résumé',
};

function SectionIcon({ section }: { section: Cf2SectionKey }) {
  switch (section) {
    case 'cf21':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
          />
          <circle cx="9" cy="7" r="3.2" strokeWidth="1.8" />
          <path
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35M16.5 3.7a3.2 3.2 0 0 1 0 6.2"
          />
        </svg>
      );
    case 'cf22':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"
          />
          <path
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 21V12h6v9"
          />
        </svg>
      );
    case 'cf23':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 19V5M4 19h16"
          />
          <path
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 15l3.5-4 3 2.5L17 8"
          />
        </svg>
      );
    case 'cf24':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="4" y="3" width="16" height="18" rx="2" strokeWidth="1.8" />
          <path
            strokeWidth="1.8"
            strokeLinecap="round"
            d="M8 8h8M8 12h8M8 16h5"
          />
        </svg>
      );
    case 'cf25':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 11l3 3L22 4"
          />
          <path
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
          />
        </svg>
      );
  }
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

export function Cf2Panel({
  analyse,
  devise = 'USD',
  disabled,
  busy,
  onSave,
}: Props) {
  const [section, setSection] = useState<Cf2SectionKey>('cf21');
  const [form, setForm] = useState<Cf2Analyse>(() =>
    normalizeCf2Analyse(analyse),
  );
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm(normalizeCf2Analyse(analyse));
    setMsg(null);
  }, [analyse]);

  const cf21 = form.cf21;
  const meta = CF2_SECTION_META.find((s) => s.key === section)!;

  const depensesSum = useMemo(
    () => sumDepensesFamiliales(cf21.depenses),
    [cf21.depenses],
  );
  const depensesTotal = useMemo(
    () => totalDepensesPrivees(cf21.depenses),
    [cf21.depenses],
  );

  function patchCf21(partial: Partial<Cf21Data>) {
    setForm((prev) => ({
      ...prev,
      cf21: { ...prev.cf21, ...partial },
    }));
    setMsg(null);
  }

  function patchResidence(partial: Partial<Cf21Data['residence']>) {
    patchCf21({ residence: { ...cf21.residence, ...partial } });
  }

  function patchRevenu(partial: Partial<Cf21Data['revenuConjoint']>) {
    patchCf21({ revenuConjoint: { ...cf21.revenuConjoint, ...partial } });
  }

  function patchDepenses(partial: Partial<Cf2DepensesFamiliales>) {
    patchCf21({ depenses: { ...cf21.depenses, ...partial } });
  }

  async function handleSave() {
    if (!onSave) return;
    setMsg(null);
    try {
      await onSave(form);
      setMsg('Analyse CF2 enregistrée.');
    } catch {
      /* erreur remontée par le parent */
    }
  }

  return (
    <div className={styles.assignPanel}>

      <div className={styles.cf2SectionNav} role="tablist" aria-label="Sections CF2">
        {CF2_SECTION_META.map((s) => {
          const active = section === s.key;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={active}
              title={`${s.label} — ${s.title}`}
              className={`${styles.cf2SectionCard} ${
                active ? styles.cf2SectionCardActive : ''
              }`}
              onClick={() => setSection(s.key)}
            >
              <span className={styles.cf2SectionCardCheck} aria-hidden>
                <CheckIcon />
              </span>
              <span className={styles.cf2SectionCardIcon}>
                <SectionIcon section={s.key} />
              </span>
              <span className={styles.cf2SectionCardLabel}>
                {s.label} · {SECTION_SHORT[s.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.cf2SectionHead}>
        <h3 className={styles.cf2SectionTitle}>
          {meta.label} — {meta.title}
        </h3>
        <p className={styles.cf2SectionSummary}>{meta.summary}</p>
      </div>

      {section === 'cf21' ? (
        <>
          <FormBlock title="Résidence & visite">
            <FormRow label="Résidence actuelle depuis">
              <input
                className={styles.cf1FormControl}
                value={cf21.residence.residenceDepuis}
                disabled={disabled}
                onChange={(e) =>
                  patchResidence({ residenceDepuis: e.target.value })
                }
              />
            </FormRow>
            <FormRow label="Statut du logement">
              <select
                className={styles.cf1FormControl}
                value={cf21.residence.statutLogement}
                disabled={disabled}
                onChange={(e) =>
                  patchResidence({
                    statutLogement: e.target.value as
                      | ''
                      | 'proprietaire'
                      | 'locataire',
                  })
                }
              >
                <option value="">—</option>
                <option value="proprietaire">Propriétaire</option>
                <option value="locataire">Locataire</option>
              </select>
            </FormRow>
            <FormRow label="Autre statut (si applicable)">
              <input
                className={styles.cf1FormControl}
                value={cf21.residence.autreStatut}
                disabled={disabled}
                onChange={(e) =>
                  patchResidence({ autreStatut: e.target.value })
                }
              />
            </FormRow>
            <FormRow label="Date / heure de la visite">
              <input
                className={styles.cf1FormControl}
                value={cf21.residence.dateHeureVisite}
                disabled={disabled}
                onChange={(e) =>
                  patchResidence({ dateHeureVisite: e.target.value })
                }
              />
            </FormRow>
          </FormBlock>

          <div className={styles.detailTableBlock}>
            <div className={styles.cf2TableHeader}>
              <h3 className={styles.detailTableTitle}>Membres du ménage</h3>
              {!disabled ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() =>
                    patchCf21({
                      membres: [...cf21.membres, newCf2FamilyMember()],
                    })
                  }
                >
                  Ajouter
                </button>
              ) : null}
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.detailDataTable}>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Âge</th>
                    <th>Lien de parenté</th>
                    <th>Vit-il avec le demandeur ?</th>
                    <th>Profession</th>
                    {!disabled ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {cf21.membres.map((m, idx) => (
                    <tr key={m.id}>
                      <td>
                        <input
                          className={styles.cf1FormControl}
                          value={m.nom}
                          disabled={disabled}
                          onChange={(e) => {
                            const membres = cf21.membres.map((row, i) =>
                              i === idx ? { ...row, nom: e.target.value } : row,
                            );
                            patchCf21({ membres });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.cf1FormControl}
                          value={m.age}
                          disabled={disabled}
                          onChange={(e) => {
                            const membres = cf21.membres.map((row, i) =>
                              i === idx ? { ...row, age: e.target.value } : row,
                            );
                            patchCf21({ membres });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.cf1FormControl}
                          value={m.lienParente}
                          disabled={disabled}
                          onChange={(e) => {
                            const membres = cf21.membres.map((row, i) =>
                              i === idx
                                ? { ...row, lienParente: e.target.value }
                                : row,
                            );
                            patchCf21({ membres });
                          }}
                        />
                      </td>
                      <td>
                        <select
                          className={styles.cf1FormControl}
                          value={m.vitAvecDemandeur}
                          disabled={disabled}
                          onChange={(e) => {
                            const membres = cf21.membres.map((row, i) =>
                              i === idx
                                ? {
                                    ...row,
                                    vitAvecDemandeur: e.target
                                      .value as '' | 'oui' | 'non',
                                  }
                                : row,
                            );
                            patchCf21({ membres });
                          }}
                        >
                          <option value="">—</option>
                          <option value="oui">Oui</option>
                          <option value="non">Non</option>
                        </select>
                      </td>
                      <td>
                        <input
                          className={styles.cf1FormControl}
                          value={m.profession}
                          disabled={disabled}
                          onChange={(e) => {
                            const membres = cf21.membres.map((row, i) =>
                              i === idx
                                ? { ...row, profession: e.target.value }
                                : row,
                            );
                            patchCf21({ membres });
                          }}
                        />
                      </td>
                      {!disabled ? (
                        <td>
                          <button
                            type="button"
                            className={styles.checklistIconBtn}
                            title="Retirer"
                            disabled={cf21.membres.length <= 1}
                            onClick={() =>
                              patchCf21({
                                membres: cf21.membres.filter(
                                  (_, i) => i !== idx,
                                ),
                              })
                            }
                          >
                            ✕
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <FormBlock title="Revenu du.de la conjoint.e ou Autres  membres de l'Unité Familiale">
            <FormRow label="Employeur / Business">
              <input
                className={styles.cf1FormControl}
                value={cf21.revenuConjoint.employeurOuBusiness}
                disabled={disabled}
                onChange={(e) =>
                  patchRevenu({ employeurOuBusiness: e.target.value })
                }
              />
            </FormRow>
            <FormRow label="Adresse">
              <input
                className={styles.cf1FormControl}
                value={cf21.revenuConjoint.adresse}
                disabled={disabled}
                onChange={(e) => patchRevenu({ adresse: e.target.value })}
              />
            </FormRow>
            <FormRow label="Poste Occupé">
              <input
                className={styles.cf1FormControl}
                value={cf21.revenuConjoint.poste}
                disabled={disabled}
                onChange={(e) => patchRevenu({ poste: e.target.value })}
              />
            </FormRow>
            <FormRow label="Salaire Net / Profit Net">
              <AmountField
                value={cf21.revenuConjoint.salaireOuProfitNet}
                devise={devise}
                disabled={disabled}
                onChange={(v) => patchRevenu({ salaireOuProfitNet: v })}
              />
            </FormRow>
            <FormRow label="Depuis">
              <input
                className={styles.cf1FormControl}
                value={cf21.revenuConjoint.depuis}
                disabled={disabled}
                onChange={(e) => patchRevenu({ depuis: e.target.value })}
              />
            </FormRow>
            <FormRow label="Confirmé">
              <select
                className={styles.cf1FormControl}
                value={cf21.revenuConjoint.confirme}
                disabled={disabled}
                onChange={(e) =>
                  patchRevenu({
                    confirme: e.target.value as '' | 'oui' | 'non',
                  })
                }
              >
                <option value="">—</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </FormRow>
            <FormRow label="Commentaires (si nécessaire)">
              <textarea
                className={`${styles.cf1FormControl} ${styles.cf2Textarea}`}
                value={cf21.revenuConjoint.commentaires}
                disabled={disabled}
                rows={3}
                onChange={(e) =>
                  patchRevenu({ commentaires: e.target.value })
                }
              />
            </FormRow>
          </FormBlock>

          <FormBlock title="Dépenses familiales (mensuelles)">
            {DEPENSE_ROWS.map((row) => (
              <FormRow key={row.key} label={row.label}>
                <AmountField
                  value={String(cf21.depenses[row.key] ?? '')}
                  devise={devise}
                  disabled={disabled}
                  onChange={(v) => patchDepenses({ [row.key]: v })}
                />
              </FormRow>
            ))}
          </FormBlock>

          <div className={styles.detailTableBlock}>
            <div className={styles.cf2TableHeader}>
              <h3 className={styles.detailTableTitle}>Autres dépenses</h3>
              {!disabled ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() =>
                    patchDepenses({
                      autres: [
                        ...(cf21.depenses.autres ?? []),
                        newCf2DepenseAutre(),
                      ],
                    })
                  }
                >
                  Ajouter
                </button>
              ) : null}
            </div>
            {(cf21.depenses.autres ?? []).length === 0 ? (
              <p className={styles.descenteCardHint} style={{ margin: 0 }}>
                Aucune autre dépense — ajoutez un libellé si besoin.
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.detailDataTable}>
                  <thead>
                    <tr>
                      <th>Libellé</th>
                      <th>Montant</th>
                      {!disabled ? <th /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {(cf21.depenses.autres ?? []).map((a, idx) => (
                      <tr key={a.id}>
                        <td>
                          <input
                            className={styles.cf1FormControl}
                            value={a.label}
                            disabled={disabled}
                            placeholder="Ex. loisirs, cotisations…"
                            onChange={(e) => {
                              const autres = (cf21.depenses.autres ?? []).map(
                                (row, i) =>
                                  i === idx
                                    ? { ...row, label: e.target.value }
                                    : row,
                              );
                              patchDepenses({ autres });
                            }}
                          />
                        </td>
                        <td>
                          <AmountField
                            value={a.montant}
                            devise={devise}
                            disabled={disabled}
                            onChange={(v) => {
                              const autres = (cf21.depenses.autres ?? []).map(
                                (row, i) =>
                                  i === idx ? { ...row, montant: v } : row,
                              );
                              patchDepenses({ autres });
                            }}
                          />
                        </td>
                        {!disabled ? (
                          <td>
                            <button
                              type="button"
                              className={styles.checklistIconBtn}
                              title="Retirer"
                              onClick={() =>
                                patchDepenses({
                                  autres: (cf21.depenses.autres ?? []).filter(
                                    (_, i) => i !== idx,
                                  ),
                                })
                              }
                            >
                              ✕
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <FormBlock title="Totaux & contribution">
            <FormRow label="Contribution de l’emprunteur">
              <strong>{formatMoney(depensesSum, devise)}</strong>
            </FormRow>
            <FormRow label="Autres dépenses privées">
              <AmountField
                value={cf21.depenses.autresDepensesPrivees}
                devise={devise}
                disabled={disabled}
                onChange={(v) =>
                  patchDepenses({ autresDepensesPrivees: v })
                }
              />
            </FormRow>
            <FormRow label="Total dépenses privées">
              <strong>{formatMoney(depensesTotal, devise)}</strong>
            </FormRow>
          </FormBlock>

          <div className={styles.detailTableBlock}>
            <div className={styles.cf2TableHeader}>
              <h3 className={styles.detailTableTitle}>Références</h3>
              {!disabled ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() =>
                    patchCf21({
                      references: [...cf21.references, newCf2Reference()],
                    })
                  }
                >
                  Ajouter
                </button>
              ) : null}
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.detailDataTable}>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Relation / téléphone</th>
                    {!disabled ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {cf21.references.map((r, idx) => (
                    <tr key={r.id}>
                      <td>
                        <input
                          className={styles.cf1FormControl}
                          value={r.nom}
                          disabled={disabled}
                          onChange={(e) => {
                            const references = cf21.references.map((row, i) =>
                              i === idx ? { ...row, nom: e.target.value } : row,
                            );
                            patchCf21({ references });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.cf1FormControl}
                          value={r.relationTelephone}
                          disabled={disabled}
                          onChange={(e) => {
                            const references = cf21.references.map((row, i) =>
                              i === idx
                                ? {
                                    ...row,
                                    relationTelephone: e.target.value,
                                  }
                                : row,
                            );
                            patchCf21({ references });
                          }}
                        />
                      </td>
                      {!disabled ? (
                        <td>
                          <button
                            type="button"
                            className={styles.checklistIconBtn}
                            title="Retirer"
                            disabled={cf21.references.length <= 1}
                            onClick={() =>
                              patchCf21({
                                references: cf21.references.filter(
                                  (_, i) => i !== idx,
                                ),
                              })
                            }
                          >
                            ✕
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!disabled && onSave ? (
            <div className={styles.descenteFooterActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => void handleSave()}
                disabled={busy}
              >
                Enregistrer CF2.1
              </button>
              {msg ? <span className={styles.assignHint}>{msg}</span> : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className={styles.cf2Shell}>
          <p className={styles.cf2ShellTitle}>Bientôt disponible</p>
          <p className={styles.cf2ShellText}>{meta.summary}</p>
        </div>
      )}
    </div>
  );
}
