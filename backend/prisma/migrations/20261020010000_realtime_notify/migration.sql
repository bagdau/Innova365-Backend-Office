-- Мгновенная связь касса <-> Office: любое изменение в ключевых таблицах (из кассы, из Office или из SQL-консоли)
-- отправляет уведомление в канал PostgreSQL innova_change. Оба сервиса слушают его и сразу обновляют экраны.
-- Уведомление содержит только имя таблицы и ресторан — данных в нём нет; идентичные уведомления внутри одной транзакции склеиваются.
CREATE OR REPLACE FUNCTION public.innova_notify() RETURNS trigger AS $fn$
DECLARE rid text;
BEGIN
  IF TG_OP = 'DELETE' THEN rid := to_jsonb(OLD)->>'restauranteId'; ELSE rid := to_jsonb(NEW)->>'restauranteId'; END IF;
  PERFORM pg_notify('innova_change', json_build_object('s', TG_TABLE_SCHEMA, 't', TG_TABLE_NAME, 'r', rid)::text);
  RETURN NULL;
END
$fn$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Pedido','ItemPedido','Mesa','Producto','Categoria','Usuario','Insumo','MovimientoInventario',
                           'Compra','CompraItem','Recepcion','Proveedor','Receta','RecetaItem','Impresora','Restaurante']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS innova_notify ON public.%I', t);
    EXECUTE format('CREATE TRIGGER innova_notify AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.innova_notify()', t);
  END LOOP;
END $$;

-- Отчёты по продажам выбирают оплаченные заказы по дате оплаты — отдельный индекс, чтобы отчёты оставались быстрыми при росте истории.
CREATE INDEX IF NOT EXISTS "Pedido_restauranteId_estado_actualizadoEn_idx" ON "Pedido" ("restauranteId", "estado", "actualizadoEn");
