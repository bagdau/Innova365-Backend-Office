import { Router } from 'express';
import { auth, hasPerm } from '../auth';
import { q } from '../db';
import { ah } from '../util';

/**
 * Глобальный поиск (Ctrl+K): блюда и техкарты, сырьё, поставщики, точки, договоры, счета, расчёты, закупки,
 * сотрудники, расходы. Каждому пользователю возвращается только то, к чему у него есть доступ.
 */
export const router = Router();
router.use('/search', auth);

interface Hit { group: string; title: string; sub?: string; link: string }
const LIMIT = 6;

router.get('/search', ah(async (req, res) => {
  const text = String(req.query.q ?? '').trim().slice(0, 60);
  if (text.length < 2) { res.json([]); return; }
  const rid = req.me!.rid, me = req.me!;
  const like = `%${text.replace(/[\\%_]/g, '\\$&')}%`;
  const asNum = /^\d{1,9}$/.test(text) ? Number(text) : null;
  const jobs: Promise<Hit[]>[] = [];
  const run = (perm: Parameters<typeof hasPerm>[1] | null, fn: () => Promise<Hit[]>) => { if (!perm || hasPerm(me, perm)) jobs.push(fn().catch(() => [])); };

  run('menu.view', async () => (await q(`select p.id, p.nombre, c.nombre as cat, p.precio from public."Producto" p join public."Categoria" c on c.id = p."categoriaId" where p."restauranteId" = $1 and p.nombre ilike $2 order by p.nombre limit ${LIMIT}`, [rid, like]))
    .map((r) => ({ group: 'Блюда', title: r.nombre, sub: `${r.cat} · ${Number(r.precio).toLocaleString('ru-RU')}`, link: hasPerm(me, 'tc.view') ? `/techcards/${r.id}` : '/menu' })));
  run('tc.view', async () => (await q(`select i.nombre, i.categoria from public."Insumo" i where i."restauranteId" = $1 and i.nombre ilike $2 order by i.nombre limit ${LIMIT}`, [rid, like]))
    .map((r) => ({ group: 'Сырьё', title: r.nombre, sub: r.categoria ?? undefined, link: '/ingredients' })));
  run('inv.view', async () => (await q(`select i.nombre, i."stockActual" as stock, i.unidad from public."Insumo" i where i."restauranteId" = $1 and i.nombre ilike $2 order by i.nombre limit ${LIMIT}`, [rid, like]))
    .map((r) => ({ group: 'Остатки', title: r.nombre, sub: `${Number(r.stock).toLocaleString('ru-RU')} ${r.unidad}`, link: '/inventory/stock' })));
  run('sup.view', async () => (await q(`select p.id, p.nombre, p.telefono from public."Proveedor" p where p."restauranteId" = $1 and (p.nombre ilike $2 or p.telefono ilike $2) order by p.nombre limit ${LIMIT}`, [rid, like]))
    .map((r) => ({ group: 'Поставщики', title: r.nombre, sub: r.telefono ?? undefined, link: `/suppliers/${r.id}` })));
  run('fc.view', async () => (await q(`select o.name, o.legal_name, o.status from office.outlet o where o.restaurante_id = $1 and (o.name ilike $2 or o.legal_name ilike $2 or o.bin ilike $2) order by o.name limit ${LIMIT}`, [rid, like]))
    .map((r) => ({ group: 'Точки фудкорта', title: r.name, sub: r.legal_name ?? undefined, link: '/foodcourt/outlets' })));
  run('fc.view', async () => (await q(`select l.number, o.name from office.lease l join office.outlet o on o.id = l.outlet_id where l.restaurante_id = $1 and (l.number ilike $2 or o.name ilike $2) order by l.start_date desc limit ${LIMIT}`, [rid, like]))
    .map((r) => ({ group: 'Договоры аренды', title: `Договор №${r.number}`, sub: r.name, link: '/foodcourt/leases' })));
  run('fc.view', async () => (await q(`select i.number, i.kind, o.name, i.title from office.invoice i join office.outlet o on o.id = i.outlet_id where i.restaurante_id = $1 and (i.number = $3 or i.title ilike $2 or o.name ilike $2) order by i.date desc limit ${LIMIT}`, [rid, like, asNum]))
    .map((r) => ({ group: 'Счета и акты', title: `${r.kind === 'act' ? 'Акт' : 'Счёт'} №${r.number}`, sub: `${r.name}${r.title ? ' · ' + r.title : ''}`, link: '/foodcourt/invoices' })));
  run('fc.view', async () => (await q(`select s.id, s.number, o.name from office.settlement s join office.outlet o on o.id = s.outlet_id where s.restaurante_id = $1 and (s.number = $2) order by s.period_from desc limit ${LIMIT}`, [rid, asNum]))
    .map((r) => ({ group: 'Взаиморасчёты', title: `Расчёт №${r.number}`, sub: r.name, link: `/foodcourt/settlements/${r.id}` })));
  run('acc.view', async () => (await q(`select c.numero, p.nombre from public."Compra" c join public."Proveedor" p on p.id = c."proveedorId" where c."restauranteId" = $1 and (c.numero = $3 or p.nombre ilike $2) order by c."creadoEn" desc limit ${LIMIT}`, [rid, like, asNum]))
    .map((r) => ({ group: 'Закупки', title: `Закупка №${r.numero}`, sub: r.nombre, link: '/accounting/purchases' })));
  run('acc.view', async () => (await q(`select e.date, e.amount, e.description, e.counterparty from office.expense e where e.restaurante_id = $1 and (e.description ilike $2 or e.counterparty ilike $2 or e.doc_number ilike $2) order by e.date desc limit ${LIMIT}`, [rid, like]))
    .map((r) => ({ group: 'Расходы', title: r.description || r.counterparty || 'Расход', sub: `${r.date} · ${Number(r.amount).toLocaleString('ru-RU')}`, link: '/accounting/expenses' })));
  run('inv.view', async () => (await q(`select id, number, title, status from office.stocktake where restaurante_id = $1 and (title ilike $2 or number = $3) order by created_at desc limit ${LIMIT}`, [rid, like, asNum]))
    .map((r) => ({ group: 'Инвентаризации', title: `№${r.number} · ${r.title}`, sub: r.status === 'draft' ? 'идёт подсчёт' : r.status === 'closed' ? 'закрыта' : 'отменена', link: `/inventory/stocktakes/${r.id}` })));
  run('hr.view', async () => (await q(`select name, position from office.hr_employee where restaurante_id = $1 and (name ilike $2 or phone ilike $2) order by name limit ${LIMIT}`, [rid, like]))
    .map((r) => ({ group: 'Штат', title: r.name, sub: r.position ?? undefined, link: '/hr/employees' })));
  run('staff', async () => (await q(`select nombre, email from office.staff where restaurante_id = $1 and (nombre ilike $2 or email ilike $2) order by nombre limit ${LIMIT}`, [rid, like]))
    .map((r) => ({ group: 'Сотрудники Office', title: r.nombre, sub: r.email, link: '/admin/staff' })));

  res.json((await Promise.all(jobs)).flat());
}));
