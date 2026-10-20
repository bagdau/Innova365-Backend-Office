-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Тех-карты блюд (СНГ-меню) + ингредиенты склада + цены меню в ₸.
-- Применять ПОСЛЕ запуска обновлённого backend (он создаёт таблицы Receta / RecetaItem).
-- Скрипт идемпотентный: тех-карты пересоздаются, ингредиенты не дублируются.
--
-- ИСТОЧНИКИ НОРМ (брутто на 1 порцию):
--  • 15 блюд — по нормативным сборникам и рецептурам из интернета (источник указан в тексте тех-карты «Источник норм»):
--      Могильный М. П. (2005) — борщ №82, пюре №312, гречка №171, макароны №203, сырники №219, сельдь №76, чай с лимоном №375/377, компот №348;
--      Лапшина В. Т. (2004) — солянка №157, суп с макаронными изделиями №140;
--      Перевалов А. Я. (2013) — бефстроганов №366/442;
--      Госкомстат Республики Узбекистан — состав плова («индекс плова»);
--      рецепты ВкусВилл (бешбармак, 7 порций), Лайфхакер / Lady.mail.ru (оливье, голубцы).
--    Нормативные сборники рассчитаны на школьные порции — пересчитаны на размер порции ресторана (коэффициент указан в карте).
--  • Остальные блюда (лагман, шурпа, манты, самса, пельмени, цезарь, наполеон, чак-чак, баурсаки, блины, шашлык, котлета по-киевски, напитки, соусы)
--    — ОРИЕНТИРОВОЧНЫЕ типовые нормы (в карте есть пометка): нормативных таблиц в открытом доступе найти не удалось. Шеф-повар должен сверить их.
--  • Начальные остатки новых ингредиентов и закупочные цены — условные: приведите их к реальным через «Склад → Ревизия» и «Закупки».
-- ═══════════════════════════════════════════════════════════════════════════════════════
UPDATE "Insumo" SET "costoUnitario" = 250 WHERE nombre = 'Картофель' AND "costoUnitario" IS NULL;
BEGIN;
UPDATE "Insumo" SET "costoUnitario" = 250 WHERE nombre = 'Картофель' AND "costoUnitario" IS NULL;
UPDATE "Insumo" SET "costoUnitario" = 800 WHERE nombre = 'Помидоры' AND "costoUnitario" IS NULL;
UPDATE "Insumo" SET "costoUnitario" = 250 WHERE nombre = 'Огурцы' AND "costoUnitario" IS NULL;
UPDATE "Insumo" SET "costoUnitario" = 1500 WHERE nombre = 'Салат латук' AND "costoUnitario" IS NULL;
UPDATE "Insumo" SET "costoUnitario" = 1200 WHERE nombre = 'Лимон' AND "costoUnitario" IS NULL;
UPDATE "Insumo" SET "costoUnitario" = 100 WHERE nombre = 'Соль' AND "costoUnitario" IS NULL;
UPDATE "Insumo" SET "costoUnitario" = 900 WHERE nombre = 'Растительное масло' AND "costoUnitario" IS NULL;
UPDATE "Insumo" SET "costoUnitario" = 900 WHERE nombre = 'Томатная паста' AND "costoUnitario" IS NULL;
UPDATE "Insumo" SET "costoUnitario" = 700 WHERE nombre = 'Кетчуп' AND "costoUnitario" IS NULL;
UPDATE "Insumo" SET "costoUnitario" = 750 WHERE nombre = 'Майонез' AND "costoUnitario" IS NULL;
UPDATE "Insumo" SET "costoUnitario" = 3000 WHERE nombre = 'Приправа для курицы' AND "costoUnitario" IS NULL;
UPDATE "Insumo" SET "costoUnitario" = 300 WHERE nombre = 'Древесный уголь' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-govyadina','Говядина','Мясо','кг',40,10,3800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Говядина');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-govyadina', i."restauranteId", i.id, 'INICIAL', 40, 40, 3800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-govyadina' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-govyadina');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-baranina','Баранина','Мясо','кг',15,5,4200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Баранина');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-baranina', i."restauranteId", i.id, 'INICIAL', 15, 15, 4200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-baranina' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-baranina');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-kuritsa_file','Куриное филе','Мясо','кг',25,8,2200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Куриное филе');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-kuritsa_file', i."restauranteId", i.id, 'INICIAL', 25, 25, 2200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-kuritsa_file' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-kuritsa_file');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-farsh','Фарш мясной','Мясо','кг',12,4,3200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Фарш мясной');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-farsh', i."restauranteId", i.id, 'INICIAL', 12, 12, 3200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-farsh' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-farsh');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-kolbasa','Колбаса варёная','Мясо','кг',6,2,2800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Колбаса варёная');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-kolbasa', i."restauranteId", i.id, 'INICIAL', 6, 6, 2800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-kolbasa' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-kolbasa');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-seld','Сельдь солёная','Рыба','кг',5,2,2500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сельдь солёная');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-seld', i."restauranteId", i.id, 'INICIAL', 5, 5, 2500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-seld' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-seld');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-morkov','Морковь','Овощи','кг',25,8,200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Морковь');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-morkov', i."restauranteId", i.id, 'INICIAL', 25, 25, 200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-morkov' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-morkov');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-luk','Лук репчатый','Овощи','кг',25,8,150,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Лук репчатый');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-luk', i."restauranteId", i.id, 'INICIAL', 25, 25, 150, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-luk' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-luk');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-chesnok','Чеснок','Овощи','кг',3,1,1500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Чеснок');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-chesnok', i."restauranteId", i.id, 'INICIAL', 3, 3, 1500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-chesnok' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-chesnok');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-kapusta','Капуста белокочанная','Овощи','кг',20,6,180,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Капуста белокочанная');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-kapusta', i."restauranteId", i.id, 'INICIAL', 20, 20, 180, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-kapusta' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-kapusta');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-svekla','Свёкла','Овощи','кг',12,4,200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Свёкла');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-svekla', i."restauranteId", i.id, 'INICIAL', 12, 12, 200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-svekla' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-svekla');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-romano','Салат романо','Овощи','кг',4,1,2500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Салат романо');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-romano', i."restauranteId", i.id, 'INICIAL', 4, 4, 2500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-romano' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-romano');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-zelen','Зелень (укроп, петрушка)','Овощи','кг',3,1,1500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Зелень (укроп, петрушка)');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-zelen', i."restauranteId", i.id, 'INICIAL', 3, 3, 1500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-zelen' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-zelen');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-goroshek','Горошек консервированный','Консервы','кг',6,2,900,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Горошек консервированный');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-goroshek', i."restauranteId", i.id, 'INICIAL', 6, 6, 900, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-goroshek' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-goroshek');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-ogurtsy_sol','Огурцы солёные','Консервы','кг',6,2,900,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Огурцы солёные');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-ogurtsy_sol', i."restauranteId", i.id, 'INICIAL', 6, 6, 900, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-ogurtsy_sol' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-ogurtsy_sol');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-nut','Нут','Бакалея','кг',5,2,1200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Нут');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-nut', i."restauranteId", i.id, 'INICIAL', 5, 5, 1200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-nut' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-nut');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-klukva','Клюква','Ягоды','кг',5,1.5,3500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Клюква');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-klukva', i."restauranteId", i.id, 'INICIAL', 5, 5, 3500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-klukva' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-klukva');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-suhofrukty','Сухофрукты','Бакалея','кг',6,2,1800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сухофрукты');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-suhofrukty', i."restauranteId", i.id, 'INICIAL', 6, 6, 1800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-suhofrukty' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-suhofrukty');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-muka','Мука пшеничная','Бакалея','кг',60,20,350,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Мука пшеничная');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-muka', i."restauranteId", i.id, 'INICIAL', 60, 60, 350, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-muka' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-muka');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-ris','Рис','Бакалея','кг',30,10,600,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Рис');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-ris', i."restauranteId", i.id, 'INICIAL', 30, 30, 600, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-ris' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-ris');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-grechka','Гречневая крупа','Бакалея','кг',20,6,700,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Гречневая крупа');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-grechka', i."restauranteId", i.id, 'INICIAL', 20, 20, 700, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-grechka' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-grechka');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-makarony','Макаронные изделия','Бакалея','кг',12,4,600,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Макаронные изделия');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-makarony', i."restauranteId", i.id, 'INICIAL', 12, 12, 600, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-makarony' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-makarony');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-lapsha','Лапша для лагмана','Бакалея','кг',10,3,900,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Лапша для лагмана');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-lapsha', i."restauranteId", i.id, 'INICIAL', 10, 10, 900, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-lapsha' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-lapsha');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-suhari','Сухари панировочные','Бакалея','кг',3,1,1500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сухари панировочные');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-suhari', i."restauranteId", i.id, 'INICIAL', 3, 3, 1500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-suhari' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-suhari');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-sahar','Сахар','Бакалея','кг',25,8,500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сахар');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-sahar', i."restauranteId", i.id, 'INICIAL', 25, 25, 500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-sahar' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-sahar');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-med','Мёд','Бакалея','кг',3,1,4500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Мёд');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-med', i."restauranteId", i.id, 'INICIAL', 3, 3, 4500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-med' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-med');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-chai_black','Чай чёрный','Бакалея','кг',2,0.5,6000,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Чай чёрный');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-chai_black', i."restauranteId", i.id, 'INICIAL', 2, 2, 6000, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-chai_black' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-chai_black');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-chai_green','Чай зелёный','Бакалея','кг',1.5,0.4,6500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Чай зелёный');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-chai_green', i."restauranteId", i.id, 'INICIAL', 1.5, 1.5, 6500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-chai_green' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-chai_green');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-kofe','Кофе зерновой','Бакалея','кг',3,1,9000,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Кофе зерновой');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-kofe', i."restauranteId", i.id, 'INICIAL', 3, 3, 9000, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-kofe' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-kofe');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-spetsii','Специи универсальные','Специи','кг',2,0.5,4000,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Специи универсальные');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-spetsii', i."restauranteId", i.id, 'INICIAL', 2, 2, 4000, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-spetsii' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-spetsii');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-smetana','Сметана','Молочные','кг',12,4,1500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сметана');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-smetana', i."restauranteId", i.id, 'INICIAL', 12, 12, 1500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-smetana' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-smetana');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-maslo_sl','Масло сливочное','Молочные','кг',8,2,4000,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Масло сливочное');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-maslo_sl', i."restauranteId", i.id, 'INICIAL', 8, 8, 4000, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-maslo_sl' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-maslo_sl');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-syr','Сыр твёрдый','Молочные','кг',3,1,4500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сыр твёрдый');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-syr', i."restauranteId", i.id, 'INICIAL', 3, 3, 4500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-syr' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-syr');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-tvorog','Творог','Молочные','кг',8,3,1800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Творог');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-tvorog', i."restauranteId", i.id, 'INICIAL', 8, 8, 1800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-tvorog' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-tvorog');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-moloko','Молоко','Молочные','л',20,6,500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Молоко');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-moloko', i."restauranteId", i.id, 'INICIAL', 20, 20, 500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-moloko' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-moloko');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-yaitso','Яйцо куриное','Яйца','шт',240,60,60,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Яйцо куриное');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-yaitso', i."restauranteId", i.id, 'INICIAL', 240, 240, 60, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-yaitso' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-yaitso');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-lepeshka','Лепёшка','Хлеб','шт',60,15,50,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Лепёшка');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-lepeshka', i."restauranteId", i.id, 'INICIAL', 60, 60, 50, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-lepeshka' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-lepeshka');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-adzhika','Аджика','Соусы','кг',4,1,1800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Аджика');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-adzhika', i."restauranteId", i.id, 'INICIAL', 4, 4, 1800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-adzhika' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-adzhika');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-cola05','Coca-Cola 0,5 л','Напитки','шт',48,12,350,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Coca-Cola 0,5 л');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-cola05', i."restauranteId", i.id, 'INICIAL', 48, 48, 350, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-cola05' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-cola05');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-cola15','Coca-Cola 1,5 л','Напитки','шт',24,6,650,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Coca-Cola 1,5 л');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-cola15', i."restauranteId", i.id, 'INICIAL', 24, 24, 650, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-cola15' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-cola15');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-pepsi05','Pepsi 0,5 л','Напитки','шт',48,12,350,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Pepsi 0,5 л');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-pepsi05', i."restauranteId", i.id, 'INICIAL', 48, 48, 350, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-pepsi05' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-pepsi05');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-pepsi15','Pepsi 1,5 л','Напитки','шт',24,6,650,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Pepsi 1,5 л');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-pepsi15', i."restauranteId", i.id, 'INICIAL', 24, 24, 650, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-pepsi15' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-pepsi15');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-voda05','Вода минеральная 0,5 л','Напитки','шт',48,12,150,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Вода минеральная 0,5 л');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-voda05', i."restauranteId", i.id, 'INICIAL', 48, 48, 150, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-voda05' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-voda05');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-ayran','Айран','Напитки','л',20,6,600,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Айран');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-ayran', i."restauranteId", i.id, 'INICIAL', 20, 20, 600, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-ayran' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-ayran');
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-kvas','Квас','Напитки','л',25,8,500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Квас');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ini-kvas', i."restauranteId", i.id, 'INICIAL', 25, 25, 500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-kvas' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m.id = 'mov-ini-kvas');
DELETE FROM "Insumo" WHERE nombre IN ('Маниок', 'Перец ахи амарильо') AND NOT EXISTS (SELECT 1 FROM "CompraItem" c WHERE c."insumoId" = "Insumo".id);
UPDATE "Producto" SET precio = 1500 WHERE id = 'prod-borsch';
UPDATE "Producto" SET precio = 1800 WHERE id = 'prod-lagman';
UPDATE "Producto" SET precio = 1900 WHERE id = 'prod-solyanka';
UPDATE "Producto" SET precio = 1200 WHERE id = 'prod-bulyon';
UPDATE "Producto" SET precio = 2200 WHERE id = 'prod-shorpa';
UPDATE "Producto" SET precio = 3500 WHERE id = 'prod-pollo-entero';
UPDATE "Producto" SET precio = 2200 WHERE id = 'prod-medio-pollo';
UPDATE "Producto" SET precio = 2400 WHERE id = 'prod-cuarto-pollo';
UPDATE "Producto" SET precio = 1800 WHERE id = 'prod-octavo-pollo';
UPDATE "Producto" SET precio = 1900 WHERE id = 'prod-pelmeni';
UPDATE "Producto" SET precio = 2200 WHERE id = 'prod-manty';
UPDATE "Producto" SET precio = 1900 WHERE id = 'prod-golubtsy';
UPDATE "Producto" SET precio = 2600 WHERE id = 'prod-stroganov';
UPDATE "Producto" SET precio = 3200 WHERE id = 'prod-combo-personal';
UPDATE "Producto" SET precio = 2400 WHERE id = 'prod-combo-broaster';
UPDATE "Producto" SET precio = 4500 WHERE id = 'prod-combo-duo';
UPDATE "Producto" SET precio = 9500 WHERE id = 'prod-combo-familiar';
UPDATE "Producto" SET precio = 7800 WHERE id = 'prod-combo-broaster2';
UPDATE "Producto" SET precio = 900 WHERE id = 'prod-papas-fritas';
UPDATE "Producto" SET precio = 800 WHERE id = 'prod-yuca-frita';
UPDATE "Producto" SET precio = 900 WHERE id = 'prod-ensalada';
UPDATE "Producto" SET precio = 500 WHERE id = 'prod-arroz';
UPDATE "Producto" SET precio = 800 WHERE id = 'prod-chaufa-arroz';
UPDATE "Producto" SET precio = 800 WHERE id = 'prod-vinegret';
UPDATE "Producto" SET precio = 1800 WHERE id = 'prod-caesar';
UPDATE "Producto" SET precio = 1000 WHERE id = 'prod-shuba';
UPDATE "Producto" SET precio = 100 WHERE id = 'prod-hleb';
UPDATE "Producto" SET precio = 700 WHERE id = 'prod-samsa';
UPDATE "Producto" SET precio = 1100 WHERE id = 'prod-blini';
UPDATE "Producto" SET precio = 1200 WHERE id = 'prod-syrniki';
UPDATE "Producto" SET precio = 1100 WHERE id = 'prod-napoleon';
UPDATE "Producto" SET precio = 800 WHERE id = 'prod-chak-chak';
UPDATE "Producto" SET precio = 600 WHERE id = 'prod-baursaki';
UPDATE "Producto" SET precio = 700 WHERE id = 'prod-coca-personal';
UPDATE "Producto" SET precio = 1300 WHERE id = 'prod-coca-grande';
UPDATE "Producto" SET precio = 700 WHERE id = 'prod-inca-personal';
UPDATE "Producto" SET precio = 1300 WHERE id = 'prod-inca-grande';
UPDATE "Producto" SET precio = 400 WHERE id = 'prod-agua';
UPDATE "Producto" SET precio = 900 WHERE id = 'prod-limonada';
UPDATE "Producto" SET precio = 600 WHERE id = 'prod-chicha';
UPDATE "Producto" SET precio = 400 WHERE id = 'prod-kompot';
UPDATE "Producto" SET precio = 600 WHERE id = 'prod-chai-black';
UPDATE "Producto" SET precio = 600 WHERE id = 'prod-chai-green';
UPDATE "Producto" SET precio = 900 WHERE id = 'prod-coffee';
UPDATE "Producto" SET precio = 500 WHERE id = 'prod-ayran';
UPDATE "Producto" SET precio = 500 WHERE id = 'prod-kvas';
UPDATE "Producto" SET precio = 100 WHERE id = 'prod-ketchup';
UPDATE "Producto" SET precio = 100 WHERE id = 'prod-mayonesa';
UPDATE "Producto" SET precio = 250 WHERE id = 'prod-aji-verde';
UPDATE "Producto" SET precio = 200 WHERE id = 'prod-salsa-criolla';
UPDATE "Producto" SET precio = 300 WHERE id = 'prod-salsa-huancaina';
DELETE FROM "Receta" WHERE "productoId" IN ('prod-borsch','prod-lagman','prod-solyanka','prod-bulyon','prod-shorpa','prod-pollo-entero','prod-medio-pollo','prod-cuarto-pollo','prod-octavo-pollo','prod-pelmeni','prod-manty','prod-golubtsy','prod-stroganov','prod-combo-personal','prod-combo-broaster','prod-combo-duo','prod-combo-familiar','prod-combo-broaster2','prod-papas-fritas','prod-yuca-frita','prod-ensalada','prod-arroz','prod-chaufa-arroz','prod-vinegret','prod-caesar','prod-shuba','prod-hleb','prod-samsa','prod-blini','prod-syrniki','prod-napoleon','prod-chak-chak','prod-baursaki','prod-coca-personal','prod-coca-grande','prod-inca-personal','prod-inca-grande','prod-agua','prod-limonada','prod-chicha','prod-kompot','prod-chai-black','prod-chai-green','prod-coffee','prod-ayran','prod-kvas','prod-ketchup','prod-mayonesa','prod-aji-verde','prod-salsa-criolla','prod-salsa-huancaina');
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-borsch', p.id, p."restauranteId", 350, 'Говядину отварить в холодной воде, бульон процедить. Свёклу и морковь пассеровать с томатным пюре, добавить картофель и капусту, варить до готовности. Подавать со сметаной.

Источник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 82 «Борщ с капустой свежей с мясом и со сметаной» (выход 250 г), пересчитано на 350 г (×1,4).', now() FROM "Producto" p WHERE p.id = 'prod-borsch';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-borsch-1','rec-prod-borsch', i.id, 0.045 FROM "Insumo" i WHERE i.nombre = 'Говядина' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-borsch-2','rec-prod-borsch', i.id, 0.07 FROM "Insumo" i WHERE i.nombre = 'Свёкла' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-borsch-3','rec-prod-borsch', i.id, 0.035 FROM "Insumo" i WHERE i.nombre = 'Капуста белокочанная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-borsch-4','rec-prod-borsch', i.id, 0.041 FROM "Insumo" i WHERE i.nombre = 'Картофель' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-borsch-5','rec-prod-borsch', i.id, 0.035 FROM "Insumo" i WHERE i.nombre = 'Морковь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-borsch-6','rec-prod-borsch', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-borsch-7','rec-prod-borsch', i.id, 0.004 FROM "Insumo" i WHERE i.nombre = 'Томатная паста' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-borsch-8','rec-prod-borsch', i.id, 0.006 FROM "Insumo" i WHERE i.nombre = 'Масло сливочное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-borsch-9','rec-prod-borsch', i.id, 0.003 FROM "Insumo" i WHERE i.nombre = 'Сахар' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-borsch-10','rec-prod-borsch', i.id, 0.01 FROM "Insumo" i WHERE i.nombre = 'Сметана' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-lagman', p.id, p."restauranteId", 400, 'Мясо обжарить с луком и морковью, добавить томатную пасту, чеснок, картофель, тушить. Лапшу отварить отдельно, подавать в тарелке с наваристым бульоном.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-lagman';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-lagman-1','rec-prod-lagman', i.id, 0.07 FROM "Insumo" i WHERE i.nombre = 'Говядина' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-lagman-2','rec-prod-lagman', i.id, 0.08 FROM "Insumo" i WHERE i.nombre = 'Лапша для лагмана' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-lagman-3','rec-prod-lagman', i.id, 0.04 FROM "Insumo" i WHERE i.nombre = 'Картофель' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-lagman-4','rec-prod-lagman', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Морковь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-lagman-5','rec-prod-lagman', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-lagman-6','rec-prod-lagman', i.id, 0.015 FROM "Insumo" i WHERE i.nombre = 'Томатная паста' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-lagman-7','rec-prod-lagman', i.id, 0.005 FROM "Insumo" i WHERE i.nombre = 'Чеснок' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-lagman-8','rec-prod-lagman', i.id, 0.015 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-lagman-9','rec-prod-lagman', i.id, 0.005 FROM "Insumo" i WHERE i.nombre = 'Зелень (укроп, петрушка)' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-lagman-10','rec-prod-lagman', i.id, 0.003 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-lagman-11','rec-prod-lagman', i.id, 0.001 FROM "Insumo" i WHERE i.nombre = 'Специи универсальные' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-solyanka', p.id, p."restauranteId", 350, 'Картофель отварить, добавить пассерованный лук с томатной пастой, нарезанные соленые огурцы, отварные говядину и курицу. Варить 5–10 минут, за 5 минут до готовности положить сметану. Подавать с лимоном.

Источник норм: Сборник рецептур для предприятий общественного питания при общеобразовательных школах, под ред. В. Т. Лапшиной (М.: Хлебпродинформ, 2004), рецептура № 157 «Солянка домашняя со сметаной» (выход 250 г), пересчитано на 350 г (×1,4); лимон — по технологии карты.', now() FROM "Producto" p WHERE p.id = 'prod-solyanka';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-solyanka-1','rec-prod-solyanka', i.id, 0.036 FROM "Insumo" i WHERE i.nombre = 'Говядина' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-solyanka-2','rec-prod-solyanka', i.id, 0.031 FROM "Insumo" i WHERE i.nombre = 'Куриное филе' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-solyanka-3','rec-prod-solyanka', i.id, 0.029 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-solyanka-4','rec-prod-solyanka', i.id, 0.035 FROM "Insumo" i WHERE i.nombre = 'Огурцы солёные' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-solyanka-5','rec-prod-solyanka', i.id, 0.076 FROM "Insumo" i WHERE i.nombre = 'Картофель' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-solyanka-6','rec-prod-solyanka', i.id, 0.005 FROM "Insumo" i WHERE i.nombre = 'Томатная паста' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-solyanka-7','rec-prod-solyanka', i.id, 0.006 FROM "Insumo" i WHERE i.nombre = 'Масло сливочное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-solyanka-8','rec-prod-solyanka', i.id, 0.007 FROM "Insumo" i WHERE i.nombre = 'Сметана' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-solyanka-9','rec-prod-solyanka', i.id, 0.01 FROM "Insumo" i WHERE i.nombre = 'Лимон' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-bulyon', p.id, p."restauranteId", 350, 'Куриное филе отварить, бульон процедить. Морковь и лук припустить с маслом, добавить картофель и макаронные изделия, варить до готовности.

Источник норм: Сборник рецептур для предприятий общественного питания при общеобразовательных школах, под ред. В. Т. Лапшиной (М.: Хлебпродинформ, 2004), карта № 140 «Суп с изделиями макаронными» (выход 250 г), пересчитано на 350 г (×1,4); куриное филе для бульона — расчётное.', now() FROM "Producto" p WHERE p.id = 'prod-bulyon';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-bulyon-1','rec-prod-bulyon', i.id, 0.08 FROM "Insumo" i WHERE i.nombre = 'Куриное филе' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-bulyon-2','rec-prod-bulyon', i.id, 0.014 FROM "Insumo" i WHERE i.nombre = 'Макаронные изделия' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-bulyon-3','rec-prod-bulyon', i.id, 0.14 FROM "Insumo" i WHERE i.nombre = 'Картофель' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-bulyon-4','rec-prod-bulyon', i.id, 0.018 FROM "Insumo" i WHERE i.nombre = 'Морковь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-bulyon-5','rec-prod-bulyon', i.id, 0.017 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-bulyon-6','rec-prod-bulyon', i.id, 0.004 FROM "Insumo" i WHERE i.nombre = 'Масло сливочное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-bulyon-7','rec-prod-bulyon', i.id, 0.001 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-shorpa', p.id, p."restauranteId", 400, 'Баранину варить на медленном огне до мягкости, добавить крупно нарезанные картофель, морковь, лук, помидоры. Подавать с зеленью.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-shorpa';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shorpa-1','rec-prod-shorpa', i.id, 0.1 FROM "Insumo" i WHERE i.nombre = 'Баранина' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shorpa-2','rec-prod-shorpa', i.id, 0.08 FROM "Insumo" i WHERE i.nombre = 'Картофель' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shorpa-3','rec-prod-shorpa', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Морковь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shorpa-4','rec-prod-shorpa', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shorpa-5','rec-prod-shorpa', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Помидоры' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shorpa-6','rec-prod-shorpa', i.id, 0.005 FROM "Insumo" i WHERE i.nombre = 'Зелень (укроп, петрушка)' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shorpa-7','rec-prod-shorpa', i.id, 0.003 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shorpa-8','rec-prod-shorpa', i.id, 0.001 FROM "Insumo" i WHERE i.nombre = 'Специи универсальные' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-pollo-entero', p.id, p."restauranteId", 450, 'Мясо (вырезка и суповой набор) отварить с луком и морковью, бульон процедить. Тесто на яйце и бульоне раскатать, нарезать пластами, отварить. Выложить на блюдо с мясом и луком, подавать с бульоном и зеленью.

Источник норм: ВкусВилл, рецепт «Бешбармак» на 7 порций (vkusvill.ru/media/recipes/beshbarmak.html): мясо 800 г, мука 400 г, яйцо 1 шт., лук, морковь — пересчитано на 1 порцию.', now() FROM "Producto" p WHERE p.id = 'prod-pollo-entero';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pollo-entero-1','rec-prod-pollo-entero', i.id, 0.114 FROM "Insumo" i WHERE i.nombre = 'Говядина' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pollo-entero-2','rec-prod-pollo-entero', i.id, 0.057 FROM "Insumo" i WHERE i.nombre = 'Мука пшеничная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pollo-entero-3','rec-prod-pollo-entero', i.id, 0.14 FROM "Insumo" i WHERE i.nombre = 'Яйцо куриное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pollo-entero-4','rec-prod-pollo-entero', i.id, 0.029 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pollo-entero-5','rec-prod-pollo-entero', i.id, 0.011 FROM "Insumo" i WHERE i.nombre = 'Морковь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pollo-entero-6','rec-prod-pollo-entero', i.id, 0.003 FROM "Insumo" i WHERE i.nombre = 'Зелень (укроп, петрушка)' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pollo-entero-7','rec-prod-pollo-entero', i.id, 0.002 FROM "Insumo" i WHERE i.nombre = 'Чеснок' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pollo-entero-8','rec-prod-pollo-entero', i.id, 0.002 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-medio-pollo', p.id, p."restauranteId", 350, 'Мясо обжарить в казане с луком и морковью, добавить нут и зиру, залить водой (зирвак). Заложить промытый рис, довести до готовности, настоять.

Источник норм: Госкомстат Республики Узбекистан, состав для «индекса плова» на 1 кг риса: 1 кг моркови, 0,7 кг говядины, 0,3 л масла, 0,3 кг лука, 0,1 кг нута, зира, соль (stat.uz, podrobno.uz); порция на 100 г риса.', now() FROM "Producto" p WHERE p.id = 'prod-medio-pollo';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-medio-pollo-1','rec-prod-medio-pollo', i.id, 0.1 FROM "Insumo" i WHERE i.nombre = 'Рис' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-medio-pollo-2','rec-prod-medio-pollo', i.id, 0.1 FROM "Insumo" i WHERE i.nombre = 'Морковь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-medio-pollo-3','rec-prod-medio-pollo', i.id, 0.07 FROM "Insumo" i WHERE i.nombre = 'Говядина' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-medio-pollo-4','rec-prod-medio-pollo', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-medio-pollo-5','rec-prod-medio-pollo', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-medio-pollo-6','rec-prod-medio-pollo', i.id, 0.01 FROM "Insumo" i WHERE i.nombre = 'Нут' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-medio-pollo-7','rec-prod-medio-pollo', i.id, 0.001 FROM "Insumo" i WHERE i.nombre = 'Специи универсальные' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-medio-pollo-8','rec-prod-medio-pollo', i.id, 0.002 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-cuarto-pollo', p.id, p."restauranteId", 250, 'Филе отбить, завернуть кусочек масла, запанировать в муке, яйце и сухарях, обжарить во фритюре. Подать с картофельным пюре.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-cuarto-pollo';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-cuarto-pollo-1','rec-prod-cuarto-pollo', i.id, 0.14 FROM "Insumo" i WHERE i.nombre = 'Куриное филе' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-cuarto-pollo-2','rec-prod-cuarto-pollo', i.id, 0.035 FROM "Insumo" i WHERE i.nombre = 'Масло сливочное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-cuarto-pollo-3','rec-prod-cuarto-pollo', i.id, 0.5 FROM "Insumo" i WHERE i.nombre = 'Яйцо куриное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-cuarto-pollo-4','rec-prod-cuarto-pollo', i.id, 0.01 FROM "Insumo" i WHERE i.nombre = 'Мука пшеничная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-cuarto-pollo-5','rec-prod-cuarto-pollo', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Сухари панировочные' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-cuarto-pollo-6','rec-prod-cuarto-pollo', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-cuarto-pollo-7','rec-prod-cuarto-pollo', i.id, 0.15 FROM "Insumo" i WHERE i.nombre = 'Картофель' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-cuarto-pollo-8','rec-prod-cuarto-pollo', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Молоко' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-cuarto-pollo-9','rec-prod-cuarto-pollo', i.id, 0.003 FROM "Insumo" i WHERE i.nombre = 'Зелень (укроп, петрушка)' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-cuarto-pollo-10','rec-prod-cuarto-pollo', i.id, 0.002 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-octavo-pollo', p.id, p."restauranteId", 150, 'Филе нарезать кусочками, замариновать с луком и приправой на 2–3 часа, нанизать на шампур, жарить на углях.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-octavo-pollo';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-octavo-pollo-1','rec-prod-octavo-pollo', i.id, 0.14 FROM "Insumo" i WHERE i.nombre = 'Куриное филе' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-octavo-pollo-2','rec-prod-octavo-pollo', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-octavo-pollo-3','rec-prod-octavo-pollo', i.id, 0.002 FROM "Insumo" i WHERE i.nombre = 'Приправа для курицы' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-octavo-pollo-4','rec-prod-octavo-pollo', i.id, 0.002 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-octavo-pollo-5','rec-prod-octavo-pollo', i.id, 0.1 FROM "Insumo" i WHERE i.nombre = 'Древесный уголь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-octavo-pollo-6','rec-prod-octavo-pollo', i.id, 0.005 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-pelmeni', p.id, p."restauranteId", 300, 'Тесто из муки, яйца и воды, начинка из фарша с луком. Лепить, варить 7–8 минут после всплытия. Подавать со сметаной.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-pelmeni';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pelmeni-1','rec-prod-pelmeni', i.id, 0.1 FROM "Insumo" i WHERE i.nombre = 'Мука пшеничная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pelmeni-2','rec-prod-pelmeni', i.id, 0.1 FROM "Insumo" i WHERE i.nombre = 'Фарш мясной' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pelmeni-3','rec-prod-pelmeni', i.id, 0.02 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pelmeni-4','rec-prod-pelmeni', i.id, 0.2 FROM "Insumo" i WHERE i.nombre = 'Яйцо куриное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pelmeni-5','rec-prod-pelmeni', i.id, 0.003 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-pelmeni-6','rec-prod-pelmeni', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Сметана' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-manty', p.id, p."restauranteId", 250, 'Тесто раскатать, заполнить рубленым мясом с луком, защипнуть, готовить на пару 40–45 минут.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-manty';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-manty-1','rec-prod-manty', i.id, 0.09 FROM "Insumo" i WHERE i.nombre = 'Мука пшеничная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-manty-2','rec-prod-manty', i.id, 0.1 FROM "Insumo" i WHERE i.nombre = 'Говядина' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-manty-3','rec-prod-manty', i.id, 0.07 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-manty-4','rec-prod-manty', i.id, 0.003 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-manty-5','rec-prod-manty', i.id, 0.005 FROM "Insumo" i WHERE i.nombre = 'Масло сливочное' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-golubtsy', p.id, p."restauranteId", 300, 'Капустные листья ошпарить, завернуть фарш с рисом, уложить в соус из томатной пасты, моркови и лука, тушить. Подать со сметаной.

Источник норм: Лайфхакер, «Классические голубцы» на 6 порций (фарш 1 кг, рис 150 г, томатная паста 150–200 г) и Lady.mail.ru (ленивые голубцы на 4 порции) — пересчитано на 1 порцию.', now() FROM "Producto" p WHERE p.id = 'prod-golubtsy';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-golubtsy-1','rec-prod-golubtsy', i.id, 0.15 FROM "Insumo" i WHERE i.nombre = 'Капуста белокочанная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-golubtsy-2','rec-prod-golubtsy', i.id, 0.15 FROM "Insumo" i WHERE i.nombre = 'Фарш мясной' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-golubtsy-3','rec-prod-golubtsy', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Рис' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-golubtsy-4','rec-prod-golubtsy', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-golubtsy-5','rec-prod-golubtsy', i.id, 0.02 FROM "Insumo" i WHERE i.nombre = 'Морковь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-golubtsy-6','rec-prod-golubtsy', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Томатная паста' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-golubtsy-7','rec-prod-golubtsy', i.id, 0.02 FROM "Insumo" i WHERE i.nombre = 'Сметана' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-golubtsy-8','rec-prod-golubtsy', i.id, 0.01 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-stroganov', p.id, p."restauranteId", 300, 'Отварное мясо нарезать соломкой, соединить с протёртой отварной морковью и сметанным соусом, тушить 5–10 минут. Подавать с рассыпчатой гречкой.

Источник норм: Сборник технологических нормативов для школ, под ред. А. Я. Перевалова (Уральский региональный центр питания, 2013), рецептура № 366/442 «Бефстроганов из отварной говядины» (выход 100 г), пересчитано на 150 г мяса с соусом; гарнир — Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), № 171.', now() FROM "Producto" p WHERE p.id = 'prod-stroganov';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-stroganov-1','rec-prod-stroganov', i.id, 0.132 FROM "Insumo" i WHERE i.nombre = 'Говядина' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-stroganov-2','rec-prod-stroganov', i.id, 0.019 FROM "Insumo" i WHERE i.nombre = 'Морковь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-stroganov-3','rec-prod-stroganov', i.id, 0.004 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-stroganov-4','rec-prod-stroganov', i.id, 0.0023 FROM "Insumo" i WHERE i.nombre = 'Мука пшеничная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-stroganov-5','rec-prod-stroganov', i.id, 0.01 FROM "Insumo" i WHERE i.nombre = 'Масло сливочное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-stroganov-6','rec-prod-stroganov', i.id, 0.044 FROM "Insumo" i WHERE i.nombre = 'Сметана' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-stroganov-7','rec-prod-stroganov', i.id, 0.06 FROM "Insumo" i WHERE i.nombre = 'Гречневая крупа' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-stroganov-8','rec-prod-stroganov', i.id, 0.003 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-combo-personal', p.id, p."restauranteId", NULL, 'Комплексный обед: салат «Оливье» + борщ + бефстроганов с гречкой + компот. Списывается как набор блюд.', now() FROM "Producto" p WHERE p.id = 'prod-combo-personal';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-personal-1','rec-prod-combo-personal','prod-ensalada',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-personal-2','rec-prod-combo-personal','prod-borsch',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-personal-3','rec-prod-combo-personal','prod-stroganov',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-personal-4','rec-prod-combo-personal','prod-kompot',1);
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-combo-broaster', p.id, p."restauranteId", NULL, 'Лёгкий обед: бульон + винегрет + хлеб + чай.', now() FROM "Producto" p WHERE p.id = 'prod-combo-broaster';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-broaster-1','rec-prod-combo-broaster','prod-bulyon',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-broaster-2','rec-prod-combo-broaster','prod-vinegret',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-broaster-3','rec-prod-combo-broaster','prod-hleb',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-broaster-4','rec-prod-combo-broaster','prod-chai-black',1);
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-combo-duo', p.id, p."restauranteId", NULL, 'Сет для двоих: пельмени + салат «Оливье» + 2 компота.', now() FROM "Producto" p WHERE p.id = 'prod-combo-duo';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-duo-1','rec-prod-combo-duo','prod-pelmeni',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-duo-2','rec-prod-combo-duo','prod-ensalada',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-duo-3','rec-prod-combo-duo','prod-kompot',2);
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-combo-familiar', p.id, p."restauranteId", NULL, 'Семейный сет: бешбармак + салат «Оливье» + самса + 4 компота.', now() FROM "Producto" p WHERE p.id = 'prod-combo-familiar';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-familiar-1','rec-prod-combo-familiar','prod-pollo-entero',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-familiar-2','rec-prod-combo-familiar','prod-ensalada',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-familiar-3','rec-prod-combo-familiar','prod-samsa',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-familiar-4','rec-prod-combo-familiar','prod-kompot',4);
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-combo-broaster2', p.id, p."restauranteId", NULL, 'Праздничный сет: плов + шашлык + салат «Оливье» + 4 компота.', now() FROM "Producto" p WHERE p.id = 'prod-combo-broaster2';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-broaster2-1','rec-prod-combo-broaster2','prod-medio-pollo',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-broaster2-2','rec-prod-combo-broaster2','prod-octavo-pollo',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-broaster2-3','rec-prod-combo-broaster2','prod-ensalada',1);
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) VALUES ('ri-prod-combo-broaster2-4','rec-prod-combo-broaster2','prod-kompot',4);
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-papas-fritas', p.id, p."restauranteId", 150, 'Картофель нарезать брусочками, обсушить, обжарить во фритюре до золотистой корочки, посолить.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-papas-fritas';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-papas-fritas-1','rec-prod-papas-fritas', i.id, 0.2 FROM "Insumo" i WHERE i.nombre = 'Картофель' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-papas-fritas-2','rec-prod-papas-fritas', i.id, 0.04 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-papas-fritas-3','rec-prod-papas-fritas', i.id, 0.002 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-yuca-frita', p.id, p."restauranteId", 200, 'Картофель отварить, растереть горячим, вводя кипячёное молоко и растопленное сливочное масло, взбить до однородности.

Источник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 312 «Пюре картофельное» (выход 200 г).', now() FROM "Producto" p WHERE p.id = 'prod-yuca-frita';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-yuca-frita-1','rec-prod-yuca-frita', i.id, 0.246 FROM "Insumo" i WHERE i.nombre = 'Картофель' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-yuca-frita-2','rec-prod-yuca-frita', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Молоко' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-yuca-frita-3','rec-prod-yuca-frita', i.id, 0.006 FROM "Insumo" i WHERE i.nombre = 'Масло сливочное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-yuca-frita-4','rec-prod-yuca-frita', i.id, 0.001 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-ensalada', p.id, p."restauranteId", 150, 'Отварные картофель, морковь и яйца, колбасу и соленые огурцы нарезать кубиком, добавить горошек, заправить майонезом.

Источник норм: Лайфхакер и Lady.mail.ru, классический «Оливье» на 8 порций (колбаса 350 г, горошек 300 г, яйца 5 шт.) — пересчитано на 1 порцию.', now() FROM "Producto" p WHERE p.id = 'prod-ensalada';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-ensalada-1','rec-prod-ensalada', i.id, 0.044 FROM "Insumo" i WHERE i.nombre = 'Колбаса варёная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-ensalada-2','rec-prod-ensalada', i.id, 0.037 FROM "Insumo" i WHERE i.nombre = 'Горошек консервированный' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-ensalada-3','rec-prod-ensalada', i.id, 0.63 FROM "Insumo" i WHERE i.nombre = 'Яйцо куриное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-ensalada-4','rec-prod-ensalada', i.id, 0.055 FROM "Insumo" i WHERE i.nombre = 'Картофель' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-ensalada-5','rec-prod-ensalada', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Морковь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-ensalada-6','rec-prod-ensalada', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Огурцы солёные' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-ensalada-7','rec-prod-ensalada', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Майонез' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-ensalada-8','rec-prod-ensalada', i.id, 0.005 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-ensalada-9','rec-prod-ensalada', i.id, 0.001 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-arroz', p.id, p."restauranteId", 150, 'Крупу перебрать, промыть, всыпать в кипящую подсоленную воду, варить до загустения и довести до готовности под крышкой. Заправить сливочным маслом.

Источник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 171 «Каша рассыпчатая» (гречневая, выход 150 г).', now() FROM "Producto" p WHERE p.id = 'prod-arroz';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-arroz-1','rec-prod-arroz', i.id, 0.067 FROM "Insumo" i WHERE i.nombre = 'Гречневая крупа' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-arroz-2','rec-prod-arroz', i.id, 0.009 FROM "Insumo" i WHERE i.nombre = 'Масло сливочное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-arroz-3','rec-prod-arroz', i.id, 0.001 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-chaufa-arroz', p.id, p."restauranteId", 250, 'Макароны отварить в подсоленной воде. Фарш обжарить с луком и томатной пастой, соединить с макаронами, заправить маслом.

Источник норм: Макароны — Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 203 (отварные макаронные изделия, 53 г на 160 г готовых); фарш и овощи — ориентировочно.', now() FROM "Producto" p WHERE p.id = 'prod-chaufa-arroz';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chaufa-arroz-1','rec-prod-chaufa-arroz', i.id, 0.06 FROM "Insumo" i WHERE i.nombre = 'Макаронные изделия' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chaufa-arroz-2','rec-prod-chaufa-arroz', i.id, 0.08 FROM "Insumo" i WHERE i.nombre = 'Фарш мясной' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chaufa-arroz-3','rec-prod-chaufa-arroz', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chaufa-arroz-4','rec-prod-chaufa-arroz', i.id, 0.01 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chaufa-arroz-5','rec-prod-chaufa-arroz', i.id, 0.01 FROM "Insumo" i WHERE i.nombre = 'Томатная паста' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chaufa-arroz-6','rec-prod-chaufa-arroz', i.id, 0.006 FROM "Insumo" i WHERE i.nombre = 'Масло сливочное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chaufa-arroz-7','rec-prod-chaufa-arroz', i.id, 0.002 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-vinegret', p.id, p."restauranteId", 150, 'Отварные свёклу, картофель, морковь нарезать кубиком, смешать с огурцом, горошком и луком, заправить маслом.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-vinegret';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-vinegret-1','rec-prod-vinegret', i.id, 0.06 FROM "Insumo" i WHERE i.nombre = 'Свёкла' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-vinegret-2','rec-prod-vinegret', i.id, 0.04 FROM "Insumo" i WHERE i.nombre = 'Картофель' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-vinegret-3','rec-prod-vinegret', i.id, 0.02 FROM "Insumo" i WHERE i.nombre = 'Морковь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-vinegret-4','rec-prod-vinegret', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Огурцы солёные' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-vinegret-5','rec-prod-vinegret', i.id, 0.015 FROM "Insumo" i WHERE i.nombre = 'Горошек консервированный' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-vinegret-6','rec-prod-vinegret', i.id, 0.01 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-vinegret-7','rec-prod-vinegret', i.id, 0.01 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-caesar', p.id, p."restauranteId", 200, 'Куриное филе обжарить, нарезать. Салат романо, помидоры, сыр и сухарики смешать с соусом.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-caesar';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-caesar-1','rec-prod-caesar', i.id, 0.08 FROM "Insumo" i WHERE i.nombre = 'Куриное филе' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-caesar-2','rec-prod-caesar', i.id, 0.05 FROM "Insumo" i WHERE i.nombre = 'Салат романо' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-caesar-3','rec-prod-caesar', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Помидоры' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-caesar-4','rec-prod-caesar', i.id, 0.015 FROM "Insumo" i WHERE i.nombre = 'Сыр твёрдый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-caesar-5','rec-prod-caesar', i.id, 0.015 FROM "Insumo" i WHERE i.nombre = 'Сухари панировочные' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-caesar-6','rec-prod-caesar', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Майонез' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-caesar-7','rec-prod-caesar', i.id, 0.002 FROM "Insumo" i WHERE i.nombre = 'Чеснок' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-shuba', p.id, p."restauranteId", 180, 'Слоями: сельдь, картофель, морковь, лук, свёкла, яйцо; каждый слой промазать майонезом. Настоять не менее 2 часов.

Источник норм: Сельдь — Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 76 (филе 58 г на порцию 60 г); остальные слои — ориентировочно.', now() FROM "Producto" p WHERE p.id = 'prod-shuba';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shuba-1','rec-prod-shuba', i.id, 0.06 FROM "Insumo" i WHERE i.nombre = 'Сельдь солёная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shuba-2','rec-prod-shuba', i.id, 0.05 FROM "Insumo" i WHERE i.nombre = 'Картофель' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shuba-3','rec-prod-shuba', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Морковь' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shuba-4','rec-prod-shuba', i.id, 0.05 FROM "Insumo" i WHERE i.nombre = 'Свёкла' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shuba-5','rec-prod-shuba', i.id, 0.015 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shuba-6','rec-prod-shuba', i.id, 0.3 FROM "Insumo" i WHERE i.nombre = 'Яйцо куриное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-shuba-7','rec-prod-shuba', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Майонез' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-hleb', p.id, p."restauranteId", NULL, 'Лепёшка из тандыра или свежий хлеб, 1 шт.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-hleb';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-hleb-1','rec-prod-hleb', i.id, 1 FROM "Insumo" i WHERE i.nombre = 'Лепёшка' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-samsa', p.id, p."restauranteId", 150, 'Слоёное тесто, начинка из рубленой говядины с луком и маслом, выпекать 25–30 минут.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-samsa';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-samsa-1','rec-prod-samsa', i.id, 0.07 FROM "Insumo" i WHERE i.nombre = 'Мука пшеничная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-samsa-2','rec-prod-samsa', i.id, 0.06 FROM "Insumo" i WHERE i.nombre = 'Говядина' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-samsa-3','rec-prod-samsa', i.id, 0.06 FROM "Insumo" i WHERE i.nombre = 'Лук репчатый' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-samsa-4','rec-prod-samsa', i.id, 0.015 FROM "Insumo" i WHERE i.nombre = 'Масло сливочное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-samsa-5','rec-prod-samsa', i.id, 0.1 FROM "Insumo" i WHERE i.nombre = 'Яйцо куриное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-samsa-6','rec-prod-samsa', i.id, 0.002 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-blini', p.id, p."restauranteId", 200, 'Тонкие блины на молоке и яйце, начинка из творога с сахаром. Подавать со сметаной.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-blini';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-blini-1','rec-prod-blini', i.id, 0.05 FROM "Insumo" i WHERE i.nombre = 'Мука пшеничная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-blini-2','rec-prod-blini', i.id, 0.12 FROM "Insumo" i WHERE i.nombre = 'Молоко' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-blini-3','rec-prod-blini', i.id, 1 FROM "Insumo" i WHERE i.nombre = 'Яйцо куриное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-blini-4','rec-prod-blini', i.id, 0.08 FROM "Insumo" i WHERE i.nombre = 'Творог' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-blini-5','rec-prod-blini', i.id, 0.015 FROM "Insumo" i WHERE i.nombre = 'Сахар' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-blini-6','rec-prod-blini', i.id, 0.015 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-blini-7','rec-prod-blini', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Сметана' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-syrniki', p.id, p."restauranteId", 180, 'Творог смешать с яйцом, мукой и сахаром, сформовать, обжарить с двух сторон до золотистой корочки. Подавать со сметаной.

Источник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 219 «Сырники из творога» (для 12+ лет, выход 150 г), пересчитано на 180 г; вместо сгущённого молока — сметана.', now() FROM "Producto" p WHERE p.id = 'prod-syrniki';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-syrniki-1','rec-prod-syrniki', i.id, 0.167 FROM "Insumo" i WHERE i.nombre = 'Творог' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-syrniki-2','rec-prod-syrniki', i.id, 0.17 FROM "Insumo" i WHERE i.nombre = 'Яйцо куриное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-syrniki-3','rec-prod-syrniki', i.id, 0.024 FROM "Insumo" i WHERE i.nombre = 'Мука пшеничная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-syrniki-4','rec-prod-syrniki', i.id, 0.017 FROM "Insumo" i WHERE i.nombre = 'Сахар' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-syrniki-5','rec-prod-syrniki', i.id, 0.006 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-syrniki-6','rec-prod-syrniki', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Сметана' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-napoleon', p.id, p."restauranteId", 120, 'Слоёные коржи промазать заварным кремом (молоко, яйцо, сахар, масло), выдержать в холоде 6–8 часов.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-napoleon';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-napoleon-1','rec-prod-napoleon', i.id, 0.04 FROM "Insumo" i WHERE i.nombre = 'Мука пшеничная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-napoleon-2','rec-prod-napoleon', i.id, 0.04 FROM "Insumo" i WHERE i.nombre = 'Масло сливочное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-napoleon-3','rec-prod-napoleon', i.id, 0.06 FROM "Insumo" i WHERE i.nombre = 'Молоко' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-napoleon-4','rec-prod-napoleon', i.id, 0.5 FROM "Insumo" i WHERE i.nombre = 'Яйцо куриное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-napoleon-5','rec-prod-napoleon', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Сахар' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-chak-chak', p.id, p."restauranteId", 80, 'Жареные полоски теста соединить горячим мёдом с сахаром, придать форму.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-chak-chak';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chak-chak-1','rec-prod-chak-chak', i.id, 0.035 FROM "Insumo" i WHERE i.nombre = 'Мука пшеничная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chak-chak-2','rec-prod-chak-chak', i.id, 0.7 FROM "Insumo" i WHERE i.nombre = 'Яйцо куриное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chak-chak-3','rec-prod-chak-chak', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Мёд' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chak-chak-4','rec-prod-chak-chak', i.id, 0.01 FROM "Insumo" i WHERE i.nombre = 'Сахар' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chak-chak-5','rec-prod-chak-chak', i.id, 0.015 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-baursaki', p.id, p."restauranteId", 100, 'Дрожжевое тесто, раскатать, нарезать ромбами, обжарить во фритюре.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-baursaki';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-baursaki-1','rec-prod-baursaki', i.id, 0.06 FROM "Insumo" i WHERE i.nombre = 'Мука пшеничная' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-baursaki-2','rec-prod-baursaki', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Молоко' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-baursaki-3','rec-prod-baursaki', i.id, 0.3 FROM "Insumo" i WHERE i.nombre = 'Яйцо куриное' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-baursaki-4','rec-prod-baursaki', i.id, 0.04 FROM "Insumo" i WHERE i.nombre = 'Растительное масло' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-baursaki-5','rec-prod-baursaki', i.id, 0.005 FROM "Insumo" i WHERE i.nombre = 'Сахар' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-baursaki-6','rec-prod-baursaki', i.id, 0.001 FROM "Insumo" i WHERE i.nombre = 'Соль' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-coca-personal', p.id, p."restauranteId", 500, 'Готовый напиток, 1 бутылка.', now() FROM "Producto" p WHERE p.id = 'prod-coca-personal';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-coca-personal-1','rec-prod-coca-personal', i.id, 1 FROM "Insumo" i WHERE i.nombre = 'Coca-Cola 0,5 л' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-coca-grande', p.id, p."restauranteId", 1500, 'Готовый напиток, 1 бутылка.', now() FROM "Producto" p WHERE p.id = 'prod-coca-grande';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-coca-grande-1','rec-prod-coca-grande', i.id, 1 FROM "Insumo" i WHERE i.nombre = 'Coca-Cola 1,5 л' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-inca-personal', p.id, p."restauranteId", 500, 'Готовый напиток, 1 бутылка.', now() FROM "Producto" p WHERE p.id = 'prod-inca-personal';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-inca-personal-1','rec-prod-inca-personal', i.id, 1 FROM "Insumo" i WHERE i.nombre = 'Pepsi 0,5 л' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-inca-grande', p.id, p."restauranteId", 1500, 'Готовый напиток, 1 бутылка.', now() FROM "Producto" p WHERE p.id = 'prod-inca-grande';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-inca-grande-1','rec-prod-inca-grande', i.id, 1 FROM "Insumo" i WHERE i.nombre = 'Pepsi 1,5 л' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-agua', p.id, p."restauranteId", 500, 'Готовый напиток, 1 бутылка.', now() FROM "Producto" p WHERE p.id = 'prod-agua';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-agua-1','rec-prod-agua', i.id, 1 FROM "Insumo" i WHERE i.nombre = 'Вода минеральная 0,5 л' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-limonada', p.id, p."restauranteId", 350, 'Лимон выжать, смешать с сахарным сиропом, добавить воду и лёд.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-limonada';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-limonada-1','rec-prod-limonada', i.id, 0.04 FROM "Insumo" i WHERE i.nombre = 'Лимон' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-limonada-2','rec-prod-limonada', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Сахар' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-chicha', p.id, p."restauranteId", 300, 'Клюкву протереть, сварить с сахаром, остудить.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-chicha';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chicha-1','rec-prod-chicha', i.id, 0.06 FROM "Insumo" i WHERE i.nombre = 'Клюква' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chicha-2','rec-prod-chicha', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Сахар' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-kompot', p.id, p."restauranteId", 250, 'Сухофрукты промыть, варить 20 минут с сахаром, настоять.

Источник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 348 «Компот из кураги» (180 мл), пересчитано на 250 мл; вместо кураги — сухофрукты.', now() FROM "Producto" p WHERE p.id = 'prod-kompot';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-kompot-1','rec-prod-kompot', i.id, 0.053 FROM "Insumo" i WHERE i.nombre = 'Сухофрукты' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-kompot-2','rec-prod-kompot', i.id, 0.0125 FROM "Insumo" i WHERE i.nombre = 'Сахар' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-chai-black', p.id, p."restauranteId", 500, 'Заварить чёрный чай в чайнике на 500 мл, подать с сахаром и лимоном.

Источник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 375/377 «Чай с сахаром и лимоном» (200 мл), пересчитано на чайник 500 мл (×2,5).', now() FROM "Producto" p WHERE p.id = 'prod-chai-black';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chai-black-1','rec-prod-chai-black', i.id, 0.0025 FROM "Insumo" i WHERE i.nombre = 'Чай чёрный' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chai-black-2','rec-prod-chai-black', i.id, 0.022 FROM "Insumo" i WHERE i.nombre = 'Сахар' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chai-black-3','rec-prod-chai-black', i.id, 0.015 FROM "Insumo" i WHERE i.nombre = 'Лимон' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-chai-green', p.id, p."restauranteId", 500, 'Заварить зелёный чай в чайнике на 500 мл.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-chai-green';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-chai-green-1','rec-prod-chai-green', i.id, 0.005 FROM "Insumo" i WHERE i.nombre = 'Чай зелёный' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-coffee', p.id, p."restauranteId", 200, 'Эспрессо из зерновых 12 г, долить горячую воду.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-coffee';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-coffee-1','rec-prod-coffee', i.id, 0.012 FROM "Insumo" i WHERE i.nombre = 'Кофе зерновой' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-ayran', p.id, p."restauranteId", 300, 'Готовый напиток, стакан 300 мл.', now() FROM "Producto" p WHERE p.id = 'prod-ayran';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-ayran-1','rec-prod-ayran', i.id, 0.3 FROM "Insumo" i WHERE i.nombre = 'Айран' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-kvas', p.id, p."restauranteId", 300, 'Готовый напиток, стакан 300 мл.', now() FROM "Producto" p WHERE p.id = 'prod-kvas';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-kvas-1','rec-prod-kvas', i.id, 0.3 FROM "Insumo" i WHERE i.nombre = 'Квас' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-ketchup', p.id, p."restauranteId", 30, 'Порция кетчупа.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-ketchup';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-ketchup-1','rec-prod-ketchup', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Кетчуп' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-mayonesa', p.id, p."restauranteId", 30, 'Порция майонеза.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-mayonesa';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-mayonesa-1','rec-prod-mayonesa', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Майонез' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-aji-verde', p.id, p."restauranteId", 40, 'Порция сметаны.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-aji-verde';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-aji-verde-1','rec-prod-aji-verde', i.id, 0.04 FROM "Insumo" i WHERE i.nombre = 'Сметана' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-salsa-criolla', p.id, p."restauranteId", 30, 'Порция аджики.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-salsa-criolla';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-salsa-criolla-1','rec-prod-salsa-criolla', i.id, 0.03 FROM "Insumo" i WHERE i.nombre = 'Аджика' LIMIT 1;
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-prod-salsa-huancaina', p.id, p."restauranteId", 30, 'Майонез смешать с измельчённым чесноком.

Нормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.', now() FROM "Producto" p WHERE p.id = 'prod-salsa-huancaina';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-salsa-huancaina-1','rec-prod-salsa-huancaina', i.id, 0.025 FROM "Insumo" i WHERE i.nombre = 'Майонез' LIMIT 1;
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad) SELECT 'ri-prod-salsa-huancaina-2','rec-prod-salsa-huancaina', i.id, 0.005 FROM "Insumo" i WHERE i.nombre = 'Чеснок' LIMIT 1;
COMMIT;