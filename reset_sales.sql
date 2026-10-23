-- ═══════════════════════════════════════════════════════════════════════════════════════
-- СБРОС ПРОДАЖ И ЗАКАЗОВ: удаляет всю историю заказов и продаж (а значит, и все отчёты, которые строятся по ним).
--
-- УДАЛЯЕТСЯ:
--   • "ItemPedido" — позиции заказов
--   • "Pedido"     — заказы и оплаты (продажи за всё время)
--   • "OperacionIdem" — служебные ключи повторных запросов (хранят ответы по уже удалённым заказам)
--   • office.settlement — взаиморасчёты с точками фудкорта (строятся по продажам; выполняется, только если установлен Innova Office)
--
-- ПРИВОДИТСЯ В ПОРЯДОК:
--   • "Mesa"   — все столы становятся свободными (заказов больше нет)
--   • счётчик номеров заказов начинается заново с 1
--
-- НЕ ТРОГАЕТСЯ: пользователи, меню и цены (Producto, Categoria), тех-карты, склад (Insumo, остатки, журнал движений,
--   закупки, поставщики), принтеры и их журнал печати, настройки ресторана, журнал действий, расходы и оплаты поставщикам офиса.
--   Остатки склада остаются как есть: то, что уже списано по проданным блюдам, НЕ возвращается.
--
-- КАК ЗАПУСКАТЬ (на сервере, в /opt/IIKOProject):
--   1) копия базы:  sudo docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > ~/backup_before_reset.sql
--   2) сухой прогон (ничего не меняет, только показывает, что будет удалено):
--        sudo docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v dry=1' < reset_sales.sql
--   3) настоящий сброс:
--        sudo docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < reset_sales.sql
-- Всё выполняется в одной транзакции: при любой ошибке не меняется ничего.
-- ═══════════════════════════════════════════════════════════════════════════════════════

\if :{?dry}
\else
\set dry 0
\endif

BEGIN;

\echo '── ДО сброса ──'
SELECT 'Заказы'        AS что, count(*) AS записей FROM "Pedido"
UNION ALL SELECT 'Позиции заказов', count(*) FROM "ItemPedido"
UNION ALL SELECT 'Оплачено заказов', count(*) FROM "Pedido" WHERE estado = 'PAGADO'
UNION ALL SELECT 'Занятых столов', count(*) FROM "Mesa" WHERE estado <> 'LIBRE';

-- сначала позиции (внешний ключ на заказы), затем сами заказы
DELETE FROM "ItemPedido";
DELETE FROM "Pedido";
DELETE FROM "OperacionIdem";

-- взаиморасчёты фудкорта (только если схема office существует)
DO $$
BEGIN
  IF to_regclass('office.settlement') IS NOT NULL THEN
    EXECUTE 'DELETE FROM office.settlement';
    PERFORM setval('office.settlement_seq', 1, false);
  END IF;
END $$;

-- столы свободны, нумерация заказов заново
UPDATE "Mesa" SET estado = 'LIBRE' WHERE estado <> 'LIBRE';
ALTER SEQUENCE "Pedido_numero_seq" RESTART WITH 1;

-- по желанию (раскомментируйте нужное):
-- DELETE FROM "TrabajoImpresion";    -- журнал печати чеков
-- DELETE FROM "RegistroActividad";   -- журнал действий кассовой системы

\echo '── ПОСЛЕ сброса ──'
SELECT 'Заказы'        AS что, count(*) AS записей FROM "Pedido"
UNION ALL SELECT 'Позиции заказов', count(*) FROM "ItemPedido"
UNION ALL SELECT 'Занятых столов', count(*) FROM "Mesa" WHERE estado <> 'LIBRE'
UNION ALL SELECT 'Блюд в меню (не тронуто)', count(*) FROM "Producto"
UNION ALL SELECT 'Пользователей (не тронуто)', count(*) FROM "Usuario"
UNION ALL SELECT 'Позиций склада (не тронуто)', count(*) FROM "Insumo";

\if :dry
  \echo '── СУХОЙ ПРОГОН: изменения отменены (ROLLBACK). Для настоящего сброса запустите без -v dry=1 ──'
  ROLLBACK;
\else
  COMMIT;
  \echo '── ГОТОВО: продажи и заказы удалены ──'
\endif
