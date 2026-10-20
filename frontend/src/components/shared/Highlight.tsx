import { splitHighlight } from '../../search/engine';

/** Текст с подсветкой найденных фрагментов. */
export function Highlight({ text, ranges }: { text: string; ranges?: Array<[number, number]> }) {
  if (!ranges || ranges.length === 0) return <>{text}</>;
  return (
    <>
      {splitHighlight(text, ranges).map((p, i) =>
        p.hit ? <mark key={i} className="bg-primary/25 text-foreground rounded-sm px-0.5">{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}
    </>
  );
}
