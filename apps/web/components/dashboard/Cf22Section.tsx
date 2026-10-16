'use client';

import { useMemo, type ReactNode } from 'react';
import {
  CF22_JOUR_LABELS,
  CF22_JOURS,
  achatRatioCout,
  achatsMensuels,
  newCf22AchatLine,
  newCf22StockLine,
  newCf22VenteRecent,
  stockMarge,
  stockValeur,
  sumAchatsMensuels,
  sumStock,
  sumVentesFromAchats,
  sumVentesHebdo,
  ventesMensuellesFromAchat,
  ventesMensuellesFromHebdo,
  ventesMensuellesFromRecents,
  type Cf22AchatLine,
  type Cf22Data,
  type Cf22JourSemaine,
  type Cf22StockLine,
  type Cf22VenteJour,
  type Cf22VenteRecent,
} from '@imf/shared';
import { dashStyles as styles } from './DashboardShell';

type Props = {
  cf22: Cf22Data;
  devise: string;
  disabled?: boolean;
  busy?: boolean;
  onChange: (next: Cf22Data) => void;
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

export function Cf22Section({
  cf22,
  devise,
  disabled,
  busy,
  onChange,
  onSave,
}: Props) {
  const stockTotal = useMemo(() => sumStock(cf22.stock), [cf22.stock]);
  const hebdo = useMemo(
    () => sumVentesHebdo(cf22.ventesJours),
    [cf22.ventesJours],
  );
  const mensuelHebdo = useMemo(
    () => ventesMensuellesFromHebdo(cf22.ventesJours),
    [cf22.ventesJours],
  );
  const mensuelRecents = useMemo(
    () =>
      ventesMensuellesFromRecents(
        cf22.ventesRecents,
        cf22.aujourdHui.ventePrevue,
        cf22.joursOuvrablesMois,
      ),
    [
      cf22.ventesRecents,
      cf22.aujourdHui.ventePrevue,
      cf22.joursOuvrablesMois,
    ],
  );
  const totalAchats = useMemo(
    () => sumAchatsMensuels(cf22.achats, cf22.stock),
    [cf22.achats, cf22.stock],
  );
  const totalVentesAchats = useMemo(
    () => sumVentesFromAchats(cf22.achats, cf22.stock),
    [cf22.achats, cf22.stock],
  );

  function patch(partial: Partial<Cf22Data>) {
    onChange({ ...cf22, ...partial });
  }

  function patchBusiness(partial: Partial<Cf22Data['business']>) {
    patch({ business: { ...cf22.business, ...partial } });
  }

  function patchAujourdHui(partial: Partial<Cf22Data['aujourdHui']>) {
    patch({ aujourdHui: { ...cf22.aujourdHui, ...partial } });
  }

  function patchVenteJour(
    jour: Cf22JourSemaine,
    partial: Partial<Cf22VenteJour>,
  ) {
    patch({
      ventesJours: {
        ...cf22.ventesJours,
        [jour]: { ...cf22.ventesJours[jour], ...partial },
      },
    });
  }

  function updateStock(idx: number, partial: Partial<Cf22StockLine>) {
    const stock = cf22.stock.map((row, i) =>
      i === idx ? { ...row, ...partial } : row,
    );
    patch({ stock });
  }

  function updateRecent(idx: number, partial: Partial<Cf22VenteRecent>) {
    const ventesRecents = cf22.ventesRecents.map((row, i) =>
      i === idx ? { ...row, ...partial } : row,
    );
    patch({ ventesRecents });
  }

  function updateAchat(idx: number, partial: Partial<Cf22AchatLine>) {
    const achats = cf22.achats.map((row, i) =>
      i === idx ? { ...row, ...partial } : row,
    );
    patch({ achats });
  }

  return (
    <>
      <FormBlock title="2.1 Business">
        <FormRow label="Activité depuis">
          <input
            className={styles.cf1FormControl}
            value={cf22.business.activiteDepuis}
            disabled={disabled}
            onChange={(e) =>
              patchBusiness({ activiteDepuis: e.target.value })
            }
          />
        </FormRow>
        <FormRow label="Lieu depuis">
          <input
            className={styles.cf1FormControl}
            value={cf22.business.lieuDepuis}
            disabled={disabled}
            onChange={(e) => patchBusiness({ lieuDepuis: e.target.value })}
          />
        </FormRow>
        <FormRow label="Propriété des locaux de l’activité">
          <select
            className={styles.cf1FormControl}
            value={cf22.business.proprieteLocaux}
            disabled={disabled}
            onChange={(e) =>
              patchBusiness({
                proprieteLocaux: e.target.value as '' | 'oui' | 'non',
              })
            }
          >
            <option value="">—</option>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
        </FormRow>
        {cf22.business.proprieteLocaux === 'non' ? (
          <FormRow label="Nom du bailleur">
            <input
              className={styles.cf1FormControl}
              value={cf22.business.nomBailleur}
              disabled={disabled}
              onChange={(e) =>
                patchBusiness({ nomBailleur: e.target.value })
              }
            />
          </FormRow>
        ) : null}
        <FormRow label="Nombre de points de vente">
          <input
            type="number"
            className={styles.cf1FormControl}
            value={cf22.business.pointsDeVente}
            disabled={disabled}
            onChange={(e) =>
              patchBusiness({ pointsDeVente: e.target.value })
            }
          />
        </FormRow>
        <FormRow label="Date / heure de la visite">
          <input
            className={styles.cf1FormControl}
            value={cf22.business.dateHeureVisite}
            disabled={disabled}
            onChange={(e) =>
              patchBusiness({ dateHeureVisite: e.target.value })
            }
          />
        </FormRow>
      </FormBlock>

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>2.2 Stock</h3>
          {!disabled ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() =>
                patch({ stock: [...cf22.stock, newCf22StockLine()] })
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
                <th title="Produit principal (x)">Princ.</th>
                <th>Nom du Produit</th>
                <th>Quantité</th>
                <th>Prix d’achat</th>
                <th>Prix de vente</th>
                <th>Marge</th>
                <th>Valeur stock</th>
                {!disabled ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {cf22.stock.map((line, idx) => {
                const marge = stockMarge(line);
                const valeur = stockValeur(line);
                return (
                  <tr key={line.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(line.principal)}
                        disabled={disabled}
                        title="Produit principal"
                        aria-label={`Produit principal ${line.produit || idx + 1}`}
                        onChange={(e) =>
                          updateStock(idx, { principal: e.target.checked })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cf1FormControl}
                        value={line.produit}
                        disabled={disabled}
                        onChange={(e) =>
                          updateStock(idx, { produit: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className={styles.cf1FormControl}
                        value={line.quantite}
                        disabled={disabled}
                        onChange={(e) =>
                          updateStock(idx, { quantite: e.target.value })
                        }
                      />
                    </td>
                    <td className={styles.cf2StockPriceCell}>
                      <AmountField
                        value={line.prixAchat}
                        devise={devise}
                        disabled={disabled}
                        compact
                        onChange={(v) => updateStock(idx, { prixAchat: v })}
                      />
                    </td>
                    <td className={styles.cf2StockPriceCell}>
                      <AmountField
                        value={line.prixVente}
                        devise={devise}
                        disabled={disabled}
                        compact
                        onChange={(v) => updateStock(idx, { prixVente: v })}
                      />
                    </td>
                    <td>
                      <strong>{formatPct(marge)}</strong>
                    </td>
                    <td>
                      <strong>
                        {num(line.prixAchat) > 0
                          ? formatMoney(valeur, devise)
                          : '—'}
                      </strong>
                    </td>
                    {!disabled ? (
                      <td>
                        <button
                          type="button"
                          className={styles.checklistIconBtn}
                          title="Retirer"
                          disabled={cf22.stock.length <= 1}
                          onClick={() =>
                            patch({
                              stock: cf22.stock.filter((_, i) => i !== idx),
                            })
                          }
                        >
                          ✕
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={styles.assignHint} style={{ marginTop: 10 }}>
          Total stock : <strong>{formatMoney(stockTotal, devise)}</strong>
        </p>
      </div>

      <FormBlock title="2.3 Ventes & Achats">
        <FormRow label="Existe-t-il un registre (cahier) de vente ?">
          <select
            className={styles.cf1FormControl}
            value={cf22.registreVente}
            disabled={disabled}
            onChange={(e) =>
              patch({
                registreVente: e.target.value as Cf22Data['registreVente'],
              })
            }
          >
            <option value="">—</option>
            <option value="non">Non</option>
            <option value="oui">Oui</option>
            <option value="oui_incomplet">Oui, mais incomplet</option>
          </select>
        </FormRow>
      </FormBlock>

      <div className={styles.detailTableBlock}>
        <h3 className={styles.detailTableTitle}>
          2.3.1 Ventes journalières (min. & max.)
        </h3>
        <div className={styles.tableWrap} style={{ marginBottom: 12 }}>
          <table className={`${styles.detailDataTable} ${styles.cf1FormTable}`}>
            <tbody>
              <FormRow label="Nombre de jours ouvrables par mois">
                <input
                  type="number"
                  className={styles.cf1FormControl}
                  value={cf22.joursOuvrablesMois}
                  disabled={disabled}
                  onChange={(e) =>
                    patch({ joursOuvrablesMois: e.target.value })
                  }
                />
              </FormRow>
            </tbody>
          </table>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.detailDataTable}>
            <thead>
              <tr>
                <th>Jour</th>
                <th>B / N / M</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {CF22_JOURS.map((jour) => (
                <tr key={jour}>
                  <td className={styles.cf1FormLabel}>
                    {CF22_JOUR_LABELS[jour]}
                  </td>
                  <td>
                    <select
                      className={styles.cf1FormControl}
                      value={cf22.ventesJours[jour].qualite}
                      disabled={disabled}
                      onChange={(e) =>
                        patchVenteJour(jour, {
                          qualite: e.target.value as '' | 'B' | 'N' | 'M',
                        })
                      }
                    >
                      <option value="">—</option>
                      <option value="B">B</option>
                      <option value="N">N</option>
                      <option value="M">M</option>
                    </select>
                  </td>
                  <td>
                    <AmountField
                      value={cf22.ventesJours[jour].montant}
                      devise={devise}
                      disabled={disabled}
                      onChange={(v) => patchVenteJour(jour, { montant: v })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.assignHint} style={{ marginTop: 10 }}>
          Total semaine : <strong>{formatMoney(hebdo, devise)}</strong>
          {' · '}
          Ventes mensuelles (semaine × 4) :{' '}
          <strong>{formatMoney(mensuelHebdo, devise)}</strong>
        </p>
      </div>

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>
            2.3.2 Ventes de 3 derniers jours
          </h3>
          {!disabled ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() =>
                patch({
                  ventesRecents: [
                    ...cf22.ventesRecents,
                    newCf22VenteRecent(),
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
                <th>Jour</th>
                <th>Ventes du jour</th>
                {!disabled ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {cf22.ventesRecents.map((row, idx) => (
                <tr key={row.id}>
                  <td>
                    <input
                      className={styles.cf1FormControl}
                      value={row.jour}
                      disabled={disabled}
                      onChange={(e) =>
                        updateRecent(idx, { jour: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <AmountField
                      value={row.montant}
                      devise={devise}
                      disabled={disabled}
                      onChange={(v) => updateRecent(idx, { montant: v })}
                    />
                  </td>
                  {!disabled ? (
                    <td>
                      <button
                        type="button"
                        className={styles.checklistIconBtn}
                        title="Retirer"
                        disabled={cf22.ventesRecents.length <= 1}
                        onClick={() =>
                          patch({
                            ventesRecents: cf22.ventesRecents.filter(
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
        <div className={styles.tableWrap} style={{ marginTop: 12 }}>
          <table className={`${styles.detailDataTable} ${styles.cf1FormTable}`}>
            <tbody>
              <FormRow label="Vente journalière prévue pour aujourd’hui">
                <AmountField
                  value={cf22.aujourdHui.ventePrevue}
                  devise={devise}
                  disabled={disabled}
                  onChange={(v) => patchAujourdHui({ ventePrevue: v })}
                />
              </FormRow>
              <FormRow label="Ventes mensuelles (estimées)">
                <strong>{formatMoney(mensuelRecents, devise)}</strong>
              </FormRow>
            </tbody>
          </table>
        </div>
        <p className={styles.assignHint} style={{ marginTop: 8 }}>
          Formule : (somme des 3 derniers jours + vente prévue aujourd’hui) ÷ 4
          × jours ouvrables
        </p>
      </div>

      <FormBlock title="2.3.3 Espèces">
        <FormRow label="Heure (aujourd’hui)">
          <input
            className={styles.cf1FormControl}
            value={cf22.aujourdHui.heure}
            disabled={disabled}
            placeholder="ex. 12H00"
            onChange={(e) => patchAujourdHui({ heure: e.target.value })}
          />
        </FormRow>
        <FormRow label="Espèces (aujourd’hui)">
          <AmountField
            value={cf22.aujourdHui.especes}
            devise={devise}
            disabled={disabled}
            onChange={(v) => patchAujourdHui({ especes: v })}
          />
        </FormRow>
      </FormBlock>

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>
            2.3.4 Achats des produits principaux
          </h3>
          {!disabled ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() =>
                patch({ achats: [...cf22.achats, newCf22AchatLine()] })
              }
            >
              Ajouter
            </button>
          ) : null}
        </div>
        {cf22.achats.length === 0 ? (
          <p className={styles.descenteCardHint} style={{ margin: 0 }}>
            Aucun achat — ajoutez un produit principal si besoin.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.detailDataTable}>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Fréq. / mois</th>
                  <th>Qté / achat</th>
                  <th>Prix achat unit.</th>
                  <th>Ratio coût</th>
                  <th>Achats mensuels</th>
                  <th>Ventes mensuelles</th>
                  {!disabled ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {cf22.achats.map((line, idx) => {
                  const ratio = achatRatioCout(line, cf22.stock);
                  const achats = achatsMensuels(line, cf22.stock);
                  const ventes = ventesMensuellesFromAchat(line, cf22.stock);
                  return (
                    <tr key={line.id}>
                      <td>
                        <input
                          className={styles.cf1FormControl}
                          value={line.produit}
                          disabled={disabled}
                          onChange={(e) =>
                            updateAchat(idx, { produit: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className={styles.cf1FormControl}
                          value={line.frequenceMensuelle}
                          disabled={disabled}
                          onChange={(e) =>
                            updateAchat(idx, {
                              frequenceMensuelle: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className={styles.cf1FormControl}
                          value={line.qteParAchat}
                          disabled={disabled}
                          onChange={(e) =>
                            updateAchat(idx, { qteParAchat: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <AmountField
                          value={line.prixAchatUnitaire}
                          devise={devise}
                          disabled={disabled}
                          onChange={(v) =>
                            updateAchat(idx, { prixAchatUnitaire: v })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.cf1FormControl}
                          value={line.ratioCout}
                          disabled={disabled}
                          placeholder={
                            ratio != null ? ratio.toFixed(3) : 'auto'
                          }
                          onChange={(e) =>
                            updateAchat(idx, { ratioCout: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <strong>{formatMoney(achats, devise)}</strong>
                      </td>
                      <td>
                        <strong>{formatMoney(ventes, devise)}</strong>
                      </td>
                      {!disabled ? (
                        <td>
                          <button
                            type="button"
                            className={styles.checklistIconBtn}
                            title="Retirer"
                            onClick={() =>
                              patch({
                                achats: cf22.achats.filter((_, i) => i !== idx),
                              })
                            }
                          >
                            ✕
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.assignHint} style={{ marginTop: 10 }}>
          Total achats mensuels :{' '}
          <strong>{formatMoney(totalAchats, devise)}</strong>
          {' · '}
          Total ventes (via achats) :{' '}
          <strong>{formatMoney(totalVentesAchats, devise)}</strong>
        </p>
      </div>

      {!disabled && onSave ? (
        <div className={styles.descenteFooterActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => void onSave()}
            disabled={busy}
          >
            Enregistrer CF2.2
          </button>
        </div>
      ) : null}
    </>
  );
}

function num(s: string): number {
  const n = Number(String(s).replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}
