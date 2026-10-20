import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export interface SqlEditorHandle {
  getText: () => string;
  /** Выделенный фрагмент или весь текст. */
  getSelectionOrAll: () => string;
  setText: (s: string) => void;
  focus: () => void;
  gotoPosition: (pos: number) => void;
}

interface Props {
  value: string;
  onChange?: (v: string) => void;
  onRun?: () => void;
  completion?: Record<string, string[]>;
  readOnly?: boolean;
  placeholderText?: string;
  className?: string;
}

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: 'rgb(var(--accent))', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: 'rgb(var(--warn))' },
  { tag: [t.number, t.bool, t.null], color: 'rgb(var(--info))' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'rgb(var(--muted))', fontStyle: 'italic' },
  { tag: [t.typeName, t.standard(t.name)], color: 'rgb(var(--ok))' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'rgb(var(--info))' },
  { tag: [t.punctuation, t.operator], color: 'rgb(var(--muted))' },
]);

const theme = EditorView.theme({
  '&': { color: 'rgb(var(--ink))' },
  '.cm-content': { caretColor: 'rgb(var(--accent))', padding: '10px 0' },
  '.cm-cursor': { borderLeftColor: 'rgb(var(--accent))' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgb(var(--accent) / .28) !important' },
  '.cm-matchingBracket': { backgroundColor: 'rgb(var(--accent) / .25)', outline: 'none' },
  '.cm-placeholder': { color: 'rgb(var(--muted) / .7)' },
});

export const SqlEditor = forwardRef<SqlEditorHandle, Props>(function SqlEditor({ value, onChange, onRun, completion, readOnly, placeholderText, className }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const lang = useRef(new Compartment());
  const cbs = useRef({ onChange, onRun });
  cbs.current = { onChange, onRun };

  useEffect(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), history(), drawSelection(), indentOnInput(), bracketMatching(), closeBrackets(),
        autocompletion({ activateOnTyping: true, maxRenderedOptions: 40 }),
        lang.current.of(sql({ dialect: PostgreSQL, upperCaseKeywords: true, schema: completion })),
        syntaxHighlighting(highlight), theme,
        keymap.of([
          { key: 'Mod-Enter', run: () => { cbs.current.onRun?.(); return true; } },
          { key: 'F5', run: () => { cbs.current.onRun?.(); return true; } },
          indentWithTab, ...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, ...defaultKeymap,
        ]),
        EditorView.updateListener.of((u) => { if (u.docChanged) cbs.current.onChange?.(u.state.doc.toString()); }),
        EditorState.readOnly.of(!!readOnly),
        placeholder(placeholderText || ''),
      ],
    });
    view.current = new EditorView({ state, parent: host.current! });
    return () => { view.current?.destroy(); view.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // внешнее изменение текста (загрузка из истории, шаблоны)
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  // обновлённые подсказки по таблицам/колонкам
  useEffect(() => {
    view.current?.dispatch({ effects: lang.current.reconfigure(sql({ dialect: PostgreSQL, upperCaseKeywords: true, schema: completion })) });
  }, [completion]);

  useImperativeHandle(ref, () => ({
    getText: () => view.current?.state.doc.toString() ?? '',
    getSelectionOrAll: () => {
      const s = view.current!.state;
      const sel = s.selection.main;
      return sel.empty ? s.doc.toString() : s.sliceDoc(sel.from, sel.to);
    },
    setText: (txt: string) => { const v = view.current; if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: txt } }); },
    focus: () => view.current?.focus(),
    gotoPosition: (pos: number) => {
      const v = view.current; if (!v) return;
      const p = Math.max(0, Math.min(pos, v.state.doc.length));
      v.dispatch({ selection: { anchor: p }, scrollIntoView: true }); v.focus();
    },
  }), []);

  return <div ref={host} className={className} />;
});
