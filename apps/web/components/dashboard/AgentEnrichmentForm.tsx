'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ETAT_CIVIL_LABELS,
  ETATS_CIVILS,
  PRET_AUTRE_INSTITUTION,
  SEXES,
  TYPE_PIECE_LABELS,
  TYPES_PIECE,
  enrichmentFromPayload,
  type AgentActiviteEnrichment,
  type AgentSalaireEnrichment,
  type FamilleProduit,
} from '@imf/shared';
import { ApiError } from '../../lib/api';
import { useToast } from '../Toast';
import { dashStyles as styles } from './DashboardShell';

type Props = {
  famille: FamilleProduit;
  etatCivil?: string;
  payload: Record<string, any> | null | undefined;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
  hint?: string;
  onSave: (
    enrichment: AgentSalaireEnrichment | AgentActiviteEnrichment,
  ) => void | Promise<void>;
};

const ELIG_FIELDS: Array<{
  key: keyof AgentActiviteEnrichment['eligibilite'];
  label: string;
}> = [
  { key: 'age18OuPlus', label: 'Le demandeur a-t-il 18 ans ou plus?' },
  {
    key: 'congolaisOuDomiciile',
    label: 'Est-il Congolais / étranger domicilié dans le pays?',
  },
  {
    key: 'proprietaireActivite',
    label:
      'Est-il propriétaire de l’activité commerciale? (Personne Morale ou Physique)',
  },
  {
    key: 'activiteZoneOperationnelle',
    label: 'L’activité se trouve-t-elle dans une zone opérationnelle?',
  },
  {
    key: 'exerceActiviteActuellement',
    label: 'Exerce-t-il actuellement l’activité?',
  },
  {
    key: 'activite6MoisConsecutifs',
    label:
      '…et l’a-t-il exercé de manière consécutive au cours des 6 derniers mois?',
  },
  {
    key: 'activiteListeExclusion',
    label: "L'activité est-elle dans la liste d'exclusion de l'IMF?",
  },
  {
    key: 'activiteEnregistreeLegalement',
    label: "L'activité est-elle enregistrée légalement?",
  },
  {
    key: 'clientListeNoire',
    label: 'Le client est-il sur la liste noire ?',
  },
  {
    key: 'garantListeNoire',
    label: 'Le garant est-il sur la liste noire ?',
  },
  {
    key: 'codebiteurListeNoire',
    label: 'Le codebiteur est-il sur la liste noire ?',
  },
];

function FormSection({
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

function numInputValue(v: number | '' | undefined | null): string {
  if (v === '' || v == null) return '';
  return String(v);
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

export function AgentEnrichmentForm({
  famille,
  etatCivil,
  payload,
  disabled,
  busy,
  title,
  hint,
  onSave,
}: Props) {
  const [form, setForm] = useState(() =>
    enrichmentFromPayload(famille, payload),
  );
  const toast = useToast();

  const payloadSyncKey = useMemo(
    () => JSON.stringify(enrichmentFromPayload(famille, payload)),
    [famille, payload],
  );

  useEffect(() => {
    setForm(enrichmentFromPayload(famille, payload));
    // Sync only when server enrichment content changes (not on every parent render).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- payloadSyncKey captures payload+famille
  }, [payloadSyncKey]);

  function patchSalaire(partial: Partial<AgentSalaireEnrichment>) {
    setForm((prev) => ({ ...(prev as AgentSalaireEnrichment), ...partial }));
  }

  function patchActivite(partial: Partial<AgentActiviteEnrichment>) {
    setForm((prev) => ({ ...(prev as AgentActiviteEnrichment), ...partial }));
  }

  async function handleSave() {
    try {
      await onSave(form);
      toast.success(
        famille === 'ACTIVITE' ? 'CF1 enregistrée.' : 'Dossier enregistré.',
      );
    } catch (e) {
      toast.error(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Échec enregistrement',
      );
    }
  }

  const activite = form as AgentActiviteEnrichment;
  const devise = String(
    (payload as Record<string, any> | null | undefined)?.devise ||
      (payload as Record<string, any> | null | undefined)?.pret?.devise ||
      'USD',
  );
  /** CF1 demandeur prime sur l’état civil d’inscription. */
  const etatCivilCourant =
    (famille === 'ACTIVITE' ? activite.demandeur?.etatCivil : undefined) ||
    etatCivil ||
    '';
  const marie = etatCivilCourant === 'Marie';

  return (
    <div className={styles.assignPanel}>
      <h2 className={styles.assignTitle}>
        {title ??
          (famille === 'ACTIVITE'
            ? 'CF1 — Demande de prêt'
            : 'Compléter le dossier')}
      </h2>
      <p className={styles.assignHint}>
        {hint ??
          (famille === 'ACTIVITE'
            ? 'Vous pouvez enregistrer au fur et à mesure : aucun champ n’est obligatoire à cette étape. La complétude sera vérifiée à la soumission.'
            : 'Enregistrez progressivement les informations. La complétude sera vérifiée à la soumission.')}
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
          <FormSection title="1. Éligibilité (demande)">
            {ELIG_FIELDS.map(({ key, label }) => (
              <FormRow key={key} label={label}>
                <select
                  className={styles.cf1FormControl}
                  value={activite.eligibilite[key] ? 'oui' : 'non'}
                  disabled={disabled}
                  onChange={(e) =>
                    patchActivite({
                      eligibilite: {
                        ...activite.eligibilite,
                        [key]: e.target.value === 'oui',
                      },
                    })
                  }
                >
                  <option value="non">Non</option>
                  <option value="oui">Oui</option>
                </select>
              </FormRow>
            ))}
          </FormSection>

          <FormSection title="2. Information sur le demandeur">
            <FormRow label="Prénom">
              <input
                className={styles.cf1FormControl}
                value={activite.demandeur.prenom}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    demandeur: { ...activite.demandeur, prenom: e.target.value },
                  })
                }
              />
            </FormRow>
            <FormRow label="Nom de famille">
              <input
                className={styles.cf1FormControl}
                value={activite.demandeur.nom}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    demandeur: { ...activite.demandeur, nom: e.target.value },
                  })
                }
              />
            </FormRow>
            <FormRow label="Post-nom">
              <input
                className={styles.cf1FormControl}
                value={activite.demandeur.postNom}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    demandeur: {
                      ...activite.demandeur,
                      postNom: e.target.value,
                    },
                  })
                }
              />
            </FormRow>
            
            <FormRow label="Date de naissance">
              <input
                type="date"
                className={styles.cf1FormControl}
                value={activite.demandeur.dateNaissance || ''}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    demandeur: {
                      ...activite.demandeur,
                      dateNaissance: e.target.value,
                    },
                  })
                }
              />
            </FormRow>
            <FormRow label="Type d'identité">
              <select
                className={styles.cf1FormControl}
                value={activite.demandeur.typePiece}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    demandeur: {
                      ...activite.demandeur,
                      typePiece: e.target.value,
                    },
                  })
                }
              >
                <option value="">—</option>
                {TYPES_PIECE.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_PIECE_LABELS[t]}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="N° de la pièce d'identité">
              <input
                className={styles.cf1FormControl}
                value={activite.demandeur.numeroPiece}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    demandeur: {
                      ...activite.demandeur,
                      numeroPiece: e.target.value,
                    },
                  })
                }
              />
            </FormRow>
            <FormRow label="Sexe (M / F)">
              <select
                className={styles.cf1FormControl}
                value={activite.demandeur.sexe}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    demandeur: { ...activite.demandeur, sexe: e.target.value },
                  })
                }
              >
                <option value="">—</option>
                {SEXES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="État-civil">
              <select
                className={styles.cf1FormControl}
                value={activite.demandeur.etatCivil}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.value;
                  const keepConjoint = next === 'Marie';
                  patchActivite({
                    demandeur: {
                      ...activite.demandeur,
                      etatCivil: next,
                      ...(keepConjoint
                        ? {}
                        : {
                            conjointPrenom: '',
                            conjointPostNom: '',
                            conjointNom: '',
                            conjointDateNaissance: '',
                          }),
                    },
                    conjointNom: keepConjoint
                      ? activite.demandeur.conjointNom || activite.conjointNom
                      : '',
                    conjointDateNaissance: keepConjoint
                      ? activite.demandeur.conjointDateNaissance ||
                        activite.conjointDateNaissance
                      : '',
                  });
                }}
              >
                <option value="">—</option>
                {ETATS_CIVILS.map((c) => (
                  <option key={c} value={c}>
                    {ETAT_CIVIL_LABELS[c]}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Adresse du domicile">
              <input
                className={styles.cf1FormControl}
                value={activite.demandeur.adresseDomicile}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    demandeur: {
                      ...activite.demandeur,
                      adresseDomicile: e.target.value,
                    },
                  })
                }
              />
            </FormRow>
            <FormRow label="Téléphone(s)">
              <input
                className={styles.cf1FormControl}
                value={activite.demandeur.telephone}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    demandeur: {
                      ...activite.demandeur,
                      telephone: e.target.value,
                    },
                  })
                }
              />
            </FormRow>
            <FormRow label="E-mail">
              <input
                className={styles.cf1FormControl}
                value={activite.demandeur.email || ''}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    demandeur: { ...activite.demandeur, email: e.target.value },
                  })
                }
              />
            </FormRow>
            {marie ? (
              <>
                <FormRow label="Prénom (conjoint(e))">
                  <input
                    className={styles.cf1FormControl}
                    value={activite.demandeur.conjointPrenom || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      patchActivite({
                        demandeur: {
                          ...activite.demandeur,
                          conjointPrenom: e.target.value,
                        },
                      })
                    }
                  />
                </FormRow>
                <FormRow label="Nom de famille (conjoint(e))">
                  <input
                    className={styles.cf1FormControl}
                    value={
                      activite.demandeur.conjointNom ||
                      activite.conjointNom ||
                      ''
                    }
                    disabled={disabled}
                    onChange={(e) =>
                      patchActivite({
                        demandeur: {
                          ...activite.demandeur,
                          conjointNom: e.target.value,
                        },
                        conjointNom: e.target.value,
                      })
                    }
                  />
                </FormRow>
                <FormRow label="Post-nom (conjoint(e))">
                  <input
                    className={styles.cf1FormControl}
                    value={activite.demandeur.conjointPostNom || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      patchActivite({
                        demandeur: {
                          ...activite.demandeur,
                          conjointPostNom: e.target.value,
                        },
                      })
                    }
                  />
                </FormRow>
                
                <FormRow label="Date de naissance (conjoint(e))">
                  <input
                    type="date"
                    className={styles.cf1FormControl}
                    value={
                      activite.demandeur.conjointDateNaissance ||
                      activite.conjointDateNaissance ||
                      ''
                    }
                    disabled={disabled}
                    onChange={(e) =>
                      patchActivite({
                        demandeur: {
                          ...activite.demandeur,
                          conjointDateNaissance: e.target.value,
                        },
                        conjointDateNaissance: e.target.value,
                      })
                    }
                  />
                </FormRow>
              </>
            ) : null}
          </FormSection>

          <FormSection title="3. Information sur le business">
            {(
              [
                ['nomBusiness', 'Nom du business'],
                ['adresseBusiness', 'Adresse physique du business'],
                ['dureeAdresse', "Durée d'existence à cette adresse"],
                ['typeBusiness', 'Type de business'],
                [
                  'dureeTypeBusiness',
                  "Durée d'existence de ce type de business",
                ],
                ['secteurBusiness', 'Secteur de business'],
                ['formeJuridique', 'Forme juridique'],
              ] as const
            ).map(([key, label]) => (
              <FormRow key={key} label={label}>
                <input
                  className={styles.cf1FormControl}
                  value={activite.business[key]}
                  disabled={disabled}
                  onChange={(e) =>
                    patchActivite({
                      business: {
                        ...activite.business,
                        [key]: e.target.value,
                      },
                    })
                  }
                />
              </FormRow>
            ))}
          </FormSection>

          <FormSection title="4. Prêt sollicité">
            <FormRow label="Montant désiré">
              <AmountField
                value={numInputValue(activite.pret.montantDesire)}
                devise={devise}
                disabled={disabled}
                onChange={(raw) =>
                  patchActivite({
                    pret: {
                      ...activite.pret,
                      montantDesire: raw === '' ? '' : Number(raw),
                    },
                  })
                }
              />
            </FormRow>
            <FormRow label="Durée de prêt (mois)">
              <input
                type="number"
                className={styles.cf1FormControl}
                value={numInputValue(activite.pret.dureeMois)}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    pret: {
                      ...activite.pret,
                      dureeMois:
                        e.target.value === '' ? '' : Number(e.target.value),
                    },
                  })
                }
              />
            </FormRow>
            <FormRow label="Combien pouvez-vous facilement payer chaque mois?">
              <AmountField
                value={numInputValue(activite.pret.capaciteMensuelle)}
                devise={devise}
                disabled={disabled}
                onChange={(raw) =>
                  patchActivite({
                    pret: {
                      ...activite.pret,
                      capaciteMensuelle: raw === '' ? '' : Number(raw),
                    },
                  })
                }
              />
            </FormRow>
            <FormRow label="But de l'investissement">
              <input
                className={styles.cf1FormControl}
                value={activite.pret.butInvestissement}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    pret: {
                      ...activite.pret,
                      butInvestissement: e.target.value,
                    },
                  })
                }
              />
            </FormRow>
            <FormRow label="Commentaire sur le but de l'investissement">
              <input
                className={styles.cf1FormControl}
                value={activite.pret.commentaireBut || ''}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    pret: {
                      ...activite.pret,
                      commentaireBut: e.target.value,
                    },
                  })
                }
              />
            </FormRow>
            <FormRow label="Prêt auprès d’une autre institution financière">
              <select
                className={styles.cf1FormControl}
                value={activite.pret.pretAutreInstitution || ''}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    pret: {
                      ...activite.pret,
                      pretAutreInstitution: e.target.value,
                    },
                  })
                }
              >
                <option value="">—</option>
                {PRET_AUTRE_INSTITUTION.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </FormRow>
            {activite.pret.pretAutreInstitution &&
            activite.pret.pretAutreInstitution !== 'Non' ? (
              <FormRow label="…auprès de">
                <input
                  className={styles.cf1FormControl}
                  value={activite.pret.autreInstitutionNom || ''}
                  disabled={disabled}
                  onChange={(e) =>
                    patchActivite({
                      pret: {
                        ...activite.pret,
                        autreInstitutionNom: e.target.value,
                      },
                    })
                  }
                />
              </FormRow>
            ) : null}
            <FormRow label="Montant du prêt précédent">
              <AmountField
                value={numInputValue(activite.pret.montantPretPrecedent)}
                devise={devise}
                disabled={disabled}
                onChange={(raw) =>
                  patchActivite({
                    pret: {
                      ...activite.pret,
                      montantPretPrecedent: raw === '' ? '' : Number(raw),
                    },
                  })
                }
              />
            </FormRow>
            <FormRow label="Durée prêt précédent">
              <input
                className={styles.cf1FormControl}
                value={activite.pret.dureePretPrecedent || ''}
                disabled={disabled}
                onChange={(e) =>
                  patchActivite({
                    pret: {
                      ...activite.pret,
                      dureePretPrecedent: e.target.value,
                    },
                  })
                }
              />
            </FormRow>
          </FormSection>
        </>
      )}

      {!disabled ? (
        <div className={styles.assignRow} style={{ marginTop: 16 }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy}
            onClick={() => void handleSave()}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer les champs'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
