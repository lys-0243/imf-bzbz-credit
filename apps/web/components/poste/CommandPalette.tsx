'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { money, useFile } from '../../lib/poste';
import s from './poste.module.css';

export type ElementPalette = { label: string; href: string; groupe: string; detail?: string };

/** Palette Ctrl+K : dossiers de la file + navigation. */
export function CommandPalette({ base, navigation }: { base: string; navigation: ElementPalette[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  const file = useFile();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOuvert((o) => !o);
      } else if (e.key === 'Escape') {
        setOuvert(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (ouvert) {
      setQ('');
      setI(0);
      window.setTimeout(() => input.current?.focus(), 0);
    }
  }, [ouvert]);

  const elements = useMemo(() => {
    const t = q.trim().toLowerCase();
    const dossiers: ElementPalette[] = (file.data?.dossiers ?? []).map((d) => ({
      label: `${d.client.fullName} — ${d.reference}`,
      detail: `${d.etatLabel} · ${money(d.montantSouhaite, d.devise)}`,
      href: `/${base}/${d.id}`,
      groupe: d.aTraiter ? 'À traiter' : 'Dossiers',
    }));
    const tout = [...dossiers, ...navigation];
    return (t ? tout.filter((e) => `${e.label} ${e.detail ?? ''}`.toLowerCase().includes(t)) : tout).slice(0, 30);
  }, [q, file.data, navigation, base]);

  useEffect(() => setI(0), [q]);

  if (!ouvert) return null;
  const aller = (e: ElementPalette | undefined) => {
    if (!e) return;
    setOuvert(false);
    router.push(e.href);
  };
  let groupe = '';
  return (
    <div className={s.overlay} role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOuvert(false)}>
      <div className={s.palette} role="dialog" aria-modal="true" aria-label="Palette de commandes">
        <input
          ref={input}
          className={s.paletteInput}
          placeholder="Rechercher un dossier, une page…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setI((x) => Math.min(elements.length - 1, x + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setI((x) => Math.max(0, x - 1));
            } else if (e.key === 'Enter') {
              aller(elements[i]);
            }
          }}
          aria-label="Rechercher"
        />
        <div className={s.paletteList} role="listbox">
          {elements.length === 0 ? <p className={s.empty}>Aucun résultat</p> : null}
          {elements.map((e, k) => {
            const titre = e.groupe !== groupe ? (groupe = e.groupe) : null;
            return (
              <div key={`${e.href}-${k}`}>
                {titre ? <p className={s.paletteGroup}>{titre}</p> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={k === i}
                  className={`${s.paletteItem} ${k === i ? s.paletteItemActive : ''}`}
                  onMouseEnter={() => setI(k)}
                  onClick={() => aller(e)}
                >
                  <span>{e.label}</span>
                  {e.detail ? <span className={s.hint}>{e.detail}</span> : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
