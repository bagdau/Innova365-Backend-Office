import { Link, Navigate, useParams } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { findSection } from './sections';

export default function SeccionPage() {
  const { grupo, pagina } = useParams();
  const found = findSection(grupo, pagina);
  if (!found) return <Navigate to="/403" replace />;
  const { group, page } = found;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{group.label}</p>
        <h1 className="text-2xl font-bold text-foreground">{page.label}</h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center text-center gap-3">
        <Construction size={36} className="text-muted-foreground" aria-hidden="true" />
        <p className="font-semibold text-foreground">Раздел в разработке</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Страница «{page.label}» добавлена в навигацию; её содержимое будет подключено к данным позже.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {group.pages.filter((p) => p.slug !== page.slug).map((p) => (
            <Link key={p.slug} to={`/s/${group.slug}/${p.slug}`}
              className="px-3 py-1.5 rounded-lg text-sm bg-muted text-muted-foreground hover:text-foreground transition-colors">
              {p.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
