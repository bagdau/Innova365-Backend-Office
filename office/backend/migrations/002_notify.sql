-- Мгновенные обновления: изменения таблиц Office отправляют уведомление в канал PostgreSQL innova_change.
-- Его слушают и Office (несколько пользователей видят правки друг друга сразу), и касса.
CREATE OR REPLACE FUNCTION office.innova_notify() RETURNS trigger AS $fn$
DECLARE rid text;
BEGIN
  IF TG_OP = 'DELETE' THEN rid := coalesce(to_jsonb(OLD)->>'restaurante_id', to_jsonb(OLD)->>'restauranteId');
  ELSE rid := coalesce(to_jsonb(NEW)->>'restaurante_id', to_jsonb(NEW)->>'restauranteId'); END IF;
  PERFORM pg_notify('innova_change', json_build_object('s', TG_TABLE_SCHEMA, 't', TG_TABLE_NAME, 'r', rid)::text);
  RETURN NULL;
END
$fn$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['staff','setting','audit','outlet','outlet_category','settlement','tc_state','tc_version','expense_category','expense','purchase_payment']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS innova_notify ON office.%I', t);
    EXECUTE format('CREATE TRIGGER innova_notify AFTER INSERT OR UPDATE OR DELETE ON office.%I FOR EACH ROW EXECUTE FUNCTION office.innova_notify()', t);
  END LOOP;
END $$;
