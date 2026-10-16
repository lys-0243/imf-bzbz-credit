'use client';

import { useMemo, type ReactNode } from 'react';
import {
  CF23_MOIS,
  CF23_MOIS_LABELS,
  avgStockMarge,
  avgStockMargePrincipaux,
  margeBruteMoyennePonderee,
  newCf23AchatRecent,
  newCf23AutreRevenu,
  newCf23DepenseSixMois,
  newCf23VenteMoyenneMois,
  newCf2Reference,
  sumAchatsRecents,
  sumAutresRevenus,
  sumDepensesSixMois,
  sumOpex,
  sumVentesMoyennes,
  ventesMensuellesMoyennes,
  type Cf22AchatLine,
  type Cf22StockLine,
  type Cf23AchatRecent,
  type Cf23AutreRevenu,
  type Cf23Data,
  type Cf23DepenseSixMois,
  type Cf23MoisKey,
  type Cf23VenteMoyenneMois,
  type Cf2QualiteBnm,
  type Cf2Reference,
} from '@imf/shared';
import { dashStyles as styles } from './DashboardShell';

type Props = {
  cf23: Cf23Data;
  stock: Cf22StockLine[];
  achats: Cf22AchatLine[];
  devise: string;
  disabled?: boolean;
  busy?: boolean;
  onChange: (next: Cf23Data) => void;
  onSave?: () => void | Promise<void>;
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
  compact,
  onChange,
}: {
  value: string;
  devise: string;
  disabled?: boolean;
  compact?: boolean;
  onChange: (raw: string) => void;
}) {
  return (
    <div
      className={`${styles.cf1AmountField} ${
        compact ? styles.cf2AmountFieldCompact : ''
      }`}
    >
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

function formatPct(ratio: number | null): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

function QualiteSelect({
  value,
  disabled,
  onChange,
}: {
  value: Cf2QualiteBnm;
  disabled?: boolean;
  onChange: (v: Cf2QualiteBnm) => void;
}) {
  return (
    <select
      className={styles.cf1FormControl}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Cf2QualiteBnm)}
    >
      <option value="">—</option>
      <option value="B">B</option>
      <option value="N">N</option>
      <option value="M">M</option>
    </select>
  );
}

export function Cf23Section({
  cf23,
  stock,
  achats,
  devise,
  disabled,
  busy,
  onChange,
  onSave,
}: Props) {
  const totalAchats = useMemo(
    () => sumAchatsRecents(cf23.achatsRecents),
    [cf23.achatsRecents],
  );
  const nombreMois = cf23.ventesMoyennes.length;
  const totalVentesMoy = useMemo(
    () => sumVentesMoyennes(cf23.ventesMoyennes),
    [cf23.ventesMoyennes],
  );
  const moyMensuelle = useMemo(
    () => ventesMensuellesMoyennes(cf23),
    [cf23],
  );
  const opexTotal = useMemo(() => sumOpex(cf23.opex), [cf23.opex]);
  const sixMoisTotal = useMemo(
    () => sumDepensesSixMois(cf23.depensesSixMois),
    [cf23.depensesSixMois],
  );
  const autresRevTotal = useMemo(
    () => sumAutresRevenus(cf23.autresRevenus),
    [cf23.autresRevenus],
  );

  /** Excel L21 / AH21 / BJ21 */
  const margePonderee = useMemo(
    () => margeBruteMoyennePonderee(achats, stock),
    [achats, stock],
  );
  const margePrincipaux = useMemo(
    () => avgStockMargePrincipaux(stock),
    [stock],
  );
  const margeTousProduits = useMemo(() => avgStockMarge(stock), [stock]);

  function patch(partial: Partial<Cf23Data>) {
    onChange({ ...cf23, ...partial });
  }

  function patchOpex(partial: Partial<Cf23Data['opex']>) {
    patch({ opex: { ...cf23.opex, ...partial } });
  }

  function patchSaison(
    mois: Cf23MoisKey,
    partial: Partial<Cf23Data['saisonnalite'][Cf23MoisKey]>,
  ) {
    patch({
      saisonnalite: {
        ...cf23.saisonnalite,
        [mois]: { ...cf23.saisonnalite[mois], ...partial },
      },
    });
  }

  function updateAchat(idx: number, partial: Partial<Cf23AchatRecent>) {
    patch({
      achatsRecents: cf23.achatsRecents.map((row, i) =>
        i === idx ? { ...row, ...partial } : row,
      ),
    });
  }

  function updateVenteMoy(idx: number, partial: Partial<Cf23VenteMoyenneMois>) {
    patch({
      ventesMoyennes: cf23.ventesMoyennes.map((row, i) =>
        i === idx ? { ...row, ...partial } : row,
      ),
    });
  }

  function updateDepense6(idx: number, partial: Partial<Cf23DepenseSixMois>) {
    patch({
      depensesSixMois: cf23.depensesSixMois.map((row, i) =>
        i === idx ? { ...row, ...partial } : row,
      ),
    });
  }

  function updateAutreRev(idx: number, partial: Partial<Cf23AutreRevenu>) {
    patch({
      autresRevenus: cf23.autresRevenus.map((row, i) =>
        i === idx ? { ...row, ...partial } : row,
      ),
    });
  }

  function updateRef(idx: number, partial: Partial<Cf2Reference>) {
    patch({
      referencesBusiness: cf23.referencesBusiness.map((row, i) =>
        i === idx ? { ...row, ...partial } : row,
      ),
    });
  }

  return (
    <>
      <div className={styles.detailTableBlock}>
        <h3 className={styles.detailTableTitle}>
          2.3.5 Saisonnalité des ventes (mois en cours = 100 %)
        </h3>
        <div className={styles.tableWrap}>
          <table
            className={`${styles.detailDataTable} ${styles.cf2SaisonTable}`}
          >
            <thead>
              <tr>
                <th>Mois</th>
                {CF23_MOIS.map((m) => (
                  <th key={m}>{CF23_MOIS_LABELS[m]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>B / N / M</td>
                {CF23_MOIS.map((m) => (
                  <td key={`q-${m}`}>
                    <QualiteSelect
                      value={cf23.saisonnalite[m].qualite}
                      disabled={disabled}
                      onChange={(qualite) => patchSaison(m, { qualite })}
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td>Total en %</td>
                {CF23_MOIS.map((m) => (
                  <td key={`p-${m}`}>
                    <input
                      type="number"
                      className={styles.cf1FormControl}
                      value={cf23.saisonnalite[m].pourcentage}
                      disabled={disabled}
                      onChange={(e) =>
                        patchSaison(m, { pourcentage: e.target.value })
                      }
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>2.3.6 4 derniers achats</h3>
          {!disabled ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() =>
                patch({
                  achatsRecents: [
                    ...cf23.achatsRecents,
                    newCf23AchatRecent(),
                  ],
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
                <th>Date</th>
                <th>Lieu d’achat</th>
                <th>Produit(s)</th>
                <th>Total</th>
                {!disabled ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {cf23.achatsRecents.map((row, idx) => (
                <tr key={row.id}>
                  <td>
                    <input
                      className={styles.cf1FormControl}
                      value={row.date}
                      disabled={disabled}
                      onChange={(e) =>
                        updateAchat(idx, { date: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cf1FormControl}
                      value={row.lieu}
                      disabled={disabled}
                      onChange={(e) =>
                        updateAchat(idx, { lieu: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cf1FormControl}
                      value={row.produits}
                      disabled={disabled}
                      onChange={(e) =>
                        updateAchat(idx, { produits: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <AmountField
                      value={row.montant}
                      devise={devise}
                      disabled={disabled}
                      compact
                      onChange={(montant) => updateAchat(idx, { montant })}
                    />
                  </td>
                  {!disabled ? (
                    <td>
                      <button
                        type="button"
                        className={styles.checklistIconBtn}
                        title="Retirer"
                        disabled={cf23.achatsRecents.length <= 1}
                        onClick={() =>
                          patch({
                            achatsRecents: cf23.achatsRecents.filter(
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
              <tr>
                <td colSpan={3}>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>{formatMoney(totalAchats, devise)}</strong>
                </td>
                {!disabled ? <td /> : null}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>
            2.3.7 Ventes mensuelles moyennes
          </h3>
          {!disabled ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => {
                const ventesMoyennes = [
                  ...cf23.ventesMoyennes,
                  newCf23VenteMoyenneMois(),
                ];
                patch({
                  ventesMoyennes,
                  nombreMoisVentesMoyennes: String(ventesMoyennes.length),
                });
              }}
            >
              Ajouter un mois
            </button>
          ) : null}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.detailDataTable}>
            <thead>
              <tr>
                <th>Mois</th>
                <th>B / N / M</th>
                <th>Montant</th>
                {!disabled ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {cf23.ventesMoyennes.map((row, idx) => (
                <tr key={row.id}>
                  <td>
                    <input
                      className={styles.cf1FormControl}
                      value={row.label}
                      disabled={disabled}
                      placeholder="ex. Oct. 2025"
                      onChange={(e) =>
                        updateVenteMoy(idx, { label: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <QualiteSelect
                      value={row.qualite}
                      disabled={disabled}
                      onChange={(qualite) =>
                        updateVenteMoy(idx, { qualite })
                      }
                    />
                  </td>
                  <td>
                    <AmountField
                      value={row.montant}
                      devise={devise}
                      disabled={disabled}
                      compact
                      onChange={(montant) =>
                        updateVenteMoy(idx, { montant })
                      }
                    />
                  </td>
                  {!disabled ? (
                    <td>
                      <button
                        type="button"
                        className={styles.checklistIconBtn}
                        title="Retirer"
                        disabled={cf23.ventesMoyennes.length <= 1}
                        onClick={() => {
                          const ventesMoyennes = cf23.ventesMoyennes.filter(
                            (_, i) => i !== idx,
                          );
                          patch({
                            ventesMoyennes,
                            nombreMoisVentesMoyennes: String(
                              Math.max(1, ventesMoyennes.length),
                            ),
                          });
                        }}
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
        <div className={styles.detailTableBlock} style={{ marginTop: 12 }}>
          <h3 className={styles.detailTableTitle}>Paramètres moyenne</h3>
          <div className={styles.tableWrap}>
            <table className={styles.detailDataTable}>
              <thead>
                <tr>
                  <th>Nombre de mois</th>
                  <th>Total des mois</th>
                  <th>Vente mensuelle</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>{nombreMois}</strong>
                  </td>
                  <td>
                    <strong>{formatMoney(totalVentesMoy, devise)}</strong>
                  </td>
                  <td>
                    <strong>{formatMoney(moyMensuelle, devise)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={styles.detailTableBlock}>
        <h3 className={styles.detailTableTitle}>2.4 Marges</h3>
        <div className={styles.tableWrap}>
          <table className={styles.detailDataTable}>
            <thead>
              <tr>
                <th>Marge brute moyenne pondérée</th>
                <th>Marge produits principaux</th>
                <th>Marge brute moyenne (de tous les produits)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>{formatPct(margePonderee)}</strong>
                </td>
                <td>
                  <strong>{formatPct(margePrincipaux)}</strong>
                </td>
                <td>
                  <strong>{formatPct(margeTousProduits)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <FormBlock title="2.5 Dépenses opérationnelles">
        <FormRow label="Transport journalier au lieu de l’activité">
          <AmountField
            value={cf23.opex.transportJournalier}
            devise={devise}
            disabled={disabled}
            onChange={(transportJournalier) =>
              patchOpex({ transportJournalier })
            }
          />
        </FormRow>
        <FormRow label="Transport / coût de voyage d’achats">
          <AmountField
            value={cf23.opex.transportAchats}
            devise={devise}
            disabled={disabled}
            onChange={(transportAchats) => patchOpex({ transportAchats })}
          />
        </FormRow>
        <FormRow label="Loyer">
          <AmountField
            value={cf23.opex.loyer}
            devise={devise}
            disabled={disabled}
            onChange={(loyer) => patchOpex({ loyer })}
          />
        </FormRow>
        <FormRow label="Communication">
          <AmountField
            value={cf23.opex.communication}
            devise={devise}
            disabled={disabled}
            onChange={(communication) => patchOpex({ communication })}
          />
        </FormRow>
        <FormRow label="Nombre d’agents">
          <input
            type="number"
            className={styles.cf1FormControl}
            value={cf23.opex.nbAgents}
            disabled={disabled}
            onChange={(e) => patchOpex({ nbAgents: e.target.value })}
          />
        </FormRow>
        <FormRow label="Salaires">
          <AmountField
            value={cf23.opex.salaires}
            devise={devise}
            disabled={disabled}
            onChange={(salaires) => patchOpex({ salaires })}
          />
        </FormRow>
        <FormRow label="Services (électricité, eau…)">
          <AmountField
            value={cf23.opex.services}
            devise={devise}
            disabled={disabled}
            onChange={(services) => patchOpex({ services })}
          />
        </FormRow>
        <FormRow label="Taxes / ticket marché / licence">
          <AmountField
            value={cf23.opex.taxesLicence}
            devise={devise}
            disabled={disabled}
            onChange={(taxesLicence) => patchOpex({ taxesLicence })}
          />
        </FormRow>
        <FormRow label="Acomptes des autres prêts">
          <AmountField
            value={cf23.opex.acomptesAutresPrets}
            devise={devise}
            disabled={disabled}
            onChange={(acomptesAutresPrets) =>
              patchOpex({ acomptesAutresPrets })
            }
          />
        </FormRow>
        <FormRow label="Autres (libellé)">
          <input
            className={styles.cf1FormControl}
            value={cf23.opex.autresLabel}
            disabled={disabled}
            onChange={(e) => patchOpex({ autresLabel: e.target.value })}
          />
        </FormRow>
        <FormRow label="Autres (montant)">
          <AmountField
            value={cf23.opex.autresMontant}
            devise={devise}
            disabled={disabled}
            onChange={(autresMontant) => patchOpex({ autresMontant })}
          />
        </FormRow>
        <FormRow label="Total opex">
          <strong>{formatMoney(opexTotal, devise)}</strong>
        </FormRow>
      </FormBlock>

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>
            2.6 Dépenses de 6 derniers mois
          </h3>
          {!disabled ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() =>
                patch({
                  depensesSixMois: [
                    ...cf23.depensesSixMois,
                    newCf23DepenseSixMois(),
                  ],
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
                <th>Date</th>
                <th>Description</th>
                <th>Montant</th>
                {!disabled ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {cf23.depensesSixMois.length === 0 ? (
                <tr>
                  <td colSpan={disabled ? 3 : 4}>Aucune dépense saisie.</td>
                </tr>
              ) : (
                cf23.depensesSixMois.map((row, idx) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        className={styles.cf1FormControl}
                        value={row.date}
                        disabled={disabled}
                        onChange={(e) =>
                          updateDepense6(idx, { date: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cf1FormControl}
                        value={row.description}
                        disabled={disabled}
                        onChange={(e) =>
                          updateDepense6(idx, {
                            description: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <AmountField
                        value={row.montant}
                        devise={devise}
                        disabled={disabled}
                        compact
                        onChange={(montant) =>
                          updateDepense6(idx, { montant })
                        }
                      />
                    </td>
                    {!disabled ? (
                      <td>
                        <button
                          type="button"
                          className={styles.checklistIconBtn}
                        title="Retirer"
                          onClick={() =>
                            patch({
                              depensesSixMois: cf23.depensesSixMois.filter(
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
                ))
              )}
              <tr>
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>{formatMoney(sixMoisTotal, devise)}</strong>
                </td>
                {!disabled ? <td /> : null}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>2.7 Autres revenus</h3>
          {!disabled ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() =>
                patch({
                  autresRevenus: [
                    ...cf23.autresRevenus,
                    newCf23AutreRevenu(),
                  ],
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
                <th>Description</th>
                <th>Depuis</th>
                <th>Revenu mensuel</th>
                {!disabled ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {cf23.autresRevenus.map((row, idx) => (
                <tr key={row.id}>
                  <td>
                    <input
                      className={styles.cf1FormControl}
                      value={row.description}
                      disabled={disabled}
                      onChange={(e) =>
                        updateAutreRev(idx, { description: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cf1FormControl}
                      value={row.depuis}
                      disabled={disabled}
                      onChange={(e) =>
                        updateAutreRev(idx, { depuis: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <AmountField
                      value={row.revenuMensuel}
                      devise={devise}
                      disabled={disabled}
                      compact
                      onChange={(revenuMensuel) =>
                        updateAutreRev(idx, { revenuMensuel })
                      }
                    />
                  </td>
                  {!disabled ? (
                    <td>
                      <button
                        type="button"
                        className={styles.checklistIconBtn}
                        title="Retirer"
                        onClick={() =>
                          patch({
                            autresRevenus: cf23.autresRevenus.filter(
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
              <tr>
                <td colSpan={2}>
                  <strong>Autre revenu (net)</strong>
                </td>
                <td>
                  <strong>{formatMoney(autresRevTotal, devise)}</strong>
                </td>
                {!disabled ? <td /> : null}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>
            2.8 Références du business
          </h3>
          {!disabled ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() =>
                patch({
                  referencesBusiness: [
                    ...cf23.referencesBusiness,
                    newCf2Reference(),
                  ],
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
                <th>Référence (nom)</th>
                <th>Type de relation / téléphone</th>
                {!disabled ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {cf23.referencesBusiness.map((row, idx) => (
                <tr key={row.id}>
                  <td>
                    <input
                      className={styles.cf1FormControl}
                      value={row.nom}
                      disabled={disabled}
                      onChange={(e) =>
                        updateRef(idx, { nom: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cf1FormControl}
                      value={row.relationTelephone}
                      disabled={disabled}
                      onChange={(e) =>
                        updateRef(idx, {
                          relationTelephone: e.target.value,
                        })
                      }
                    />
                  </td>
                  {!disabled ? (
                    <td>
                      <button
                        type="button"
                        className={styles.checklistIconBtn}
                        title="Retirer"
                        onClick={() =>
                          patch({
                            referencesBusiness:
                              cf23.referencesBusiness.filter(
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
            onClick={() => void onSave()}
            disabled={busy}
          >
            Enregistrer CF2.3
          </button>
        </div>
      ) : null}
    </>
  );
}
