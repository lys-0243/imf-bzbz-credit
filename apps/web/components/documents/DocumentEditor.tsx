'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import {
  DOCUMENT_EDITABLE_LABELS,
  genererDocumentHtml,
  type DocumentEditable,
  type DossierContexte,
} from '@imf/shared';
import { ApiError, apiFetch, getApiUrl, getToken } from '../../lib/api';
import { useToast } from '../Toast';
import { docStyles as styles } from './DocumentKit';

/** Réponse de GET /instruction/dossiers/:id/documents/:doc. */
type DocumentServeur = {
  contenuHtml: string | null;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  editable: boolean;
};

/** Clé de la page d’impression /documents/[id]/[doc]. */
const CLE_IMPRESSION: Record<DocumentEditable, string> = {
  LETTRE: 'lettre',
  CONTRAT: 'contrat',
  GAGE: 'gage',
  CAUTION: 'caution',
};

function ToolBtn({
  label,
  title,
  active = false,
  disabled = false,
  onClick,
}: {
  label: ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
      // Garde la sélection dans l’éditeur au clic.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function BarreOutils({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      table: e.isActive('table'),
      bloc: e.isActive('heading', { level: 1 })
        ? 'h1'
        : e.isActive('heading', { level: 2 })
          ? 'h2'
          : e.isActive('heading', { level: 3 })
            ? 'h3'
            : 'p',
      align: (['left', 'center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();

  return (
    <div className={styles.editorToolbar} role="toolbar" aria-label="Mise en forme">
      <ToolBtn label="↶" title="Annuler" disabled={!s.undo} onClick={() => c().undo().run()} />
      <ToolBtn label="↷" title="Rétablir" disabled={!s.redo} onClick={() => c().redo().run()} />
      <span className={styles.toolSep} />
      <select
        className={styles.toolSelect}
        value={s.bloc}
        aria-label="Style de paragraphe"
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'p') c().setParagraph().run();
          else c().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
        }}
      >
        <option value="p">Normal</option>
        <option value="h1">Titre 1</option>
        <option value="h2">Titre 2</option>
        <option value="h3">Titre 3</option>
      </select>
      <span className={styles.toolSep} />
      <ToolBtn label={<strong>G</strong>} title="Gras" active={s.bold} onClick={() => c().toggleBold().run()} />
      <ToolBtn label={<em>I</em>} title="Italique" active={s.italic} onClick={() => c().toggleItalic().run()} />
      <ToolBtn label={<u>S</u>} title="Souligné" active={s.underline} onClick={() => c().toggleUnderline().run()} />
      <ToolBtn label={<s>ab</s>} title="Barré" active={s.strike} onClick={() => c().toggleStrike().run()} />
      <span className={styles.toolSep} />
      <ToolBtn label="• ≡" title="Liste à puces" active={s.bullet} onClick={() => c().toggleBulletList().run()} />
      <ToolBtn label="1. ≡" title="Liste numérotée" active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
      <span className={styles.toolSep} />
      <ToolBtn label="⯇" title="Aligner à gauche" active={s.align === 'left'} onClick={() => c().setTextAlign('left').run()} />
      <ToolBtn label="≡" title="Centrer" active={s.align === 'center'} onClick={() => c().setTextAlign('center').run()} />
      <ToolBtn label="⯈" title="Aligner à droite" active={s.align === 'right'} onClick={() => c().setTextAlign('right').run()} />
      <ToolBtn label="☰" title="Justifier" active={s.align === 'justify'} onClick={() => c().setTextAlign('justify').run()} />
      <span className={styles.toolSep} />
      <ToolBtn
        label="⊞ Tableau"
        title="Insérer un tableau (3 × 3)"
        onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      />
      <ToolBtn label="+ Ligne" title="Ajouter une ligne en dessous" disabled={!s.table} onClick={() => c().addRowAfter().run()} />
      <ToolBtn label="− Ligne" title="Supprimer la ligne" disabled={!s.table} onClick={() => c().deleteRow().run()} />
      <ToolBtn label="+ Col." title="Ajouter une colonne à droite" disabled={!s.table} onClick={() => c().addColumnAfter().run()} />
      <ToolBtn label="− Col." title="Supprimer la colonne" disabled={!s.table} onClick={() => c().deleteColumn().run()} />
      <ToolBtn label="✕ Tableau" title="Supprimer le tableau" disabled={!s.table} onClick={() => c().deleteTable().run()} />
      <span className={styles.toolSep} />
      <ToolBtn label="―" title="Insérer un séparateur" onClick={() => c().setHorizontalRule().run()} />
    </div>
  );
}

function EditeurTipTap({
  initialHtml,
  editable,
  onUpdate,
  onReady,
}: {
  initialHtml: string;
  editable: boolean;
  onUpdate: (html: string) => void;
  onReady: (editor: Editor | null) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      TableKit.configure({ table: { resizable: true } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: initialHtml,
    editable,
    immediatelyRender: false,
    editorProps: { attributes: { class: styles.docContent, spellcheck: 'true', lang: 'fr' } },
    onUpdate: ({ editor: e }) => onUpdate(e.getHTML()),
  });

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return <p className={styles.muted}>Chargement de l’éditeur…</p>;
  return (
    <>
      {editable ? <BarreOutils editor={editor} /> : null}
      <article className={styles.page}>
        <EditorContent editor={editor} />
      </article>
    </>
  );
}

/**
 * Éditeur « Word » d’un document juridique : pré-rempli depuis le dossier
 * (ou la version enregistrée), modifiable par RC / DG / admin selon l’étape.
 */
export function DocumentEditor({
  dossierId,
  doc,
  ctx,
  brouillon,
  onBrouillon,
}: {
  dossierId: string;
  doc: DocumentEditable;
  ctx: DossierContexte;
  /** Modifications non enregistrées conservées entre onglets. */
  brouillon?: string;
  onBrouillon: (html: string | undefined) => void;
}) {
  const toast = useToast();
  const [serveur, setServeur] = useState<DocumentServeur | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [instance, setInstance] = useState(0);
  const url = `/instruction/dossiers/${dossierId}/documents/${doc.toLowerCase()}`;

  useEffect(() => {
    let annule = false;
    setServeur(null);
    setErreur(null);
    apiFetch<DocumentServeur>(url)
      .then((s) => {
        if (!annule) setServeur(s);
      })
      .catch((e) => {
        if (!annule) setErreur(e instanceof ApiError ? e.message : 'Document indisponible');
      });
    return () => {
      annule = true;
    };
  }, [url]);

  if (erreur) return <p className={styles.muted}>{erreur}</p>;
  if (!serveur) return <p className={styles.muted}>Chargement du document…</p>;

  const genere = () => genererDocumentHtml(doc, ctx);
  const initialHtml = brouillon ?? serveur.contenuHtml ?? genere();
  const modifie = brouillon !== undefined;

  async function enregistrer() {
    if (!editor || !serveur) return;
    setBusy(true);
    try {
      const s = await apiFetch<DocumentServeur>(url, {
        method: 'PUT',
        body: JSON.stringify({ contenuHtml: editor.getHTML(), version: serveur.version }),
      });
      setServeur(s);
      onBrouillon(undefined);
      toast.success(`${DOCUMENT_EDITABLE_LABELS[doc]} enregistré (version ${s.version}).`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Échec de l’enregistrement');
    } finally {
      setBusy(false);
    }
  }

  async function regenerer() {
    if (!serveur) return;
    if (serveur.contenuHtml) {
      if (!window.confirm(`Supprimer la version modifiée (v${serveur.version}) et revenir au document généré depuis le dossier ?`)) return;
      setBusy(true);
      try {
        setServeur(await apiFetch<DocumentServeur>(url, { method: 'DELETE' }));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Réinitialisation impossible');
        setBusy(false);
        return;
      }
      setBusy(false);
    } else if (modifie && !window.confirm('Abandonner vos modifications et régénérer le document depuis le dossier ?')) {
      return;
    }
    onBrouillon(undefined);
    setInstance((n) => n + 1);
    toast.success('Document régénéré depuis les données du dossier.');
  }

  function exiger(action: () => void) {
    if (modifie) {
      toast.error('Enregistrez vos modifications avant d’imprimer ou d’exporter.');
      return;
    }
    action();
  }

  async function exporterWord() {
    setBusy(true);
    try {
      const token = getToken();
      const res = await fetch(`${getApiUrl()}${url}/docx`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new ApiError(res.status, await res.text());
      const nom =
        /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('content-disposition') || '')?.[1] ??
        `${doc.toLowerCase()}_${ctx.reference}.docx`;
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(await res.blob());
      lien.download = decodeURIComponent(nom);
      lien.click();
      setTimeout(() => URL.revokeObjectURL(lien.href), 60_000);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Export Word impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.editorShell}>
      <div className={styles.editorActions}>
        <span className={styles.muted}>
          {modifie
            ? 'Modifications non enregistrées'
            : serveur.contenuHtml
              ? `Version ${serveur.version} — modifiée le ${new Date(serveur.updatedAt ?? '').toLocaleString('fr-FR')}${serveur.updatedBy ? ` par ${serveur.updatedBy}` : ''}`
              : 'Document généré depuis le dossier (non modifié)'}
          {!serveur.editable ? ' — lecture seule' : ''}
        </span>
        <div className={styles.editorActionsBtns}>
          {serveur.editable ? (
            <>
              <button type="button" className={styles.toolBtn} disabled={busy} onClick={() => void regenerer()}>
                Régénérer depuis le dossier
              </button>
              <button
                type="button"
                className={`${styles.toolBtn} ${styles.toolBtnPrimary}`}
                disabled={busy || !modifie}
                onClick={() => void enregistrer()}
              >
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => exiger(() => window.open(`/documents/${dossierId}/${CLE_IMPRESSION[doc]}`, '_blank', 'noopener'))}
          >
            Imprimer / PDF
          </button>
          <button type="button" className={styles.toolBtn} disabled={busy} onClick={() => exiger(() => void exporterWord())}>
            Exporter en Word (.docx)
          </button>
        </div>
      </div>
      <EditeurTipTap
        key={`${doc}-${instance}`}
        initialHtml={initialHtml}
        editable={serveur.editable}
        onUpdate={(html) => onBrouillon(html)}
        onReady={setEditor}
      />
    </div>
  );
}
