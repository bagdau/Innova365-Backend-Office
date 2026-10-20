import { prisma } from './prisma';

const RU: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};

/** «Пиццерия №1» → «pitstseriya1»; «Pollería Don José» → «polleriadonjose». */
export function slugNombre(nombre: string): string {
  // Сначала кириллица (иначе NFD разберёт «й» на «и» + знак), затем снимаем диакритику (í → i).
  const lat = [...nombre.toLowerCase()].map((c) => RU[c] ?? c).join('');
  return lat.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 30);
}

export const dominioDe = (nombre: string): string | null => {
  const s = slugNombre(nombre);
  return s ? `${s}.com` : null;
};

/**
 * Автопереименование учётных данных: заменяет домен у почт сотрудников «корпоративного» домена
 * (самого частого в ресторане). Личные почты (gmail и т.п.) не трогает.
 */
export async function renombrarCorreos(restauranteId: string, nombre: string): Promise<{ dominio: string; cambios: number } | null> {
  const nuevo = dominioDe(nombre);
  if (!nuevo) return null;
  const usuarios = await prisma.usuario.findMany({ where: { restauranteId }, select: { id: true, email: true } });
  const cuenta = new Map<string, number>();
  for (const u of usuarios) {
    const d = u.email.split('@')[1]?.toLowerCase();
    if (d) cuenta.set(d, (cuenta.get(d) ?? 0) + 1);
  }
  const [actual] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!actual || actual === nuevo) return { dominio: nuevo, cambios: 0 };

  const cambios = usuarios
    .filter((u) => u.email.split('@')[1]?.toLowerCase() === actual)
    .map((u) => ({ id: u.id, email: `${u.email.split('@')[0]}@${nuevo}` }));
  const ocupados = await prisma.usuario.findMany({
    where: { email: { in: cambios.map((c) => c.email) }, restauranteId: { not: restauranteId } }, select: { email: true },
  });
  const bloqueados = new Set(ocupados.map((o) => o.email));
  const aplicar = cambios.filter((c) => !bloqueados.has(c.email));
  await prisma.$transaction(aplicar.map((c) => prisma.usuario.update({ where: { id: c.id }, data: { email: c.email } })));
  return { dominio: nuevo, cambios: aplicar.length };
}
