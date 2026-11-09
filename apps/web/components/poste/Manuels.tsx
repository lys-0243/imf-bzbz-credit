'use client';

import { useEffect, useRef, useState } from 'react';
import { referenceSection, SOURCE_MANUEL_LABELS, type ExtraitManuel, type SourceManuel } from '@imf/shared';
import { ApiError, apiFetch } from '../../lib/api';
import { dateCourte, dateHeure, useApi } from '../../lib/poste';
import s from './poste.module.css';

type Manuel = {
  id: string;
  titre: string;
  source: SourceManuel;
  reference: string | null;
  version: string;
  dateEffet: string | null;
  actif: boolean;
  nomFichier: string | null;
  nbMots: number;
  updatedAt: string;
  _count: { sections: number };
};

function surligner(texte: string, q: string) {
  const mots = q
    .split(/\s+|OR/i)
    .map((m) => m.replace(/["']/g, '').trim())
    .filter((m) => m.length >= 3);
  if (!mots.length) return texte;
  const re = new RegExp(`(${mots.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return texte.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

/** Recherche plein texte dans les manuels actifs (analyste, conformité, décideurs). */
export function RechercheManuels() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  const res = useApi<Array<ExtraitManuel & { rang: number }>>(debounced ? `/manuels/recherche?q=${encodeURIComponent(debounced)}&limite=15` : null);
  const manuels = useApi<Manuel[]>('/manuels');
  const actifs = (manuels.data ?? []).filter((m) => m.actif);

  return (
    <div className={s.page}>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Manuels &amp; procédures</h1>
          <p className={s.pageSub}>
            {actifs.length} manuel(s) actif(s) — la même base sert au copilote de conformité. Astuce : « garantie OR caution », « "conseil d’administration" ».
          </p>
        </div>
      </div>
      <input
        className={s.search}
        style={{ maxWidth: 640 }}
        placeholder="Rechercher une règle, un article, un seuil…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Rechercher dans les manuels"
        autoFocus
      />
      {debounced ? (
        res.isLoading && !res.data ? (
          <div className={s.skeleton} style={{ height: 160 }} />
        ) : res.data?.length ? (
          <div className={s.stack} style={{ gap: 12 }}>
            {res.data.map((x) => (
              <article key={x.sectionId} className={s.card}>
                <div className={s.cardHead}>
                  <h2 className={s.cardTitle} style={{ fontSize: '0.95rem' }}>{referenceSection(x)}</h2>
                  <span className={s.chip}>{SOURCE_MANUEL_LABELS[x.source]} · v{x.version}</span>
                </div>
                <p className={s.quote} style={{ marginTop: 0 }}>
                  {surligner(x.contenu.length > 1400 ? `${x.contenu.slice(0, 1400)}…` : x.contenu, debounced)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className={s.empty}>Aucun passage ne correspond.</p>
        )
      ) : (
        <div className={s.grid3}>
          {actifs.map((m) => (
            <div key={m.id} className={s.card}>
              <p className={s.cardTitle}>{m.titre}</p>
              <p className={s.cardSub}>
                {SOURCE_MANUEL_LABELS[m.source]} · v{m.version} · {m._count.sections} sections
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Administration des manuels (ajout, activation, suppression). */
export function AdminManuels() {
  const manuels = useApi<Manuel[]>('/manuels');
  const [titre, setTitre] = useState('');
  const [source, setSource] = useState<SourceManuel>('IMF');
  const [version, setVersion] = useState('');
  const [reference, setReference] = useState('');
  const [dateEffet, setDateEffet] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const fichier = useRef<HTMLInputElement | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const sections = useApi<{ sections: Array<{ id: string; numero: string; titre: string; contenu: string }> }>(apercu ? `/manuels/${apercu}` : null);

  const ajouter = async () => {
    const f = fichier.current?.files?.[0];
    if (!f || !titre.trim() || !version.trim()) {
      setMsg({ ok: false, texte: 'Fichier, titre et version requis.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('titre', titre.trim());
      fd.append('source', source);
      fd.append('version', version.trim());
      if (reference.trim()) fd.append('reference', reference.trim());
      if (dateEffet) fd.append('dateEffet', dateEffet);
      const m = await apiFetch<Manuel>('/manuels', { method: 'POST', body: fd });
      setMsg({ ok: true, texte: `« ${m.titre} » indexé : ${m._count.sections} sections.` });
      setTitre('');
      setVersion('');
      setReference('');
      if (fichier.current) fichier.current.value = '';
      await manuels.mutate();
    } catch (e) {
      setMsg({ ok: false, texte: e instanceof ApiError ? e.message : 'Ajout impossible' });
    } finally {
      setBusy(false);
    }
  };

  const basculer = async (m: Manuel) => {
    await apiFetch(`/manuels/${m.id}/statut`, { method: 'PATCH', body: JSON.stringify({ actif: !m.actif }) });
    await manuels.mutate();
  };
  const supprimer = async (m: Manuel) => {
    if (!window.confirm(`Supprimer définitivement « ${m.titre} » (v${m.version}) ?`)) return;
    await apiFetch(`/manuels/${m.id}`, { method: 'DELETE' });
    await manuels.mutate();
  };

  return (
    <div className={s.page}>
      <div>
        <h1 className={s.pageTitle}>Manuels de procédures et instructions BCC</h1>
        <p className={s.pageSub}>
          Base documentaire du copilote de conformité. Les PDF doivent contenir du texte (pas de scan sans OCR). Désactivez une ancienne version
          plutôt que de la supprimer : les avis passés la citent.
        </p>
      </div>

      <section className={s.card}>
        <h2 className={s.cardTitle} style={{ marginBottom: 12 }}>Ajouter un document</h2>
        <div className={s.grid3}>
          <div className={s.field}>
            <label className={s.label} htmlFor="m-titre">Titre</label>
            <input id="m-titre" className={s.input} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Manuel de procédures de crédit" />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="m-src">Source</label>
            <select id="m-src" className={s.select} value={source} onChange={(e) => setSource(e.target.value as SourceManuel)}>
              <option value="IMF">{SOURCE_MANUEL_LABELS.IMF}</option>
              <option value="BCC">{SOURCE_MANUEL_LABELS.BCC}</option>
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="m-ver">Version</label>
            <input id="m-ver" className={s.input} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2026-1" />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="m-ref">Référence (optionnel)</label>
            <input id="m-ref" className={s.input} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Instruction n°…" />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="m-date">Date d’effet</label>
            <input id="m-date" type="date" className={s.input} value={dateEffet} onChange={(e) => setDateEffet(e.target.value)} />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="m-file">Fichier (PDF, DOCX, TXT — 25 Mo max)</label>
            <input id="m-file" ref={fichier} type="file" accept=".pdf,.docx,.txt,.md" className={s.input} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14 }}>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={busy} onClick={() => void ajouter()}>
            {busy ? 'Extraction et indexation…' : 'Ajouter et indexer'}
          </button>
          {msg ? <p className={msg.ok ? s.okText : s.errorText}>{msg.texte}</p> : null}
        </div>
      </section>

      <section className={s.card}>
        <h2 className={s.cardTitle} style={{ marginBottom: 12 }}>Documents</h2>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Source</th>
              <th>Version</th>
              <th className={s.num}>Sections</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(manuels.data ?? []).map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.titre}</strong>
                  <div className={s.hint}>
                    {m.nomFichier ?? '—'} · {m.nbMots.toLocaleString('fr-FR')} mots · maj {dateCourte(m.updatedAt)}
                    {m.dateEffet ? ` · effet ${dateCourte(m.dateEffet)}` : ''}
                  </div>
                </td>
                <td>{SOURCE_MANUEL_LABELS[m.source]}</td>
                <td>{m.version}</td>
                <td className={s.num}>{m._count.sections}</td>
                <td>
                  <span className={`${s.chip} ${m.actif ? s.chipGreen : ''}`}>{m.actif ? '✓ actif' : 'inactif'}</span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setApercu(apercu === m.id ? null : m.id)}>
                    Sections
                  </button>
                  <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => void basculer(m)}>
                    {m.actif ? 'Désactiver' : 'Activer'}
                  </button>
                  <button type="button" className={`${s.btn} ${s.btnGhost}`} style={{ color: 'var(--imf-red)' }} onClick={() => void supprimer(m)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {apercu && sections.data ? (
          <div className={s.stack} style={{ gap: 8, marginTop: 14 }}>
            <p className={s.iaLabel}>Découpage — {sections.data.sections.length} sections</p>
            {sections.data.sections.slice(0, 40).map((x) => (
              <details key={x.id} className={s.item} style={{ gridTemplateColumns: '1fr' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                  {[x.numero, x.titre].filter(Boolean).join(' : ') || '(sans titre)'}
                </summary>
                <p className={s.quote}>{x.contenu}</p>
              </details>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

type Envoi = {
  id: string;
  statut: 'EN_ATTENTE' | 'ENVOYE' | 'ECHEC';
  tentatives: number;
  dernierMessage: string | null;
  prochainEssaiAt: string;
  envoyeAt: string | null;
  updatedAt: string;
  payload: { montant: number | null; devise: string | null; dureeMois?: number | null; numeroCompte: string };
  dossier: { id: string; reference: string; client: { fullName: string } };
};

export function AdminEnvoisCbs() {
  const envois = useApi<Envoi[]>('/banking/envois', { refreshInterval: 15_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const relancer = async (id: string) => {
    setBusy(id);
    setErreur(null);
    try {
      await apiFetch(`/banking/envois/${id}/relancer`, { method: 'POST' });
      await envois.mutate();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Relance impossible');
    } finally {
      setBusy(null);
    }
  };
  const chip = { ENVOYE: s.chipGreen, ECHEC: s.chipRed, EN_ATTENTE: s.chipAmber } as const;
  const libelle = { ENVOYE: '✓ envoyé', ECHEC: '✕ échec', EN_ATTENTE: 'en file' } as const;
  return (
    <div className={s.page}>
      <div>
        <h1 className={s.pageTitle}>Envois au core banking</h1>
        <p className={s.pageSub}>
          Chaque crédit accordé est transmis au CBS ; en cas d’échec, la plateforme réessaie automatiquement (jusqu’à 8 fois) puis attend une
          relance manuelle.
        </p>
      </div>
      {erreur ? <p className={s.errorText}>{erreur}</p> : null}
      <section className={s.card}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Dossier</th>
              <th className={s.num}>Montant</th>
              <th>Statut</th>
              <th>Dernier message</th>
              <th>Mise à jour</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(envois.data ?? []).map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.dossier.client.fullName}</strong>
                  <div className={s.hint}>
                    {e.dossier.reference} · compte {e.payload.numeroCompte || '—'}
                  </div>
                </td>
                <td className={s.num}>
                  {e.payload.montant?.toLocaleString('fr-FR') ?? '—'} {e.payload.devise ?? ''}
                </td>
                <td>
                  <span className={`${s.chip} ${chip[e.statut]}`}>{libelle[e.statut]}</span>
                  <div className={s.hint}>{e.tentatives} tentative(s)</div>
                </td>
                <td style={{ maxWidth: 320 }}>{e.dernierMessage ?? '—'}</td>
                <td>{dateHeure(e.envoyeAt ?? e.updatedAt)}</td>
                <td>
                  {e.statut !== 'ENVOYE' ? (
                    <button type="button" className={`${s.btn} ${s.btnSecondary} ${s.btnSmall}`} disabled={busy === e.id} onClick={() => void relancer(e.id)}>
                      {busy === e.id ? 'Relance…' : 'Relancer'}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {envois.data && !envois.data.length ? <p className={s.empty}>Aucun envoi pour l’instant.</p> : null}
      </section>
    </div>
  );
}
