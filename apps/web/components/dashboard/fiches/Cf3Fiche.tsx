'use client';

import {
  computeMbmp,
  computeMbmpRows,
  coutParUnite,
  coutTotalProduit,
  newCf3MaterielLine,
  newCf3MbmpLine,
  type Cf3Data,
} from '@imf/shared';
import { dashStyles as styles } from '../DashboardShell';
import {
  AddRowButton,
  FormBlock,
  FormRow,
  RemoveRowButton,
  TextInput,
  formatMoney,
  formatPct,
} from '../FormKit';
import { patchAt, type FicheProps } from './types';

export function Cf3Fiche({
  value,
  onChange,
  disabled,
  devise,
  onApplyMbmp,
}: FicheProps<Cf3Data> & { onApplyMbmp?: (mbmp: number) => void }) {
  const mbmpRows = computeMbmpRows(value);
  const mbmp = computeMbmp(value);

  return (
    <>
      {value.produits.map((p, pi) => (
        <div key={p.id} className={styles.detailTableBlock}>
          <div className={styles.cf2TableHeader}>
            <h3 className={styles.detailTableTitle}>Produit {pi + 1}</h3>
            {!disabled ? (
              <AddRowButton
                label="Ajouter un matériel"
                onClick={() =>
                  onChange({
                    ...value,
                    produits: patchAt(value.produits, pi, {
                      materiels: [...p.materiels, newCf3MaterielLine()],
                    }),
                  })
                }
              />
            ) : null}
          </div>
          <table className={`${styles.detailDataTable} ${styles.cf1FormTable}`}>
            <tbody>
              <FormRow label="Produit">
                <TextInput
                  value={p.nom}
                  disabled={disabled}
                  onChange={(nom) => onChange({ ...value, produits: patchAt(value.produits, pi, { nom }) })}
                />
              </FormRow>
              <FormRow label="Nombre d’unités produites">
                <TextInput
                  type="number"
                  value={p.unitesProduites}
                  disabled={disabled}
                  onChange={(unitesProduites) =>
                    onChange({ ...value, produits: patchAt(value.produits, pi, { unitesProduites }) })
                  }
                />
              </FormRow>
            </tbody>
          </table>
          <div className={styles.tableWrap}>
            <table className={styles.detailDataTable}>
              <thead>
                <tr>
                  <th>Quantité</th>
                  <th>Matériel</th>
                  <th>Prix d’achat par unité</th>
                  <th>Coût total</th>
                  {!disabled ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {p.materiels.map((m, mi) => {
                  const setM = (patch: Partial<typeof m>) =>
                    onChange({
                      ...value,
                      produits: patchAt(value.produits, pi, {
                        materiels: patchAt(p.materiels, mi, patch),
                      }),
                    });
                  return (
                    <tr key={m.id}>
                      <td>
                        <TextInput type="number" value={m.quantite} disabled={disabled} onChange={(quantite) => setM({ quantite })} />
                      </td>
                      <td>
                        <TextInput value={m.materiel} disabled={disabled} onChange={(materiel) => setM({ materiel })} />
                      </td>
                      <td>
                        <TextInput type="number" value={m.prixUnitaire} disabled={disabled} onChange={(prixUnitaire) => setM({ prixUnitaire })} />
                      </td>
                      <td>{formatMoney(Number(m.quantite || 0) * Number(m.prixUnitaire || 0), devise)}</td>
                      {!disabled ? (
                        <td>
                          <RemoveRowButton
                            onClick={() =>
                              onChange({
                                ...value,
                                produits: patchAt(value.produits, pi, {
                                  materiels: p.materiels.filter((_, i) => i !== mi),
                                }),
                              })
                            }
                          />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                <tr className={styles.cf2TotalRow}>
                  <td colSpan={3}>Coût total</td>
                  <td>{formatMoney(coutTotalProduit(p), devise)}</td>
                  {!disabled ? <td /> : null}
                </tr>
                <tr>
                  <td colSpan={3}>Coût par unité produite</td>
                  <td>
                    {coutParUnite(p) == null ? '—' : formatMoney(coutParUnite(p)!, devise)}
                  </td>
                  {!disabled ? <td /> : null}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>Marge brute moyenne pondérée (MBMP)</h3>
          {!disabled ? (
            <AddRowButton onClick={() => onChange({ ...value, mbmp: [...value.mbmp, newCf3MbmpLine()] })} />
          ) : null}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.detailDataTable}>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Coût par unité</th>
                <th>Prix de vente</th>
                <th>Marge du produit</th>
                <th>Qté vendue / mois</th>
                <th>Coût mensuel</th>
                <th>Vente mensuelle</th>
                {!disabled ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {value.mbmp.map((l, i) => {
                const row = mbmpRows[i];
                const set = (patch: Partial<typeof l>) => onChange({ ...value, mbmp: patchAt(value.mbmp, i, patch) });
                return (
                  <tr key={l.id}>
                    <td><TextInput value={l.produit} disabled={disabled} onChange={(produit) => set({ produit })} /></td>
                    <td><TextInput type="number" value={l.coutUnitaire} disabled={disabled} onChange={(coutUnitaire) => set({ coutUnitaire })} /></td>
                    <td><TextInput type="number" value={l.prixVente} disabled={disabled} onChange={(prixVente) => set({ prixVente })} /></td>
                    <td>{formatPct(row.marge)}</td>
                    <td><TextInput type="number" value={l.qteVendueMois} disabled={disabled} onChange={(qteVendueMois) => set({ qteVendueMois })} /></td>
                    <td>{formatMoney(row.coutMensuel, devise)}</td>
                    <td>{formatMoney(row.venteMensuelle, devise)}</td>
                    {!disabled ? (
                      <td>
                        <RemoveRowButton onClick={() => onChange({ ...value, mbmp: value.mbmp.filter((_, j) => j !== i) })} />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              <tr className={styles.cf2TotalRow}>
                <td colSpan={5}>Total</td>
                <td>{formatMoney(mbmp.coutMensuel, devise)}</td>
                <td>{formatMoney(mbmp.venteMensuelle, devise)}</td>
                {!disabled ? <td /> : null}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <FormBlock title="Résultat">
        <FormRow label="MBMP (1 − Σ coûts / Σ ventes)">
          <strong>{formatPct(mbmp.mbmp)}</strong>
          {onApplyMbmp && mbmp.mbmp != null && !disabled ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ marginLeft: 12 }}
              onClick={() => onApplyMbmp(mbmp.mbmp!)}
            >
              Appliquer comme marge CF 2.3
            </button>
          ) : null}
        </FormRow>
      </FormBlock>
    </>
  );
}
