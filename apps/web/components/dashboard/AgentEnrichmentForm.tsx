'use client';

import { useEffect, useState } from 'react';
import {
  enrichmentFromPayload,
  type AgentActiviteEnrichment,
  type AgentSalaireEnrichment,
  type FamilleProduit,
} from '@imf/shared';
import { dashStyles as styles } from './DashboardShell';

type Props = {
  famille: FamilleProduit;
  etatCivil?: string;
  payload: Record<string, any> | null | undefined;
  disabled?: boolean;
  busy?: boolean;
  onSave: (
    enrichment: AgentSalaireEnrichment | AgentActiviteEnrichment,
  ) => void | Promise<void>;
};

const ELIG_FIELDS: Array<{
  key: keyof AgentActiviteEnrichment['eligibilite'];
  label: string;
}> = [
  { key: 'age18OuPlus', label: '18 ans ou plus' },
  { key: 'proprietaireActivite', label: 'Propriétaire de l’activité' },
  { key: 'exerceActiviteActuellement', label: 'Exerce actuellement' },
  { key: 'activiteListeExclusion', label: 'Sur liste d’exclusion IMF' },
  { key: 'congolaisOuDomiciile', label: 'Congolais / domicilié' },
  { key: 'activiteZoneOperationnelle', label: 'Zone opérationnelle' },
  { key: 'activite6MoisConsecutifs', label: '6 mois consécutifs' },
  { key: 'activiteEnregistreeLegalement', label: 'Enregistrée légalement' },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.enrichField}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function AgentEnrichmentForm({
  famille,
  etatCivil,
  payload,
  disabled,
  busy,
  onSave,
}: Props) {
  const [form, setForm] = useState(() =>
    enrichmentFromPayload(famille, payload),
  );

  useEffect(() => {
    setForm(enrichmentFromPayload(famille, payload));
  }, [famille, payload]);

  const marie = etatCivil === 'Marie';

  function patchSalaire(partial: Partial<AgentSalaireEnrichment>) {
    setForm((prev) => ({ ...(prev as AgentSalaireEnrichment), ...partial }));
  }

  function patchActivite(partial: Partial<AgentActiviteEnrichment>) {
    setForm((prev) => ({ ...(prev as AgentActiviteEnrichment), ...partial }));
  }

  return (
    <div className={styles.assignPanel}>
      <h2 className={styles.assignTitle}>Compléter le dossier</h2>
      <p className={styles.assignHint}>
        Renseignez les informations métier complémentaires, puis enregistrez
        avant de poursuivre les documents et la descente.
      </p>

      {famille === 'SALAIRE' ? (
        <div className={styles.enrichGrid}>
          <Field label="Société">
            <input
              className={styles.assignSelect}
              value={(form as AgentSalaireEnrichment).societe}
              disabled={disabled}
              onChange={(e) => patchSalaire({ societe: e.target.value })}
            />
          </Field>
          <Field label="Adresse société">
            <input
              className={styles.assignSelect}
              value={(form as AgentSalaireEnrichment).adresseSociete}
              disabled={disabled}
              onChange={(e) => patchSalaire({ adresseSociete: e.target.value })}
            />
          </Field>
          <Field label="Fonction / Service">
            <input
              className={styles.assignSelect}
              value={(form as AgentSalaireEnrichment).fonctionService}
              disabled={disabled}
              onChange={(e) =>
                patchSalaire({ fonctionService: e.target.value })
              }
            />
          </Field>
          <Field label="Salaire net">
            <input
              type="number"
              className={styles.assignSelect}
              value={(form as AgentSalaireEnrichment).salaireNet || ''}
              disabled={disabled}
              onChange={(e) =>
                patchSalaire({ salaireNet: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Caution / garantie">
            <input
              className={styles.assignSelect}
              value={(form as AgentSalaireEnrichment).cautionGarantie}
              disabled={disabled}
              onChange={(e) =>
                patchSalaire({ cautionGarantie: e.target.value })
              }
            />
          </Field>
          <Field label="Dépôt BC">
            <input
              className={styles.assignSelect}
              value={(form as AgentSalaireEnrichment).depotBc || ''}
              disabled={disabled}
              onChange={(e) => patchSalaire({ depotBc: e.target.value })}
            />
          </Field>
          {marie ? (
            <>
              <Field label="Conjoint (prénom et nom)">
                <input
                  className={styles.assignSelect}
                  value={(form as AgentSalaireEnrichment).conjointNom || ''}
                  disabled={disabled}
                  onChange={(e) =>
                    patchSalaire({ conjointNom: e.target.value })
                  }
                />
              </Field>
              <Field label="Date naissance conjoint">
                <input
                  type="date"
                  className={styles.assignSelect}
                  value={
                    (form as AgentSalaireEnrichment).conjointDateNaissance || ''
                  }
                  disabled={disabled}
                  onChange={(e) =>
                    patchSalaire({ conjointDateNaissance: e.target.value })
                  }
                />
              </Field>
            </>
          ) : null}
        </div>
      ) : (
        <>
          <h3 className={styles.detailTableTitle}>Éligibilité</h3>
          <div className={styles.enrichGrid}>
            {ELIG_FIELDS.map(({ key, label }) => (
              <Field key={key} label={label}>
                <select
                  className={styles.assignSelect}
                  value={
                    (form as AgentActiviteEnrichment).eligibilite[key]
                      ? 'oui'
                      : 'non'
                  }
                  disabled={disabled}
                  onChange={(e) =>
                    patchActivite({
                      eligibilite: {
                        ...(form as AgentActiviteEnrichment).eligibilite,
                        [key]: e.target.value === 'oui',
                      },
                    })
                  }
                >
                  <option value="non">Non</option>
                  <option value="oui">Oui</option>
                </select>
              </Field>
            ))}
          </div>

          <h3 className={styles.detailTableTitle}>Business</h3>
          <div className={styles.enrichGrid}>
            {(
              [
                ['nomBusiness', 'Nom du business'],
                ['adresseBusiness', 'Adresse physique'],
                ['dureeAdresse', 'Durée à cette adresse'],
                ['typeBusiness', 'Type de business'],
                ['dureeTypeBusiness', 'Durée de ce type'],
                ['secteurBusiness', 'Secteur'],
                ['formeJuridique', 'Forme juridique'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className={styles.assignSelect}
                  value={(form as AgentActiviteEnrichment).business[key]}
                  disabled={disabled}
                  onChange={(e) =>
                    patchActivite({
                      business: {
                        ...(form as AgentActiviteEnrichment).business,
                        [key]: e.target.value,
                      },
                    })
                  }
                />
              </Field>
            ))}
          </div>

          <h3 className={styles.detailTableTitle}>Prêt (compléments)</h3>
          <div className={styles.enrichGrid}>
            <Field label="But de l’investissement">
              <input
                className={styles.assignSelect}
                value={(form as AgentActiviteEnrichment).pret.butInvestissement}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    pret: {
                      ...(form as AgentActiviteEnrichment).pret,
                      butInvestissement: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Commentaire sur le but">
              <input
                className={styles.assignSelect}
                value={
                  (form as AgentActiviteEnrichment).pret.commentaireBut || ''
                }
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    pret: {
                      ...(form as AgentActiviteEnrichment).pret,
                      commentaireBut: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Montant prêt précédent">
              <input
                type="number"
                className={styles.assignSelect}
                value={
                  (form as AgentActiviteEnrichment).pret.montantPretPrecedent ===
                    '' ||
                  (form as AgentActiviteEnrichment).pret.montantPretPrecedent ==
                    null
                    ? ''
                    : String(
                        (form as AgentActiviteEnrichment).pret
                          .montantPretPrecedent,
                      )
                }
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    pret: {
                      ...(form as AgentActiviteEnrichment).pret,
                      montantPretPrecedent:
                        e.target.value === '' ? '' : Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field label="Durée prêt précédent">
              <input
                className={styles.assignSelect}
                value={
                  (form as AgentActiviteEnrichment).pret.dureePretPrecedent ||
                  ''
                }
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    pret: {
                      ...(form as AgentActiviteEnrichment).pret,
                      dureePretPrecedent: e.target.value,
                    },
                  })
                }
              />
            </Field>
          </div>

          {marie ? (
            <>
              <h3 className={styles.detailTableTitle}>Conjoint</h3>
              <div className={styles.enrichGrid}>
                <Field label="Conjoint (prénom et nom)">
                  <input
                    className={styles.assignSelect}
                    value={(form as AgentActiviteEnrichment).conjointNom || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      patchActivite({ conjointNom: e.target.value })
                    }
                  />
                </Field>
                <Field label="Date naissance conjoint">
                  <input
                    type="date"
                    className={styles.assignSelect}
                    value={
                      (form as AgentActiviteEnrichment).conjointDateNaissance ||
                      ''
                    }
                    disabled={disabled}
                    onChange={(e) =>
                      patchActivite({
                        conjointDateNaissance: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>
            </>
          ) : null}
        </>
      )}

      {!disabled ? (
        <div className={styles.assignRow} style={{ marginTop: 16 }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy}
            onClick={() => onSave(form)}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer les champs'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
