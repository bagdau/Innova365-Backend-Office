import { NextFunction, Request, Response, Router } from 'express';
import { auth, getSettings, need } from '../auth';
import { q, q1 } from '../db';
import { payBetween, revenueByOutlet } from '../reports';
import { loadRentHistory, rentFor } from '../rent';
import { ah, HttpError, n, periodOf, round2, todayIso } from '../util';
import { invoiceOut, invoiceSelect } from './invoices';

/**
 * Кабинет арендатора: менеджер точки видит только свою точку — выручку, расчёты, счета и акты, договор.
 * Каждый запрос привязан к точке из учётной записи; чужие данные недоступны ни по какому идентификатору.
 */
export const router = Router();
router.use('/tenant', auth, need('tenant'));

function outletOf(req: Request): string {
  const id = req.me!.outletId;
  if (!id) throw new HttpError(403, 'К вашей учётной записи не привязана точка');
  return id;
}
router.use('/tenant', (req: Request, _res: Response, next: NextFunction) => { try { outletOf(req); next(); } catch (e) { next(e); } });

const catFilter = `join office.outlet_category oc on oc.categoria_id = pr."categoriaId" and oc.restaurante_id = p."restauranteId" and oc.outlet_id = $5`;

router.get('/tenant/overview', ah(async (req, res) => {
  const rid = req.me!.rid, oid = outletOf(req);
  const s = await getSettings(rid);
  const { from, to } = periodOf(req, s.timezone);
  const today = todayIso(s.timezone);
  const [o, rev, hist, daily, top, sets, invs, lease] = await Promise.all([
    q1('select * from office.outlet where id = $1 and restaurante_id = $2', [oid, rid]),
    revenueByOutlet(rid, s.timezone, from, to), loadRentHistory(rid),
    q(`select (p."actualizadoEn" at time zone 'UTC' at time zone $2)::date as d, sum(ip.subtotal) as revenue, count(distinct p.id)::int as orders
         from public."ItemPedido" ip join public."Pedido" p on p.id = ip."pedidoId" join public."Producto" pr on pr.id = ip."productoId" ${catFilter}
        where p."restauranteId" = $1 and p.estado = 'PAGADO' and ${payBetween()} group by 1 order by 1`, [rid, s.timezone, from, to, oid]),
    q(`select pr.nombre, sum(ip.cantidad)::int as qty, sum(ip.subtotal) as revenue
         from public."ItemPedido" ip join public."Pedido" p on p.id = ip."pedidoId" join public."Producto" pr on pr.id = ip."productoId" ${catFilter}
        where p."restauranteId" = $1 and p.estado = 'PAGADO' and ${payBetween()} group by pr.nombre order by 3 desc limit 10`, [rid, s.timezone, from, to, oid]),
    q(`select id, number, period_from, period_to, revenue, commission, rent, payable, status from office.settlement where outlet_id = $1 and restaurante_id = $2 and status <> 'draft' order by period_from desc limit 12`, [oid, rid]),
    q(`${invoiceSelect} where i.outlet_id = $1 and i.restaurante_id = $2 and i.status = 'issued' order by i.date desc limit 100`, [oid, rid]),
    q1(`select number, start_date, end_date, rent_monthly, commission_pct, deposit, payment_day, status from office.lease where outlet_id = $1 and status = 'active'`, [oid]),
  ]);
  if (!o) throw new HttpError(404, 'Точка не найдена');
  const mine = rev.find((r) => r.outletId === oid) ?? { orders: 0, qty: 0, revenue: 0 };
  const revenue = round2(mine.revenue), commission = round2(revenue * n(o.commission_pct) / 100), rent = rentFor(o, hist.get(oid), from, to);
  const inv = invs.map((r) => invoiceOut(r, today));
  res.json({
    outlet: { name: o.name, legalName: o.legal_name, status: o.status, commissionPct: n(o.commission_pct), rentMonthly: n(o.rent_monthly) }, company: s.company, from, to,
    period: { revenue, orders: mine.orders, qty: mine.qty, avgCheck: mine.orders ? round2(revenue / mine.orders) : 0, commission, rent, payable: round2(revenue - commission - rent) },
    daily: daily.map((d) => ({ date: d.d, revenue: round2(n(d.revenue)), orders: d.orders })),
    top: top.map((t) => ({ nombre: t.nombre, qty: t.qty, revenue: round2(n(t.revenue)) })),
    settlements: sets.map((x) => ({ id: x.id, number: x.number, periodFrom: x.period_from, periodTo: x.period_to, revenue: n(x.revenue), commission: n(x.commission), rent: n(x.rent), payable: n(x.payable), status: x.status })),
    invoices: { rows: inv, open: round2(inv.filter((r) => ['issued', 'partial', 'overdue'].includes(r.state)).reduce((a, r) => a + r.remaining, 0)), overdue: round2(inv.filter((r) => r.state === 'overdue').reduce((a, r) => a + r.remaining, 0)) },
    lease: lease ? { number: lease.number, startDate: lease.start_date, endDate: lease.end_date, rentMonthly: n(lease.rent_monthly), commissionPct: n(lease.commission_pct), deposit: n(lease.deposit), paymentDay: lease.payment_day } : null,
  });
}));

router.get('/tenant/settlements/:id', ah(async (req, res) => {
  const rid = req.me!.rid, oid = outletOf(req);
  const tz = (await getSettings(rid)).timezone;
  const st = await q1(`select s.*, o.name as outlet_name, o.legal_name, o.bin, o.contact, o.phone, o.email from office.settlement s join office.outlet o on o.id = s.outlet_id where s.id = $1 and s.restaurante_id = $2 and s.outlet_id = $3 and s.status <> 'draft'`, [req.params.id, rid, oid]);
  if (!st) throw new HttpError(404, 'Расчёт не найден');
  const lines = await q(
    `select c.nombre, sum(ip.cantidad)::int as qty, sum(ip.subtotal) as revenue from public."ItemPedido" ip join public."Pedido" p on p.id = ip."pedidoId"
       join public."Producto" pr on pr.id = ip."productoId" join public."Categoria" c on c.id = pr."categoriaId"
       join office.outlet_category oc on oc.categoria_id = c.id and oc.restaurante_id = p."restauranteId" and oc.outlet_id = $5
      where p."restauranteId" = $1 and p.estado = 'PAGADO' and ${payBetween()} group by c.nombre order by 3 desc`, [rid, tz, st.period_from, st.period_to, oid]);
  res.json({
    id: st.id, number: st.number, periodFrom: st.period_from, periodTo: st.period_to, orders: st.orders, revenue: n(st.revenue), commissionPct: n(st.commission_pct), commission: n(st.commission), rent: n(st.rent), payable: n(st.payable),
    status: st.status, issuedAt: st.issued_at, paidAt: st.paid_at, paidMethod: st.paid_method, notes: st.notes, outletName: st.outlet_name, outletId: st.outlet_id,
    outlet: { name: st.outlet_name, legalName: st.legal_name, bin: st.bin, contact: st.contact, phone: st.phone, email: st.email }, lines: lines.map((l) => ({ nombre: l.nombre, qty: l.qty, revenue: n(l.revenue) })),
  });
}));

router.get('/tenant/invoices/:id', ah(async (req, res) => {
  const rid = req.me!.rid, oid = outletOf(req);
  const s = await getSettings(rid);
  const r = await q1(`${invoiceSelect} where i.id = $1 and i.restaurante_id = $2 and i.outlet_id = $3 and i.status <> 'draft'`, [req.params.id, rid, oid]);
  if (!r) throw new HttpError(404, 'Документ не найден');
  const [lines, pays, outlet] = await Promise.all([
    q('select description, qty, price, amount from office.invoice_line where invoice_id = $1 order by position', [r.id]),
    q('select id, date, amount, method, note, created_by_name from office.invoice_payment where invoice_id = $1 order by date', [r.id]),
    q1('select name, legal_name, bin, contact, phone, email from office.outlet where id = $1', [oid]),
  ]);
  res.json({ ...invoiceOut(r, todayIso(s.timezone)), lines: lines.map((l) => ({ description: l.description, qty: n(l.qty), price: n(l.price), amount: n(l.amount) })), payments: pays.map((p) => ({ id: p.id, date: p.date, amount: n(p.amount), method: p.method, note: p.note, who: p.created_by_name })),
    outlet: { name: outlet!.name, legalName: outlet!.legal_name, bin: outlet!.bin, contact: outlet!.contact, phone: outlet!.phone, email: outlet!.email }, company: { name: s.company, bin: s.bin, address: s.address, signer: s.signer } });
}));
