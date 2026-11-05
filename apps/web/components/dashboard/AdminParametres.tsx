'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_PARAMETRES_IMF,
  normalizeParametresImf,
  type ParametresImf,
} from '@imf/shared';
import { ApiError, apiFetch } from '../../lib/api';
import { useToast } from '../Toast';
import { dashStyles as styles } from './DashboardShell';
import {
  AddRowButton,
  FormBlock,
  FormRow,
  RemoveRowButton,
  SaveBar,
  TextInput,
} from './FormKit';
import { PageError, PageLoading, PageStateBlock } from './PageState';

const INSTITUTION: Array<[keyof ParametresImf['institution'], string]> = [
  ['raisonSociale', 'Raison sociale'],
  ['formeJuridique', 'Forme juridique'],
  ['siege', 'Siège social'],
  ['rccm', 'RCCM'],
  ['idNat', 'Identification nationale'],
  ['agrementBcc', 'Agrément BCC'],
  ['representantNom', 'Représentant (contrats)'],
  ['representantFonction', 'Fonction du représentant'],
  ['presidentComiteCredit', 'Président du comité de crédit'],
  ['telephoneReclamations', 'Téléphone réclamations'],
  ['emailReclamations', 'E-mail réclamations'],
  ['villeSignature', 'Ville de signature'],
];

/** Champs en pourcentage (stockés en fraction, saisis en %). */
const POURCENTAGES: Array<[keyof ParametresImf['conditions'], string]> = [
  ['fraisDossierPct', 'Frais de dossier (%)'],
  ['fraisDecaissementPct', 'Frais de décaissement (%)'],
  ['cautionPct', 'Caution / épargne obligatoire (%)'],
  ['tvaPct', 'TVA sur frais (%)'],
  ['fraisInscriptionGagePct', 'Frais d’inscription des gages (%)'],
  ['penaliteRetardPct', 'Pénalité de retard (%)'],
];

const MONTANTS: Array<[keyof ParametresImf['conditions'], string]> = [
  ['smsMensuel', 'SMS alerte (par mois, USD)'],
  ['montantMinPret', 'Montant minimum d’un prêt (USD)'],
  ['montantMaxPret', 'Montant maximum d’un prêt (USD)'],
];

const toPct = (f: number) => String(Math.round(f * 100000) / 1000);
const fromPct = (s: string) => Number(s.replace(',', '.')) / 100;
const toNum = (s: string) => Number(s.replace(',', '.'));

export function AdminParametres() {
  const toast = useToast();
  const [params, setParams] = useState<ParametresImf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    apiFetch<ParametresImf>('/parametres')
      .then((p) => setParams(normalizeParametresImf(p)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Erreur de chargement'));
  }, []);

  if (error) {
    return (
      <PageStateBlock>
        <PageError title="Paramètres indisponibles" message={error} />
      </PageStateBlock>
    );
  }
  if (!params) {
    return (
      <PageStateBlock>
        <PageLoading title="Chargement des paramètres" detail="Institution, frais et grille de taux…" />
      </PageStateBlock>
    );
  }

  function update(next: ParametresImf) {
    setParams(next);
    setDirty(true);
  }

  async function save() {
    if (!params) return;
    setBusy(true);
    try {
      const saved = await apiFetch<ParametresImf>('/admin/parametres', {
        method: 'PUT',
        body: JSON.stringify(params),
      });
      setParams(normalizeParametresImf(saved));
      setDirty(false);
      toast.success('Paramètres IMF enregistrés.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  const c = params.conditions;
  return (
    <div>
      <h1 className={styles.pageTitle}>Paramètres IMF</h1>
      <p className={styles.assignHint}>
        Utilisés par les fiches (CF5.1, PV du comité, mémo PCA), le pronostic et les documents imprimables. Chaque
        modification est tracée dans le journal.
      </p>

      <FormBlock title="Institution (en-têtes et contrats)">
        {INSTITUTION.map(([k, label]) => (
          <FormRow key={k} label={label}>
            <TextInput
              value={params.institution[k]}
              onChange={(v) => update({ ...params, institution: { ...params.institution, [k]: v } })}
            />
          </FormRow>
        ))}
      </FormBlock>

      <FormBlock title="Conditions tarifaires">
        {POURCENTAGES.map(([k, label]) => (
          <FormRow key={k} label={label}>
            <TextInput
              type="number"
              value={toPct(c[k])}
              onChange={(v) => update({ ...params, conditions: { ...c, [k]: fromPct(v) } })}
            />
          </FormRow>
        ))}
        {MONTANTS.map(([k, label]) => (
          <FormRow key={k} label={label}>
            <TextInput
              type="number"
              value={String(c[k])}
              onChange={(v) => update({ ...params, conditions: { ...c, [k]: toNum(v) } })}
            />
          </FormRow>
        ))}
        <FormRow label="Seuil d’approbation du Conseil d’administration (USD)">
          <TextInput
            type="number"
            value={String(params.seuilApprobationCa)}
            onChange={(v) => update({ ...params, seuilApprobationCa: toNum(v) })}
          />
        </FormRow>
      </FormBlock>

      <div className={styles.detailTableBlock}>
        <div className={styles.cf2TableHeader}>
          <h3 className={styles.detailTableTitle}>Grille de taux mensuels par tranche (CF 2.5)</h3>
          <AddRowButton
            onClick={() => update({ ...params, grilleTaux: [...params.grilleTaux, { min: 0, max: 0, tauxMensuel: 0 }] })}
          />
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.detailDataTable}>
            <thead>
              <tr>
                <th>Montant min (USD)</th>
                <th>Montant max (USD)</th>
                <th>Taux mensuel (%)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {params.grilleTaux.map((t, i) => {
                const set = (patch: Partial<typeof t>) =>
                  update({ ...params, grilleTaux: params.grilleTaux.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
                return (
                  <tr key={i}>
                    <td><TextInput type="number" value={String(t.min)} onChange={(v) => set({ min: toNum(v) })} /></td>
                    <td><TextInput type="number" value={String(t.max)} onChange={(v) => set({ max: toNum(v) })} /></td>
                    <td><TextInput type="number" value={toPct(t.tauxMensuel)} onChange={(v) => set({ tauxMensuel: fromPct(v) })} /></td>
                    <td>
                      {params.grilleTaux.length > 1 ? (
                        <RemoveRowButton onClick={() => update({ ...params, grilleTaux: params.grilleTaux.filter((_, j) => j !== i) })} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.descenteFooterActions}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={() => update(DEFAULT_PARAMETRES_IMF)}
          disabled={busy}
        >
          Valeurs par défaut (Excel)
        </button>
      </div>
      <SaveBar label="Enregistrer les paramètres" busy={busy} dirty={dirty} onSave={() => void save()} />
    </div>
  );
}
