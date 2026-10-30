'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  buildDocumentsContexte,
  genererDocumentHtml,
  isDocumentEditable,
  normalizeCf2Analyse,
  normalizeParametresImf,
  type DossierContexte,
  type ParametresImf,
} from '@imf/shared';
import AuthGate from '../../../../components/AuthGate';
import { PageError, PageLoading, PageStateBlock } from '../../../../components/dashboard/PageState';
import { Cf61Fiche } from '../../../../components/dashboard/fiches/Cf61Fiche';
import { DOCUMENTS_IMPRIMABLES, type DocumentKey } from '../../../../components/dashboard/fiches/DocumentsFiche';
import type { DossierInstruction } from '../../../../components/dashboard/fiches/FichesPanel';
import { FormulaireAnalyseView } from '../../../../components/dashboard/fiches/FormulaireAnalyseView';
import { DocHeader, docStyles as styles } from '../../../../components/documents/DocumentKit';
import { DocumentTransfert, MemoPca, PvComite } from '../../../../components/documents/Documents';
import { ApiError, apiFetch } from '../../../../lib/api';

const ROLES = ['AGENT', 'RESPONSABLE_CREDIT', 'ANALYSTE', 'CONFORMITE', 'DG', 'CA', 'ADMIN'];

function DocumentLoader({ id, docKey }: { id: string; docKey: string }) {
  const [ctx, setCtx] = useState<DossierContexte | null>(null);
  /** Version retouchée dans l’éditeur (lettre, contrat, gage, caution) ; null = générée. */
  const [htmlEdite, setHtmlEdite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const docEditable = docKey.toUpperCase();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<DossierInstruction>(`/instruction/dossiers/${id}`),
      apiFetch<ParametresImf>('/parametres'),
      isDocumentEditable(docEditable)
        ? apiFetch<{ contenuHtml: string | null }>(`/instruction/dossiers/${id}/documents/${docKey}`)
        : Promise.resolve(null),
    ])
      .then(([d, p, edite]) => {
        if (cancelled) return;
        setHtmlEdite(edite?.contenuHtml ?? null);
        setCtx({
          id: d.id,
          reference: d.reference,
          etat: d.etat,
          createdAt: d.createdAt,
          produit: d.produit,
          payload: d.payload ?? {},
          client: d.client,
          agent: d.agent,
          analyse: d.analyseCf2 ? normalizeCf2Analyse(d.analyseCf2) : null,
          formulaires: d.formulaires,
          parametres: normalizeParametresImf(p),
          nouveauClient: d.nouveauClient,
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Document indisponible');
      });
    return () => {
      cancelled = true;
    };
  }, [id, docKey, docEditable]);

  const meta = DOCUMENTS_IMPRIMABLES.find((d) => d.key === docKey);
  if (!meta) {
    return (
      <PageStateBlock>
        <PageError title="Document inconnu" message={docKey} />
      </PageStateBlock>
    );
  }
  if (error) {
    return (
      <PageStateBlock>
        <PageError title="Document indisponible" message={error} />
      </PageStateBlock>
    );
  }
  if (!ctx) {
    return (
      <PageStateBlock>
        <PageLoading title="Préparation du document" detail={meta.label} />
      </PageStateBlock>
    );
  }

  const doc = buildDocumentsContexte(ctx);
  const props = { ctx, doc };
  const devise = doc.devise;
  // Lettre, contrat, gage et caution : HTML éditable (voir plus bas).
  const contenu: Partial<Record<DocumentKey, React.ReactNode>> = {
    transfert: <DocumentTransfert {...props} />,
    'pv-comite': <PvComite {...props} />,
    'memo-pca': <MemoPca {...props} />,
    'formulaire-analyse': (
      <>
        <DocHeader institution={ctx.parametres.institution} />
        <h1 className={styles.title}>Formulaire d’analyse de prêt IL</h1>
        <FormulaireAnalyseView ctx={ctx} />
      </>
    ),
    'cf6-1': (
      <>
        <DocHeader institution={ctx.parametres.institution} />
        <h1 className={styles.title}>Décision de prêt (CF6.1)</h1>
        <Cf61Fiche value={ctx.formulaires.CF6_1} onChange={() => {}} disabled ctx={ctx} devise={devise} />
      </>
    ),
  };

  return (
    <div className={styles.screen}>
      <div className={`${styles.toolbar} ${styles.noPrint}`}>
        <p className={styles.toolbarTitle}>
          {meta.label} — {ctx.reference}
        </p>
        <button type="button" className={styles.printBtn} onClick={() => window.print()}>
          Imprimer / PDF
        </button>
      </div>
      <article className={styles.page}>
        {isDocumentEditable(docEditable) ? (
          // HTML nettoyé par l’API à l’enregistrement, ou généré avec échappement.
          <div
            className={styles.docContent}
            dangerouslySetInnerHTML={{ __html: htmlEdite ?? genererDocumentHtml(docEditable, ctx) }}
          />
        ) : (
          contenu[meta.key]
        )}
      </article>
    </div>
  );
}

export default function DocumentPage() {
  const params = useParams();
  return (
    <AuthGate roles={ROLES} hideSession>
      <DocumentLoader id={String(params.id)} docKey={String(params.doc)} />
    </AuthGate>
  );
}
