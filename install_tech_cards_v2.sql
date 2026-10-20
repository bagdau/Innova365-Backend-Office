-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Тех-карты из документа «Технологические паспорта блюд и напитков» (редакция 1.0, 51 позиция).
-- ЗАМЕНЯЕТ install_tech_cards.sql: запускать ВМЕСТО него (или после него — перезапишет тех-карты).
-- Применять ПОСЛЕ запуска обновлённого backend (он создаёт таблицы Receta / RecetaItem).
-- Скрипт идемпотентный: тех-карты пересоздаются, складские позиции не дублируются, цены меню не меняются.
--
-- ЧТО ДЕЛАЕТ:
--  • для каждого из 51 блюда пересоздаёт тех-карту: состав (нетто, г/мл → кг/л/шт склада), выход, технология, контроль, аллергены;
--  • наборы К01–К05 собираются из тех-карт блюд (доля порции = масса в наборе / масса порции блюда);
--  • недостающие складские позиции создаются (закупочные цены и начальные остатки УСЛОВНЫЕ — выставьте реальные через «Склад → Ревизия» и «Закупки»);
--  • вода и лёд в состав не включаются (в тексте технологии указаны), иначе склад уходил бы в минус.
-- Допущения: 1 яйцо = 45 г; плотность масла 0,92, молока 1,03; бутылка Coca-Cola/Pepsi/воды = 1 шт склада; лепёшка 50 г = 1 шт.
-- ═══════════════════════════════════════════════════════════════════════════════════════
BEGIN;

-- 1. Складские позиции (создаются, только если ещё нет с таким названием)
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-01','Говядина','Мясо','кг',40,10,3800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Говядина');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-01', i."restauranteId", i.id, 'INICIAL', 40, 40, 3800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-01' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 3800 WHERE nombre = 'Говядина' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-02','Свёкла','Овощи','кг',12,4,200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Свёкла');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-02', i."restauranteId", i.id, 'INICIAL', 12, 12, 200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-02' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 200 WHERE nombre = 'Свёкла' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-03','Капуста белокочанная','Овощи','кг',20,6,180,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Капуста белокочанная');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-03', i."restauranteId", i.id, 'INICIAL', 20, 20, 180, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-03' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 180 WHERE nombre = 'Капуста белокочанная' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-04','Картофель','Овощи','кг',24.92,10,250,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Картофель');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-04', i."restauranteId", i.id, 'INICIAL', 24.92, 24.92, 250, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-04' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 250 WHERE nombre = 'Картофель' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-05','Морковь','Овощи','кг',25,8,200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Морковь');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-05', i."restauranteId", i.id, 'INICIAL', 25, 25, 200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-05' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 200 WHERE nombre = 'Морковь' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-06','Лук репчатый','Овощи','кг',25,8,150,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Лук репчатый');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-06', i."restauranteId", i.id, 'INICIAL', 25, 25, 150, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-06' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 150 WHERE nombre = 'Лук репчатый' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-07','Томатная паста','Консервы','кг',15,2,900,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Томатная паста');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-07', i."restauranteId", i.id, 'INICIAL', 15, 15, 900, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-07' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 900 WHERE nombre = 'Томатная паста' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-08','Растительное масло','Масла','л',10,4,900,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Растительное масло');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-08', i."restauranteId", i.id, 'INICIAL', 10, 10, 900, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-08' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 900 WHERE nombre = 'Растительное масло' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-09','Сок лимона','Бакалея','л',5,1,1800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сок лимона');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-09', i."restauranteId", i.id, 'INICIAL', 5, 5, 1800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-09' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1800 WHERE nombre = 'Сок лимона' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-10','Сахар','Бакалея','кг',25.001,8,500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сахар');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-10', i."restauranteId", i.id, 'INICIAL', 25.001, 25.001, 500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-10' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 500 WHERE nombre = 'Сахар' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-11','Соль','Специи','кг',4.993,2,100,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Соль');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-11', i."restauranteId", i.id, 'INICIAL', 4.993, 4.993, 100, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-11' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 100 WHERE nombre = 'Соль' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-12','Перец чёрный молотый','Специи','г',1000,200,8,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Перец чёрный молотый');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-12', i."restauranteId", i.id, 'INICIAL', 1000, 1000, 8, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-12' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 8 WHERE nombre = 'Перец чёрный молотый' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-13','Лавровый лист','Специи','г',500,100,6,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Лавровый лист');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-13', i."restauranteId", i.id, 'INICIAL', 500, 500, 6, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-13' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 6 WHERE nombre = 'Лавровый лист' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-14','Зелень (укроп, петрушка)','Овощи','кг',3,1,1500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Зелень (укроп, петрушка)');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-14', i."restauranteId", i.id, 'INICIAL', 3, 3, 1500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-14' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1500 WHERE nombre = 'Зелень (укроп, петрушка)' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-15','Сметана','Молочные','кг',12,4,1500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сметана');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-15', i."restauranteId", i.id, 'INICIAL', 12, 12, 1500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-15' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1500 WHERE nombre = 'Сметана' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-16','Куриное бедро без кости','Мясо','кг',15,5,2100,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Куриное бедро без кости');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-16', i."restauranteId", i.id, 'INICIAL', 15, 15, 2100, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-16' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 2100 WHERE nombre = 'Куриное бедро без кости' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-17','Лапша пшеничная сухая','Бакалея','кг',10,3,700,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Лапша пшеничная сухая');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-17', i."restauranteId", i.id, 'INICIAL', 10, 10, 700, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-17' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 700 WHERE nombre = 'Лапша пшеничная сухая' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-18','Яйцо куриное','Яйца','шт',240,60,60,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Яйцо куриное');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-18', i."restauranteId", i.id, 'INICIAL', 240, 240, 60, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-18' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 60 WHERE nombre = 'Яйцо куриное' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-19','Лапша для лагмана','Бакалея','кг',10,3,900,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Лапша для лагмана');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-19', i."restauranteId", i.id, 'INICIAL', 10, 10, 900, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-19' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 900 WHERE nombre = 'Лапша для лагмана' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-20','Перец сладкий','Овощи','кг',5,2,1200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Перец сладкий');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-20', i."restauranteId", i.id, 'INICIAL', 5, 5, 1200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-20' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1200 WHERE nombre = 'Перец сладкий' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-21','Помидоры','Овощи','кг',3.97,2,800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Помидоры');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-21', i."restauranteId", i.id, 'INICIAL', 3.97, 3.97, 800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-21' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 800 WHERE nombre = 'Помидоры' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-22','Редька','Овощи','кг',3,1,350,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Редька');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-22', i."restauranteId", i.id, 'INICIAL', 3, 3, 350, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-22' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 350 WHERE nombre = 'Редька' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-23','Чеснок','Овощи','кг',3,1,1500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Чеснок');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-23', i."restauranteId", i.id, 'INICIAL', 3, 3, 1500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-23' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1500 WHERE nombre = 'Чеснок' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-24','Зира','Специи','г',500,100,7,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Зира');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-24', i."restauranteId", i.id, 'INICIAL', 500, 500, 7, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-24' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 7 WHERE nombre = 'Зира' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-25','Паприка','Специи','г',500,100,6,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Паприка');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-25', i."restauranteId", i.id, 'INICIAL', 500, 500, 6, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-25' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 6 WHERE nombre = 'Паприка' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-26','Ветчина','Мясо','кг',5,2,3200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Ветчина');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-26', i."restauranteId", i.id, 'INICIAL', 5, 5, 3200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-26' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 3200 WHERE nombre = 'Ветчина' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-27','Колбаса варёно-копчёная','Мясо','кг',5,2,3500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Колбаса варёно-копчёная');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-27', i."restauranteId", i.id, 'INICIAL', 5, 5, 3500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-27' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 3500 WHERE nombre = 'Колбаса варёно-копчёная' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-28','Огурцы солёные','Консервы','кг',6,2,900,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Огурцы солёные');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-28', i."restauranteId", i.id, 'INICIAL', 6, 6, 900, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-28' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 900 WHERE nombre = 'Огурцы солёные' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-29','Маслины без косточек','Консервы','кг',2,0.5,3500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Маслины без косточек');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-29', i."restauranteId", i.id, 'INICIAL', 2, 2, 3500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-29' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 3500 WHERE nombre = 'Маслины без косточек' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-30','Лимон','Овощи','кг',3,2,1200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Лимон');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-30', i."restauranteId", i.id, 'INICIAL', 3, 3, 1200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-30' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1200 WHERE nombre = 'Лимон' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-31','Баранина','Мясо','кг',15,5,4200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Баранина');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-31', i."restauranteId", i.id, 'INICIAL', 15, 15, 4200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-31' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 4200 WHERE nombre = 'Баранина' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-32','Сливки 20%','Молочные','л',5,1.5,1800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сливки 20%');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-32', i."restauranteId", i.id, 'INICIAL', 5, 5, 1800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-32' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1800 WHERE nombre = 'Сливки 20%' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-33','Мука пшеничная','Бакалея','кг',60,20,350,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Мука пшеничная');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-33', i."restauranteId", i.id, 'INICIAL', 60, 60, 350, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-33' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 350 WHERE nombre = 'Мука пшеничная' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-34','Масло сливочное','Молочные','кг',8,2,4000,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Масло сливочное');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-34', i."restauranteId", i.id, 'INICIAL', 8, 8, 4000, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-34' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 4000 WHERE nombre = 'Масло сливочное' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-35','Гречневая крупа','Бакалея','кг',20,6,700,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Гречневая крупа');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-35', i."restauranteId", i.id, 'INICIAL', 20, 20, 700, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-35' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 700 WHERE nombre = 'Гречневая крупа' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-36','Фарш мясной','Мясо','кг',12,4,3200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Фарш мясной');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-36', i."restauranteId", i.id, 'INICIAL', 12, 12, 3200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-36' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 3200 WHERE nombre = 'Фарш мясной' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-37','Рис','Бакалея','кг',30,10,600,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Рис');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-37', i."restauranteId", i.id, 'INICIAL', 30, 30, 600, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-37' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 600 WHERE nombre = 'Рис' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-38','Куриное филе','Мясо','кг',25,8,2200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Куриное филе');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-38', i."restauranteId", i.id, 'INICIAL', 25, 25, 2200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-38' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 2200 WHERE nombre = 'Куриное филе' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-39','Сухари панировочные','Бакалея','кг',3,1,1500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сухари панировочные');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-39', i."restauranteId", i.id, 'INICIAL', 3, 3, 1500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-39' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1500 WHERE nombre = 'Сухари панировочные' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-40','Молоко','Молочные','л',20,6,500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Молоко');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-40', i."restauranteId", i.id, 'INICIAL', 20, 20, 500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-40' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 500 WHERE nombre = 'Молоко' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-41','Жир говяжий','Мясо','кг',3,1,900,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Жир говяжий');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-41', i."restauranteId", i.id, 'INICIAL', 3, 3, 900, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-41' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 900 WHERE nombre = 'Жир говяжий' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-42','Нут','Бакалея','кг',5,2,1200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Нут');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-42', i."restauranteId", i.id, 'INICIAL', 5, 5, 1200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-42' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1200 WHERE nombre = 'Нут' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-43','Горошек консервированный','Консервы','кг',6,2,900,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Горошек консервированный');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-43', i."restauranteId", i.id, 'INICIAL', 6, 6, 900, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-43' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 900 WHERE nombre = 'Горошек консервированный' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-44','Картофель фри замороженный','Заморозка','кг',15,5,1100,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Картофель фри замороженный');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-44', i."restauranteId", i.id, 'INICIAL', 15, 15, 1100, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-44' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1100 WHERE nombre = 'Картофель фри замороженный' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-45','Макаронные изделия','Бакалея','кг',12,4,600,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Макаронные изделия');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-45', i."restauranteId", i.id, 'INICIAL', 12, 12, 600, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-45' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 600 WHERE nombre = 'Макаронные изделия' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-46','Колбаса варёная','Мясо','кг',6,2,2800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Колбаса варёная');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-46', i."restauranteId", i.id, 'INICIAL', 6, 6, 2800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-46' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 2800 WHERE nombre = 'Колбаса варёная' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-47','Майонез','Соусы','кг',9,2,750,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Майонез');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-47', i."restauranteId", i.id, 'INICIAL', 9, 9, 750, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-47' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 750 WHERE nombre = 'Майонез' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-48','Салат романо','Овощи','кг',4,1,2500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Салат романо');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-48', i."restauranteId", i.id, 'INICIAL', 4, 4, 2500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-48' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 2500 WHERE nombre = 'Салат романо' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-49','Пармезан','Молочные','кг',2,0.5,7000,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Пармезан');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-49', i."restauranteId", i.id, 'INICIAL', 2, 2, 7000, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-49' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 7000 WHERE nombre = 'Пармезан' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-50','Хлеб пшеничный','Хлеб','кг',5,1,450,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Хлеб пшеничный');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-50', i."restauranteId", i.id, 'INICIAL', 5, 5, 450, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-50' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 450 WHERE nombre = 'Хлеб пшеничный' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-51','Соус Цезарь','Соусы','кг',2,0.5,2200,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Соус Цезарь');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-51', i."restauranteId", i.id, 'INICIAL', 2, 2, 2200, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-51' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 2200 WHERE nombre = 'Соус Цезарь' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-52','Сельдь солёная','Рыба','кг',5,2,2500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сельдь солёная');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-52', i."restauranteId", i.id, 'INICIAL', 5, 5, 2500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-52' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 2500 WHERE nombre = 'Сельдь солёная' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-53','Лепёшка','Хлеб','шт',60,15,50,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Лепёшка');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-53', i."restauranteId", i.id, 'INICIAL', 60, 60, 50, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-53' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 50 WHERE nombre = 'Лепёшка' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-54','Дрожжи сухие','Бакалея','г',500,100,4,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Дрожжи сухие');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-54', i."restauranteId", i.id, 'INICIAL', 500, 500, 4, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-54' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 4 WHERE nombre = 'Дрожжи сухие' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-55','Творог','Молочные','кг',8,3,1800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Творог');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-55', i."restauranteId", i.id, 'INICIAL', 8, 8, 1800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-55' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1800 WHERE nombre = 'Творог' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-56','Ванильный сахар','Бакалея','г',500,100,3,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Ванильный сахар');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-56', i."restauranteId", i.id, 'INICIAL', 500, 500, 3, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-56' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 3 WHERE nombre = 'Ванильный сахар' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-57','Крахмал кукурузный','Бакалея','кг',2,0.5,1500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Крахмал кукурузный');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-57', i."restauranteId", i.id, 'INICIAL', 2, 2, 1500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-57' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1500 WHERE nombre = 'Крахмал кукурузный' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-58','Мёд','Бакалея','кг',3,1,4500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Мёд');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-58', i."restauranteId", i.id, 'INICIAL', 3, 3, 4500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-58' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 4500 WHERE nombre = 'Мёд' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-59','Перец острый','Овощи','кг',1,0.3,2500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Перец острый');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-59', i."restauranteId", i.id, 'INICIAL', 1, 1, 2500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-59' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 2500 WHERE nombre = 'Перец острый' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-60','Уксус столовый 6%','Бакалея','л',3,1,400,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Уксус столовый 6%');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-60', i."restauranteId", i.id, 'INICIAL', 3, 3, 400, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-60' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 400 WHERE nombre = 'Уксус столовый 6%' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-61','Кориандр молотый','Специи','г',500,100,6,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Кориандр молотый');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-61', i."restauranteId", i.id, 'INICIAL', 500, 500, 6, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-61' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 6 WHERE nombre = 'Кориандр молотый' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-62','Кетчуп','Соусы','кг',20,2,700,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Кетчуп');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-62', i."restauranteId", i.id, 'INICIAL', 20, 20, 700, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-62' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 700 WHERE nombre = 'Кетчуп' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-63','Йогурт натуральный','Молочные','кг',10,3,900,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Йогурт натуральный');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-63', i."restauranteId", i.id, 'INICIAL', 10, 10, 900, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-63' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 900 WHERE nombre = 'Йогурт натуральный' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-64','Сухофрукты','Бакалея','кг',6,2,1800,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Сухофрукты');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-64', i."restauranteId", i.id, 'INICIAL', 6, 6, 1800, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-64' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 1800 WHERE nombre = 'Сухофрукты' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-65','Кофе зерновой','Бакалея','кг',3,1,9000,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Кофе зерновой');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-65', i."restauranteId", i.id, 'INICIAL', 3, 3, 9000, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-65' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 9000 WHERE nombre = 'Кофе зерновой' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-66','Мята свежая','Овощи','кг',0.5,0.2,4500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Мята свежая');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-66', i."restauranteId", i.id, 'INICIAL', 0.5, 0.5, 4500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-66' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 4500 WHERE nombre = 'Мята свежая' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-67','Клюква','Ягоды','кг',5,1.5,3500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Клюква');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-67', i."restauranteId", i.id, 'INICIAL', 5, 5, 3500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-67' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 3500 WHERE nombre = 'Клюква' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-68','Чай зелёный','Бакалея','кг',1.5,0.4,6500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Чай зелёный');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-68', i."restauranteId", i.id, 'INICIAL', 1.5, 1.5, 6500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-68' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 6500 WHERE nombre = 'Чай зелёный' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-69','Чай чёрный','Бакалея','кг',2,0.5,6000,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Чай чёрный');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-69', i."restauranteId", i.id, 'INICIAL', 2, 2, 6000, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-69' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 6000 WHERE nombre = 'Чай чёрный' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-70','Coca-Cola 0,5 л','Напитки','шт',48,12,350,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Coca-Cola 0,5 л');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-70', i."restauranteId", i.id, 'INICIAL', 48, 48, 350, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-70' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 350 WHERE nombre = 'Coca-Cola 0,5 л' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-71','Coca-Cola 1,5 л','Напитки','шт',24,6,650,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Coca-Cola 1,5 л');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-71', i."restauranteId", i.id, 'INICIAL', 24, 24, 650, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-71' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 650 WHERE nombre = 'Coca-Cola 1,5 л' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-72','Pepsi 0,5 л','Напитки','шт',48,12,350,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Pepsi 0,5 л');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-72', i."restauranteId", i.id, 'INICIAL', 48, 48, 350, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-72' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 350 WHERE nombre = 'Pepsi 0,5 л' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-73','Pepsi 1,5 л','Напитки','шт',24,6,650,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Pepsi 1,5 л');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-73', i."restauranteId", i.id, 'INICIAL', 24, 24, 650, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-73' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 650 WHERE nombre = 'Pepsi 1,5 л' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-74','Вода минеральная 0,5 л','Напитки','шт',48,12,150,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Вода минеральная 0,5 л');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-74', i."restauranteId", i.id, 'INICIAL', 48, 48, 150, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-74' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 150 WHERE nombre = 'Вода минеральная 0,5 л' AND "costoUnitario" IS NULL;
INSERT INTO "Insumo"(id,nombre,categoria,unidad,"stockActual","stockMinimo","costoUnitario","restauranteId","creadoEn","actualizadoEn") SELECT 'ins-td-75','Квас','Напитки','л',25,8,500,r.id,now(),now() FROM (SELECT id FROM "Restaurante" LIMIT 1) r WHERE NOT EXISTS (SELECT 1 FROM "Insumo" WHERE nombre = 'Квас');
INSERT INTO "MovimientoInventario"(id,"restauranteId","insumoId",tipo,cantidad,saldo,"costoUnitario",motivo) SELECT 'mov-ins-td-75', i."restauranteId", i.id, 'INICIAL', 25, 25, 500, 'Начальный остаток' FROM "Insumo" i WHERE i.id = 'ins-td-75' AND NOT EXISTS (SELECT 1 FROM "MovimientoInventario" m WHERE m."insumoId" = i.id);
UPDATE "Insumo" SET "costoUnitario" = 500 WHERE nombre = 'Квас' AND "costoUnitario" IS NULL;

-- 2. Старые тех-карты этих блюд удаляются (состав удалится каскадом)
DELETE FROM "Receta" WHERE "productoId" IN (SELECT id FROM "Producto" WHERE nombre IN ('Борщ со сметаной','Куриный бульон с лапшой','Лагман','Солянка мясная','Шурпа','Бефстроганов с гречкой','Бешбармак','Голубцы со сметаной','Котлета по-киевски с пюре','Манты (5 шт.)','Пельмени со сметаной','Плов по-узбекски','Шашлык из курицы (шампур)','Винегрет','Гречка отварная','Картофель фри','Картофельное пюре','Макароны по-флотски','Салат «Оливье»','Салат «Цезарь»','Селёдка под шубой','Хлеб / лепёшка','Баурсаки (порция)','Блины с творогом','Самса с говядиной','Сырники со сметаной','Торт «Наполеон» (кусок)','Чак-чак','Аджика','Кетчуп','Майонез','Сметана','Соус чесночный','Айран','Компот из сухофруктов','Кофе американо','Лимонад домашний','Морс клюквенный','Чай зелёный (чайник)','Чай чёрный (чайник)','Coca-Cola 0,5 л','Coca-Cola 1,5 л','Pepsi 0,5 л','Pepsi 1,5 л','Вода минеральная 0,5 л','Квас','Бизнес-ланч «Классический»','Бизнес-ланч «Лёгкий»','Сет «Дуэт»','Сет «Праздничный»','Сет «Семейный»'));

-- 3. Тех-карты
-- С01 Борщ со сметаной
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 370, 'Технологический паспорт С01 · Борщ со сметаной. Выход: 350 г супа + 20 г сметаны.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Говядину залить водой, довести до кипения, снять пену. Варить при слабом кипении до мягкости; мясо вынуть, нарезать, отвар процедить.
2. Свёклу нарезать соломкой и тушить с частью масла, томатной пастой, сахаром, лимонным соком и небольшим количеством отвара 15–20 минут. Лук и морковь отдельно пассеровать на оставшемся масле.
3. В отвар заложить картофель, затем капусту. Варить до почти полной готовности овощей; добавить пассеровку, свёклу, мясо, соль и специи.
4. Проварить 5–7 минут без бурного кипения. Удалить лавровый лист, довести горячей водой до заданного выхода и дать настояться под крышкой 10 минут.
5. Отвесить 350 г супа. Сметану 20 г и зелень добавить при отпуске; зелень входит в массу супа.

Контроль качества Цвет красно-бордовый; овощи мягкие, сохраняют нарезку; мясо мягкое. Вкус умеренно кисло-сладкий, без привкуса сырой свёклы.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Молоко и продукты его переработки.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода для варки ориентировочно 230 г.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Говядина' ORDER BY id LIMIT 1), 0.06, 0.06 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Свёкла' ORDER BY id LIMIT 1), 0.055, 0.055 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Капуста белокочанная' ORDER BY id LIMIT 1), 0.04, 0.04 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Картофель' ORDER BY id LIMIT 1), 0.05, 0.05 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Морковь' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Томатная паста' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.007609, 0.007609 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сок лимона' ORDER BY id LIMIT 1), 0.003, 0.003 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-10', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сахар' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-11', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-12', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-13', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лавровый лист' ORDER BY id LIMIT 1), 0.05, 0.05 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-14', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зелень (укроп, петрушка)' ORDER BY id LIMIT 1), 0.003, 0.003 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-15', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сметана' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Борщ со сметаной';
-- С02 Куриный бульон с лапшой
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 350, 'Технологический паспорт С02 · Куриный бульон с лапшой. Выход: 350 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Курицу залить водой, медленно довести до кипения и снять пену. Добавить лук и часть моркови; варить до полной готовности мяса.
2. Курицу вынуть, разделить на небольшие кусочки. Бульон процедить, варёный лук удалить. Остальную морковь нарезать и сварить в бульоне.
3. Лапшу отдельно отварить до готовности и откинуть на сито, чтобы не замутнять бульон. Яйцо сварить вкрутую, очистить и разрезать.
4. Соединить курицу, морковь, лапшу и бульон, прогреть; посолить. В тарелку положить половину небольшого яйца и зелень, долить бульон до общего выхода 350 г.

Контроль качества Бульон светлый, без хлопьев пены; лапша не разварена; курица мягкая; яйцо с полностью плотным белком и желтком.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Пшеница и глютен; яйцо. Уточнить состав покупной лапши.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода ориентировочно 290 г.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Куриный бульон с лапшой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Куриное бедро без кости' ORDER BY id LIMIT 1), 0.07, 0.07 FROM "Producto" p WHERE p.nombre = 'Куриный бульон с лапшой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лапша пшеничная сухая' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Куриный бульон с лапшой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Морковь' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Куриный бульон с лапшой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Куриный бульон с лапшой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.555556, 0.555556 FROM "Producto" p WHERE p.nombre = 'Куриный бульон с лапшой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зелень (укроп, петрушка)' ORDER BY id LIMIT 1), 0.003, 0.003 FROM "Producto" p WHERE p.nombre = 'Куриный бульон с лапшой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Куриный бульон с лапшой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Куриный бульон с лапшой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лавровый лист' ORDER BY id LIMIT 1), 0.05, 0.05 FROM "Producto" p WHERE p.nombre = 'Куриный бульон с лапшой';
-- С03 Лагман
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 400, 'Технологический паспорт С03 · Лагман. Выход: 400 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Мясо нарезать небольшими полосками, овощи — одинаковыми брусочками. Разогреть масло в сотейнике.
2. Обжарить мясо порциями до лёгкой корочки. Добавить лук и морковь, затем редьку, сладкий перец, томат и пасту; готовить с перемешиванием 5–7 минут.
3. Влить воду, добавить зиру и паприку. Тушить при слабом кипении до мягкости говядины; в конце добавить соль и чеснок.
4. Лапшу отдельно сварить согласно типу продукта. Отвесить около 140 г готовой лапши, сверху распределить мясо-овощную подливу с бульоном и зеленью до выхода 400 г.

Контроль качества Лапша упругая, мясо мягкое; овощи сохраняют форму; подлива ароматная, с заметной жидкой частью.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Пшеница и глютен; яйцо возможно в лапше.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода ориентировочно 170 г.

Принято в проекте Предложен суповой лагман с покупной сухой лапшой. При переходе на свежую тянутую лапшу её закладку и водопоглощение определить отдельно.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Говядина' ORDER BY id LIMIT 1), 0.08, 0.08 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лапша для лагмана' ORDER BY id LIMIT 1), 0.06, 0.06 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Морковь' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец сладкий' ORDER BY id LIMIT 1), 0.035, 0.035 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Помидоры' ORDER BY id LIMIT 1), 0.04, 0.04 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Редька' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Томатная паста' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Чеснок' ORDER BY id LIMIT 1), 0.003, 0.003 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-10', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.013043, 0.013043 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-11', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0025, 0.0025 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-12', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зира' ORDER BY id LIMIT 1), 0.3, 0.3 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-13', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Паприка' ORDER BY id LIMIT 1), 0.5, 0.5 FROM "Producto" p WHERE p.nombre = 'Лагман';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-14', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зелень (укроп, петрушка)' ORDER BY id LIMIT 1), 0.004, 0.004 FROM "Producto" p WHERE p.nombre = 'Лагман';
-- С04 Солянка мясная
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 350, 'Технологический паспорт С04 · Солянка мясная. Выход: 350 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Говядину сварить до мягкости, отвар процедить. Мясо, ветчину и колбасу нарезать соломкой.
2. Лук пассеровать на масле, добавить томатную пасту и прогреть 2–3 минуты. Огурцы нарезать и отдельно припустить в небольшом количестве отвара до мягкости.
3. В бульон заложить мясные продукты, лук с томатом и огурцы. Варить 10–15 минут, добавить перец и лавровый лист; соль вводить после пробы, учитывая солёность продуктов.
4. Удалить лавровый лист, добавить маслины и прогреть. В тарелку положить лимон и зелень, налить суп до выхода 350 г.

Контроль качества Насыщенный красно-коричневый бульон; вкус мясной, солоновато-кислый; мясные продукты нарезаны равномерно.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Проверить колбасу и ветчину: возможны молоко, соя, горчица, глютен.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода ориентировочно 260 г.

Принято в проекте Сметана в исходном описании не указана и в карту не включена. Для халяльного меню отдельно проверить вид мяса и документы на колбасные изделия.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Говядина' ORDER BY id LIMIT 1), 0.05, 0.05 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Ветчина' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Колбаса варёно-копчёная' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Огурцы солёные' ORDER BY id LIMIT 1), 0.035, 0.035 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Томатная паста' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.007609, 0.007609 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Маслины без косточек' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лимон' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-10', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зелень (укроп, петрушка)' ORDER BY id LIMIT 1), 0.003, 0.003 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-11', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.001, 0.001 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-12', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-13', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лавровый лист' ORDER BY id LIMIT 1), 0.05, 0.05 FROM "Producto" p WHERE p.nombre = 'Солянка мясная';
-- С05 Шурпа
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 400, 'Технологический паспорт С05 · Шурпа. Выход: 400 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Баранину нарезать крупными кусочками, залить водой и довести до кипения. Снять пену и варить при слабом кипении до почти полной мягкости.
2. Лук нарезать полукольцами, морковь и картофель — крупными кусками. Добавить лук и морковь, затем картофель; варить до готовности.
3. За 10 минут до окончания добавить сладкий перец, томат и зиру. В конце добавить чеснок, соль и перец.
4. Отвесить мясо и овощи, добавить бульон и зелень до выхода 400 г. Учитывать выпаривание воды при варке партии.

Контроль качества Светлый мясной бульон, крупные мягкие овощи, сочное мясо. Нет чрезмерной мутности и резкого вкуса специй.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены В базовой рецептуре основные декларируемые аллергены не добавляются; проверить сырьё и перекрёстный контакт.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода ориентировочно 300 г.

Принято в проекте В исходном списке есть только название. Предложена шурпа из баранины; цена, себестоимость и окончательный выход требуют заполнения. Говядина — отдельный вариант карты, не автоматическая замена.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Шурпа';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Баранина' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Шурпа';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Картофель' ORDER BY id LIMIT 1), 0.08, 0.08 FROM "Producto" p WHERE p.nombre = 'Шурпа';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Морковь' ORDER BY id LIMIT 1), 0.035, 0.035 FROM "Producto" p WHERE p.nombre = 'Шурпа';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Шурпа';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец сладкий' ORDER BY id LIMIT 1), 0.03, 0.03 FROM "Producto" p WHERE p.nombre = 'Шурпа';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Помидоры' ORDER BY id LIMIT 1), 0.04, 0.04 FROM "Producto" p WHERE p.nombre = 'Шурпа';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Чеснок' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Шурпа';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зелень (укроп, петрушка)' ORDER BY id LIMIT 1), 0.005, 0.005 FROM "Producto" p WHERE p.nombre = 'Шурпа';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0025, 0.0025 FROM "Producto" p WHERE p.nombre = 'Шурпа';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-10', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зира' ORDER BY id LIMIT 1), 0.2, 0.2 FROM "Producto" p WHERE p.nombre = 'Шурпа';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-11', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Шурпа';
-- Г01 Бефстроганов с гречкой
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 330, 'Технологический паспорт Г01 · Бефстроганов с гречкой. Выход: 180 г мяса с соусом + 150 г гречки.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Гречку перебрать, промыть, залить водой, посолить и варить под крышкой на слабом огне до впитывания жидкости. Вмешать 5 г сливочного масла; получить 150 г гарнира.
2. Говядину зачистить от плёнок, нарезать поперёк волокон тонкими полосками. Быстро обжарить на растительном масле небольшими партиями.
3. Лук пассеровать на оставшемся сливочном масле, добавить муку, прогреть без потемнения. Ввести воду, сливки и сметану, размешать до однородности.
4. Добавить мясо, соль и перец, довести до готовности на небольшом нагреве. Не кипятить соус бурно; выход мяса с соусом довести до 180 г.
5. На тарелку выложить 150 г гречки и 180 г бефстроганова.

Контроль качества Мясо мягкое, нарезано соломкой; соус кремовый, без комков муки; гречка рассыпчатая.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Молоко; пшеница и глютен.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода для гречки ориентировочно 110 г; Вода для соуса 25 г.

Принято в проекте Использовать подходящий для быстрой жарки отруб. Жёсткий отруб требует другой технологии и контрольной проработки.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Бефстроганов с гречкой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Говядина' ORDER BY id LIMIT 1), 0.13, 0.13 FROM "Producto" p WHERE p.nombre = 'Бефстроганов с гречкой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Бефстроганов с гречкой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сметана' ORDER BY id LIMIT 1), 0.035, 0.035 FROM "Producto" p WHERE p.nombre = 'Бефстроганов с гречкой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сливки 20%' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Бефстроганов с гречкой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мука пшеничная' ORDER BY id LIMIT 1), 0.004, 0.004 FROM "Producto" p WHERE p.nombre = 'Бефстроганов с гречкой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.008696, 0.008696 FROM "Producto" p WHERE p.nombre = 'Бефстроганов с гречкой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Масло сливочное' ORDER BY id LIMIT 1), 0.008, 0.008 FROM "Producto" p WHERE p.nombre = 'Бефстроганов с гречкой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Гречневая крупа' ORDER BY id LIMIT 1), 0.05, 0.05 FROM "Producto" p WHERE p.nombre = 'Бефстроганов с гречкой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Бефстроганов с гречкой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-10', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.2, 0.2 FROM "Producto" p WHERE p.nombre = 'Бефстроганов с гречкой';
-- Г02 Бешбармак
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 550, 'Технологический паспорт Г02 · Бешбармак. Выход: 400 г блюда + 150 мл бульона отдельно.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Говядину залить водой, снять пену после закипания и варить на слабом огне до мягкости. Часть бульона процедить и оставить для подачи.
2. Из муки, яйца, воды и части соли замесить плотное тесто. Накрыть, выдержать 25–30 минут, тонко раскатать и нарезать крупными ромбами.
3. Лук нарезать полукольцами, припустить в небольшой части бульона с перцем до мягкости, сохранив форму.
4. Тесто отварить порциями в кипящем бульоне до готовности, аккуратно вынуть. Мясо нарезать поперёк волокон.
5. Собрать порцию: около 190 г варёного теста, 130 г готового мяса и 80 г лука с подливой. Отдельно подать 150 мл процеженного бульона.

Контроль качества Тесто мягкое, не слипшееся; мясо легко разжёвывается; лук сочный; бульон без костных осколков.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Пшеница и глютен; яйцо.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода для теста 30 г; Вода для варки ориентировочно 650 г.

Принято в проекте Выбран вариант из говядины. Для конины создать отдельную калькуляцию и проверить длительность варки и выход; исходная себестоимость не подтверждает ни один из вариантов.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Бешбармак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Говядина' ORDER BY id LIMIT 1), 0.18, 0.18 FROM "Producto" p WHERE p.nombre = 'Бешбармак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мука пшеничная' ORDER BY id LIMIT 1), 0.08, 0.08 FROM "Producto" p WHERE p.nombre = 'Бешбармак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.333333, 0.333333 FROM "Producto" p WHERE p.nombre = 'Бешбармак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.06, 0.06 FROM "Producto" p WHERE p.nombre = 'Бешбармак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.003, 0.003 FROM "Producto" p WHERE p.nombre = 'Бешбармак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.2, 0.2 FROM "Producto" p WHERE p.nombre = 'Бешбармак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лавровый лист' ORDER BY id LIMIT 1), 0.05, 0.05 FROM "Producto" p WHERE p.nombre = 'Бешбармак';
-- Г03 Голубцы со сметаной
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 320, 'Технологический паспорт Г03 · Голубцы со сметаной. Выход: 300 г голубцов с соусом + 20 г сметаны.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Рис промыть и отварить до полуготовности. Капустные листья бланшировать до гибкости, грубые жилки срезать.
2. Половину лука мелко нарезать и смешать с фаршем, рисом, частью соли и перцем. Разделить начинку на две части.
3. Завернуть начинку в два капустных листа, подогнув края. Оставшиеся лук и морковь пассеровать на масле, добавить томатную пасту и воду.
4. Уложить голубцы швом вниз, залить соусом, тушить под крышкой при слабом кипении ориентировочно 40–50 минут до полной готовности начинки.
5. Отпускать два голубца с соусом общей массой 300 г и 20 г сметаны отдельно или сверху.

Контроль качества Листья мягкие, оболочка целая; начинка сочная и полностью приготовленная; рис без твёрдого ядра.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Молоко.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода для риса и соуса ориентировочно 100 г.

Принято в проекте Гарнир не включён. Число голубцов и их массу закрепить после формовки пробной партии.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Голубцы со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Капуста белокочанная' ORDER BY id LIMIT 1), 0.12, 0.12 FROM "Producto" p WHERE p.nombre = 'Голубцы со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Фарш мясной' ORDER BY id LIMIT 1), 0.09, 0.09 FROM "Producto" p WHERE p.nombre = 'Голубцы со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Рис' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Голубцы со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Голубцы со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Морковь' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Голубцы со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Томатная паста' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Голубцы со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.007609, 0.007609 FROM "Producto" p WHERE p.nombre = 'Голубцы со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Голубцы со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.2, 0.2 FROM "Producto" p WHERE p.nombre = 'Голубцы со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-10', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сметана' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Голубцы со сметаной';
-- Г04 Котлета по-киевски с пюре
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 300, 'Технологический паспорт Г04 · Котлета по-киевски с пюре. Выход: 150 г котлеты + 150 г пюре.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Сливочное масло для начинки смешать с зеленью, сформовать короткий брусок и охладить до плотного состояния.
2. Филе развернуть и осторожно отбить между плёнками, не разрывая. Посолить, положить масло, плотно завернуть края.
3. Обвалять заготовку в муке, яйце и сухарях. Повторить яйцо и сухари на слабых местах; охладить перед жаркой.
4. Обжарить во фритюре около 170–175 °C до золотистой корочки, затем довести в духовке около 180 °C. Проверить готовность курицы в толще, а не только цвет панировки.
5. Картофель сварить до мягкости, слить воду, подсушить и размять. Ввести горячее молоко и масло. Отпустить котлету целиком с 150 г пюре.

Контроль качества Панировка золотистая и целая; курица полностью приготовлена; при разрезании выделяется растопленное масло; пюре без комков.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Молоко; яйцо; пшеница и глютен.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте 10 г масла — оценка поглощения, не объём заполнения фритюрницы. Реальный расход масла и выход котлеты подтвердить проработкой.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Куриное филе' ORDER BY id LIMIT 1), 0.125, 0.125 FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Масло сливочное' ORDER BY id LIMIT 1), 0.021, 0.021 FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зелень (укроп, петрушка)' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мука пшеничная' ORDER BY id LIMIT 1), 0.008, 0.008 FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.333333, 0.333333 FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сухари панировочные' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.01087, 0.01087 FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Картофель' ORDER BY id LIMIT 1), 0.135, 0.135 FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Молоко' ORDER BY id LIMIT 1), 0.024272, 0.024272 FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-10', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-11', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Котлета по-киевски с пюре';
-- Г05 Манты (5 шт.)
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 300, 'Технологический паспорт Г05 · Манты 5 штук. Выход: 5 штук общей массой 300 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Муку смешать с частью соли и водой, замесить плотное тесто. Накрыть и выдержать 25–30 минут.
2. Говядину и жир мелко нарубить; лук нарезать мелким кубиком. Смешать с водой, оставшейся солью, перцем и зирой.
3. Тесто разделить на пять частей и раскатать. Распределить начинку поровну, защипнуть края, не оставляя отверстий.
4. Решётки пароварки смазать маслом. Разложить манты с промежутками и готовить при устойчивом парообразовании ориентировочно 40–45 минут, проверяя готовность начинки.
5. Аккуратно снять изделия, отпустить пять штук. Соус в состав этой карты не входит.

Контроль качества Тесто проваренное, без разрывов; начинка сочная, мясо полностью приготовлено; изделия не слипшиеся.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Пшеница и глютен.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода для теста 33 г; Вода для начинки 12 г.

Принято в проекте Время дано для свежесформованных изделий. Замороженные заготовки требуют отдельного проверенного режима.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Манты (5 шт.)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мука пшеничная' ORDER BY id LIMIT 1), 0.075, 0.075 FROM "Producto" p WHERE p.nombre = 'Манты (5 шт.)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Говядина' ORDER BY id LIMIT 1), 0.11, 0.11 FROM "Producto" p WHERE p.nombre = 'Манты (5 шт.)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.065, 0.065 FROM "Producto" p WHERE p.nombre = 'Манты (5 шт.)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Жир говяжий' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Манты (5 шт.)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.002174, 0.002174 FROM "Producto" p WHERE p.nombre = 'Манты (5 шт.)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0025, 0.0025 FROM "Producto" p WHERE p.nombre = 'Манты (5 шт.)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.2, 0.2 FROM "Producto" p WHERE p.nombre = 'Манты (5 шт.)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зира' ORDER BY id LIMIT 1), 0.2, 0.2 FROM "Producto" p WHERE p.nombre = 'Манты (5 шт.)';
-- Г06 Пельмени со сметаной
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 275, 'Технологический паспорт Г06 · Пельмени со сметаной. Выход: 12 штук около 250 г + 25 г сметаны.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Из муки, яйца, воды и части соли замесить плотное тесто. Накрыть и выдержать 25–30 минут.
2. Мясо и лук измельчить, добавить холодную воду, соль и перец. Вымешать до равномерного распределения влаги.
3. Тесто тонко раскатать, вырезать 12 кружков. Начинку разделить поровну, защипнуть края и соединить концы.
4. Пельмени опустить в достаточное количество кипящей воды, осторожно перемешать. После всплытия продолжать варку до полной готовности фарша; проверить изделие из партии.
5. Вынуть шумовкой, дать воде стечь и смешать с маслом. Отпустить 12 штук со сметаной отдельно.

Контроль качества Оболочка целая и проваренная; начинка сочная, без сырого фарша; лишняя вода отсутствует.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Пшеница и глютен; яйцо; молоко.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода для теста 22 г; Вода для фарша 12 г.

Принято в проекте Вода для варки — технологическая среда и не входит в закладку теста. Целевой выход проверить по фактическому размеру изделия.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Пельмени со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мука пшеничная' ORDER BY id LIMIT 1), 0.06, 0.06 FROM "Producto" p WHERE p.nombre = 'Пельмени со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.222222, 0.222222 FROM "Producto" p WHERE p.nombre = 'Пельмени со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Говядина' ORDER BY id LIMIT 1), 0.085, 0.085 FROM "Producto" p WHERE p.nombre = 'Пельмени со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.022, 0.022 FROM "Producto" p WHERE p.nombre = 'Пельмени со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Пельмени со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Пельмени со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Масло сливочное' ORDER BY id LIMIT 1), 0.005, 0.005 FROM "Producto" p WHERE p.nombre = 'Пельмени со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сметана' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Пельмени со сметаной';
-- Г07 Плов по-узбекски
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 350, 'Технологический паспорт Г07 · Плов по-узбекски. Выход: 350 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Нут заранее замочить в холодильнике, промыть и отдельно отварить до почти полной готовности. Рис промыть; режим замачивания подобрать под сорт.
2. В казане разогреть масло. Обжарить нарезанную говядину, добавить лук, затем морковь соломкой.
3. Влить часть воды, добавить зиру, соль, нут и чеснок. Томить зирвак до мягкости мяса.
4. Рис уложить ровным слоем, добавить горячую воду с учётом сорта риса и жидкости в казане. Готовить до впитывания, затем собрать горкой и довести под крышкой на минимальном нагреве.
5. После выдержки аккуратно перемешать. Отпустить 350 г с равномерным распределением мяса и нута.

Контроль качества Рис рассыпчатый, без сырого центра и избытка воды; мясо и нут мягкие; морковь сохраняет часть формы.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены В базовой рецептуре основные декларируемые аллергены не добавляются; проверить сырьё.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода для плова ориентировочно 160 г.

Принято в проекте Вода для замачивания и отдельной варки нута в таблицу не включена. При масштабировании воду корректировать по посуде и испарению.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Плов по-узбекски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Рис' ORDER BY id LIMIT 1), 0.085, 0.085 FROM "Producto" p WHERE p.nombre = 'Плов по-узбекски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Говядина' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Плов по-узбекски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Морковь' ORDER BY id LIMIT 1), 0.08, 0.08 FROM "Producto" p WHERE p.nombre = 'Плов по-узбекски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Плов по-узбекски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Нут' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Плов по-узбекски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.021739, 0.021739 FROM "Producto" p WHERE p.nombre = 'Плов по-узбекски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Чеснок' ORDER BY id LIMIT 1), 0.005, 0.005 FROM "Producto" p WHERE p.nombre = 'Плов по-узбекски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0025, 0.0025 FROM "Producto" p WHERE p.nombre = 'Плов по-узбекски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зира' ORDER BY id LIMIT 1), 0.3, 0.3 FROM "Producto" p WHERE p.nombre = 'Плов по-узбекски';
-- Г08 Шашлык из курицы (шампур)
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 210, 'Технологический паспорт Г08 · Шашлык из курицы на шампуре. Выход: 180 г курицы + 30 г лука.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Куриное бедро нарезать одинаковыми кусочками. Лук для маринада размять с солью, смешать с маслом, лимонным соком, паприкой и перцем.
2. Перемешать мясо с маринадом и выдержать в закрытой маркированной ёмкости в холодильнике ориентировочно 2–4 часа.
3. Удалить крупные кусочки лука с мяса, нанизать на шампур. Жарить над равномерным жаром без открытого пламени, регулярно переворачивая.
4. Проверить полную готовность наиболее толстых кусочков. Маринад, контактировавший с сырой курицей, не использовать как готовый соус.
5. Свежий лук для подачи смешать с зеленью и лимонным соком. Подать с готовым шашлыком; хлеб и соус учитываются отдельно.

Контроль качества Поверхность подрумяненная, без обугливания; мякоть сочная и полностью приготовленная; лук свежий и хрустящий.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены В базовой рецептуре основные декларируемые аллергены не добавляются; проверить смесь специй.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Лук для маринада учитывается как расход с последующим удалением. Готовый выход мяса проверить после жарки.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Шашлык из курицы (шампур)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Куриное бедро без кости' ORDER BY id LIMIT 1), 0.23, 0.23 FROM "Producto" p WHERE p.nombre = 'Шашлык из курицы (шампур)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.06, 0.06 FROM "Producto" p WHERE p.nombre = 'Шашлык из курицы (шампур)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.008696, 0.008696 FROM "Producto" p WHERE p.nombre = 'Шашлык из курицы (шампур)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сок лимона' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Шашлык из курицы (шампур)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Паприка' ORDER BY id LIMIT 1), 1, 1 FROM "Producto" p WHERE p.nombre = 'Шашлык из курицы (шампур)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0025, 0.0025 FROM "Producto" p WHERE p.nombre = 'Шашлык из курицы (шампур)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.2, 0.2 FROM "Producto" p WHERE p.nombre = 'Шашлык из курицы (шампур)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зелень (укроп, петрушка)' ORDER BY id LIMIT 1), 0.003, 0.003 FROM "Producto" p WHERE p.nombre = 'Шашлык из курицы (шампур)';
-- Р01 Винегрет
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 180, 'Технологический паспорт Р01 · Винегрет. Выход: 180 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Свёклу, картофель и морковь сварить отдельно до мягкости, охладить по принятому на кухне режиму, очистить. Взвесить уже готовые овощи согласно таблице.
2. Овощи и огурцы нарезать одинаковыми небольшими кубиками. Горошек откинуть на сито, лук мелко нарезать.
3. Свёклу отдельно смешать с частью масла, затем соединить с остальными ингредиентами.
4. Добавить оставшееся масло и соль, осторожно перемешать. Отпускать по 180 г, украсив зеленью из закладки.

Контроль качества Кубики сохраняют форму; салат без свободного рассола, с мягкими овощами и приятной кислинкой.

Отпуск Хранить компоненты охлаждёнными раздельно. Смешивать небольшими партиями; отпускать охлаждённым.

Аллергены Проверить консервированный горошек и огурцы по маркировке.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Массы овощей указаны после варки и очистки; сырую закупочную массу определить по собственным потерям.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Винегрет';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Свёкла' ORDER BY id LIMIT 1), 0.055, 0.055 FROM "Producto" p WHERE p.nombre = 'Винегрет';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Картофель' ORDER BY id LIMIT 1), 0.04, 0.04 FROM "Producto" p WHERE p.nombre = 'Винегрет';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Морковь' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Винегрет';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Огурцы солёные' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Винегрет';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Горошек консервированный' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Винегрет';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.008, 0.008 FROM "Producto" p WHERE p.nombre = 'Винегрет';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.01087, 0.01087 FROM "Producto" p WHERE p.nombre = 'Винегрет';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.001, 0.001 FROM "Producto" p WHERE p.nombre = 'Винегрет';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зелень (укроп, петрушка)' ORDER BY id LIMIT 1), 0.001, 0.001 FROM "Producto" p WHERE p.nombre = 'Винегрет';
-- Р02 Гречка отварная
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 150, 'Технологический паспорт Р02 · Гречка отварная. Выход: 150 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Крупу перебрать, промыть и дать воде стечь.
2. Залить горячей водой, добавить соль, довести до кипения. Убавить нагрев, закрыть крышкой.
3. Варить примерно 15–20 минут до впитывания воды. Не перемешивать часто, чтобы не ломать зёрна.
4. Дать постоять под крышкой 5–10 минут, добавить сливочное масло и осторожно разрыхлить. Отвесить 150 г.

Контроль качества Крупа мягкая, рассыпчатая, без избытка воды и пригоревших зёрен.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Молоко.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода ориентировочно 110 г.

Принято в проекте Водопоглощение зависит от крупы и посуды. Закрепить фактический выход пробной варкой.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Гречка отварная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Гречневая крупа' ORDER BY id LIMIT 1), 0.05, 0.05 FROM "Producto" p WHERE p.nombre = 'Гречка отварная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Масло сливочное' ORDER BY id LIMIT 1), 0.005, 0.005 FROM "Producto" p WHERE p.nombre = 'Гречка отварная';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.001, 0.001 FROM "Producto" p WHERE p.nombre = 'Гречка отварная';
-- Р03 Картофель фри
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 150, 'Технологический паспорт Р03 · Картофель фри. Выход: 150 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Проверить состав и инструкцию производителя полуфабриката. Фритюрницу заполнить рабочим количеством масла по инструкции оборудования.
2. Замороженный картофель жарить небольшими партиями без размораживания. Ориентировочный режим 170–180 °C; длительность уточнить по продукту.
3. Вынуть корзину, дать маслу стечь, переложить картофель в чистую сухую ёмкость.
4. Посолить непосредственно перед отпуском, отвесить 150 г. Не закрывать горячий картофель герметично до подачи: корочка размокает.

Контроль качества Золотистая хрустящая корочка и мягкая середина, без прогорклого запаха и тёмных горелых участков.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Проверить покрытие полуфабриката: возможна пшеница. Общий фритюр может давать перекрёстный контакт.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Принят покупной полуфабрикат. 12 г масла — оценка списания на порцию, не заправка фритюрницы; расход установить по журналу масла.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Картофель фри';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Картофель фри замороженный' ORDER BY id LIMIT 1), 0.18, 0.18 FROM "Producto" p WHERE p.nombre = 'Картофель фри';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.013043, 0.013043 FROM "Producto" p WHERE p.nombre = 'Картофель фри';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0015, 0.0015 FROM "Producto" p WHERE p.nombre = 'Картофель фри';
-- Р04 Картофельное пюре
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 200, 'Технологический паспорт Р04 · Картофельное пюре. Выход: 200 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Картофель нарезать одинаковыми кусками, залить водой для варки и сварить до полной мягкости.
2. Воду слить, картофель кратко подсушить на слабом нагреве. Протереть или размять горячим.
3. Молоко отдельно нагреть. Постепенно ввести его в картофель, добавить масло и соль.
4. Перемешать до однородности и отвесить 200 г. Не использовать высокоскоростной блендер: он делает пюре клейким.

Контроль качества Масса однородная и пышная, без комков; вкус картофеля, молока и масла, без водянистости.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Молоко.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Вода для варки не включена в пищевую закладку. Выход зависит от сорта картофеля.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Картофельное пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Картофель' ORDER BY id LIMIT 1), 0.18, 0.18 FROM "Producto" p WHERE p.nombre = 'Картофельное пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Молоко' ORDER BY id LIMIT 1), 0.033981, 0.033981 FROM "Producto" p WHERE p.nombre = 'Картофельное пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Масло сливочное' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Картофельное пюре';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0015, 0.0015 FROM "Producto" p WHERE p.nombre = 'Картофельное пюре';
-- Р05 Макароны по-флотски
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 250, 'Технологический паспорт Р05 · Макароны по-флотски. Выход: 250 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Лук мелко нарезать и пассеровать на масле до мягкости.
2. Добавить фарш, разбить лопаткой комочки, обжарить. Влить немного воды и довести до полной готовности, посолить и поперчить.
3. Макароны отдельно отварить в достаточном количестве воды до готовности. Откинуть на дуршлаг.
4. Смешать макароны с приготовленным фаршем и луком, прогреть. Отпустить 250 г с равномерным распределением мяса.

Контроль качества Макароны сохраняют форму, не слипшиеся; фарш рассыпчатый, полностью приготовленный; блюдо сочное, без свободной воды.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Пшеница и глютен; яйцо возможно в макаронах.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода для тушения фарша 20 г.

Принято в проекте Категория сохранена из меню, хотя блюдо содержит мясо и может продаваться как самостоятельное горячее.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Макароны по-флотски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Макаронные изделия' ORDER BY id LIMIT 1), 0.07, 0.07 FROM "Producto" p WHERE p.nombre = 'Макароны по-флотски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Фарш мясной' ORDER BY id LIMIT 1), 0.08, 0.08 FROM "Producto" p WHERE p.nombre = 'Макароны по-флотски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Макароны по-флотски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.008696, 0.008696 FROM "Producto" p WHERE p.nombre = 'Макароны по-флотски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Макароны по-флотски';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.2, 0.2 FROM "Producto" p WHERE p.nombre = 'Макароны по-флотски';
-- Р06 Салат «Оливье»
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 200, 'Технологический паспорт Р06 · Салат Оливье. Выход: 200 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Картофель, морковь и яйца приготовить отдельно, охладить и очистить. Взвешивать после обработки.
2. Все плотные ингредиенты нарезать одинаковыми мелкими кубиками. Огурцы и горошек хорошо отцедить.
3. Смешать подготовленные ингредиенты, добавить готовый майонез непосредственно перед отпуском партии.
4. Осторожно перемешать, проверить соль и отвесить 200 г. Не добавлять свежую партию к остаткам ранее заправленного салата.

Контроль качества Ровная нарезка, равномерная заправка; салат не водянистый, овощи не размяты.

Отпуск Отпускать охлаждённым. Состав майонеза и колбасы фиксировать по конкретному поставщику.

Аллергены Яйцо; горчица возможна в майонезе; молоко, соя и глютен возможны в колбасе.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Салат «Оливье»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Картофель' ORDER BY id LIMIT 1), 0.05, 0.05 FROM "Producto" p WHERE p.nombre = 'Салат «Оливье»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Морковь' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Салат «Оливье»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Колбаса варёная' ORDER BY id LIMIT 1), 0.04, 0.04 FROM "Producto" p WHERE p.nombre = 'Салат «Оливье»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.555556, 0.555556 FROM "Producto" p WHERE p.nombre = 'Салат «Оливье»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Огурцы солёные' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Салат «Оливье»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Горошек консервированный' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Салат «Оливье»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Майонез' ORDER BY id LIMIT 1), 0.024, 0.024 FROM "Producto" p WHERE p.nombre = 'Салат «Оливье»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.001, 0.001 FROM "Producto" p WHERE p.nombre = 'Салат «Оливье»';
-- Р07 Салат «Цезарь»
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 230, 'Технологический паспорт Р07 · Салат Цезарь. Выход: 230 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Листья романо промыть, обсушить и порвать крупными кусками. Сыр натереть или снять тонкими лепестками.
2. Хлеб нарезать кубиками, перемешать с частью масла и чесноком. Подсушить в духовке около 160–170 °C до хруста.
3. Куриное филе посолить, поперчить, обжарить на оставшемся масле и довести до полной готовности. Нарезать ломтиками; целевой готовый выход около 80 г.
4. Романо аккуратно смешать с соусом. Выложить курицу, сухарики и пармезан; собрать порцию массой 230 г.

Контроль качества Листья сухие и хрустящие, курица сочная и готовая, сухарики не размокшие; соус не стекает на дно.

Отпуск Собирать непосредственно перед подачей. Не хранить собранный салат с сухариками для последующей продажи.

Аллергены Молоко; пшеница и глютен; яйцо, рыба и горчица возможны в соусе.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Для воспроизводимости выбран покупной соус Цезарь. Домашний соус потребует отдельной карты; томаты в исходном описании отсутствуют.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Салат «Цезарь»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Куриное филе' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Салат «Цезарь»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Салат романо' ORDER BY id LIMIT 1), 0.065, 0.065 FROM "Producto" p WHERE p.nombre = 'Салат «Цезарь»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Пармезан' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Салат «Цезарь»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Хлеб пшеничный' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Салат «Цезарь»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соус Цезарь' ORDER BY id LIMIT 1), 0.03, 0.03 FROM "Producto" p WHERE p.nombre = 'Салат «Цезарь»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.005435, 0.005435 FROM "Producto" p WHERE p.nombre = 'Салат «Цезарь»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Чеснок' ORDER BY id LIMIT 1), 0.001, 0.001 FROM "Producto" p WHERE p.nombre = 'Салат «Цезарь»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.001, 0.001 FROM "Producto" p WHERE p.nombre = 'Салат «Цезарь»';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Салат «Цезарь»';
-- Р08 Селёдка под шубой
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 200, 'Технологический паспорт Р08 · Селёдка под шубой. Выход: 200 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Овощи и яйца приготовить раздельно, охладить и очистить. Взвесить готовые продукты.
2. Филе сельди проверить на остаточные кости, нарезать небольшими кусочками. Лук мелко нарезать.
3. Картофель, морковь, свёклу и яйцо натереть раздельно. При избыточной влаге свёклу аккуратно отцедить.
4. Выложить слоями картофель, сельдь, лук, морковь, яйцо и свёклу, распределяя майонез между слоями. Общая масса порции — 200 г.
5. Накрыть и выдержать в холодильнике для пропитывания в пределах утверждённого срока; перед отпуском проверить форму и отсутствие жидкости.

Контроль качества Слои различимы, порция держит форму, нет костей и свободной жидкости; вкус умеренно солёный.

Отпуск Отпускать охлаждённым. Использовать отдельный инвентарь для рыбы.

Аллергены Рыба; яйцо; горчица возможна в майонезе.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Селёдка под шубой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сельдь солёная' ORDER BY id LIMIT 1), 0.04, 0.04 FROM "Producto" p WHERE p.nombre = 'Селёдка под шубой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Свёкла' ORDER BY id LIMIT 1), 0.05, 0.05 FROM "Producto" p WHERE p.nombre = 'Селёдка под шубой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Картофель' ORDER BY id LIMIT 1), 0.035, 0.035 FROM "Producto" p WHERE p.nombre = 'Селёдка под шубой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Морковь' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Селёдка под шубой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.333333, 0.333333 FROM "Producto" p WHERE p.nombre = 'Селёдка под шубой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Селёдка под шубой';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Майонез' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Селёдка под шубой';
-- Р09 Хлеб / лепёшка
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 50, 'Технологический паспорт Р09 · Хлеб или лепёшка. Выход: 50 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. При приёмке проверить упаковку, маркировку, свежесть и отсутствие плесени. Выбрать один конкретный продукт для учёта.
2. Чистым хлебным ножом нарезать порцию 50 г; лепёшку порционировать по массе.
3. Если требуется тёплая подача, прогреть порцию непосредственно перед отпуском без пересушивания.
4. Подать на отдельной тарелке или в хлебной корзине. Несъедобные остатки и возвраты с гостевого стола повторно не отпускать.

Контроль качества Мякиш мягкий, запах свойственный хлебу; нет плесени, посторонних включений и признаков черствения.

Отпуск Подавать свежим или слегка прогретым. Режим хранения брать с маркировки изготовителя.

Аллергены Пшеница и глютен; молоко, яйцо, кунжут возможны по маркировке.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Карта отпуска покупного изделия. Хлеб и лепёшка — разные складские позиции; выбрать фактически используемую либо завести два варианта.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Хлеб / лепёшка';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лепёшка' ORDER BY id LIMIT 1), 1, 1 FROM "Producto" p WHERE p.nombre = 'Хлеб / лепёшка';
-- Д01 Баурсаки (порция)
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 100, 'Технологический паспорт Д01 · Баурсаки порция. Выход: 100 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Молоко и воду слегка подогреть. Дрожжи использовать согласно инструкции производителя; соединить с мукой, сахаром, солью, яйцом и жидкостью.
2. Замесить мягкое тесто, в конце ввести растопленное не горячее сливочное масло. Накрыть и оставить для подъёма примерно на 60–90 минут, ориентируясь на увеличение объёма.
3. Обмять тесто, раскатать пластом около 1–1,5 см и нарезать небольшими кусочками. Дать короткую расстойку 10–15 минут.
4. Жарить небольшими партиями во фритюре около 170–175 °C, переворачивая до равномерного золотистого цвета и готового мякиша.
5. Дать маслу стечь. Отпустить 100 г; число штук закрепить после выбора размера нарезки.

Контроль качества Румяная поверхность, пористый полностью пропечённый мякиш, без сырого теста и избытка масла.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Пшеница и глютен; молоко; яйцо.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода 10 г.

Принято в проекте Масло фритюра указано как расчётное поглощение. Мед, варенье и сметана не включены.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Баурсаки (порция)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мука пшеничная' ORDER BY id LIMIT 1), 0.06, 0.06 FROM "Producto" p WHERE p.nombre = 'Баурсаки (порция)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Молоко' ORDER BY id LIMIT 1), 0.019417, 0.019417 FROM "Producto" p WHERE p.nombre = 'Баурсаки (порция)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.177778, 0.177778 FROM "Producto" p WHERE p.nombre = 'Баурсаки (порция)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сахар' ORDER BY id LIMIT 1), 0.005, 0.005 FROM "Producto" p WHERE p.nombre = 'Баурсаки (порция)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Масло сливочное' ORDER BY id LIMIT 1), 0.004, 0.004 FROM "Producto" p WHERE p.nombre = 'Баурсаки (порция)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Дрожжи сухие' ORDER BY id LIMIT 1), 0.7, 0.7 FROM "Producto" p WHERE p.nombre = 'Баурсаки (порция)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0006, 0.0006 FROM "Producto" p WHERE p.nombre = 'Баурсаки (порция)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.008696, 0.008696 FROM "Producto" p WHERE p.nombre = 'Баурсаки (порция)';
-- Д02 Блины с творогом
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 250, 'Технологический паспорт Д02 · Блины с творогом. Выход: 3 блина с начинкой около 230 г + 20 г сметаны.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Яйцо смешать с сахаром и солью, ввести часть молока и муку. Размешать без комков, добавить остальное молоко и растительное масло. Дать тесту постоять 15–20 минут.
2. Испечь три тонких блина на разогретой сковороде, равномерно распределяя тесто.
3. Творог протереть, смешать с сахаром и ванильным сахаром. Сырое яйцо в эту начинку не добавлять.
4. Начинку разделить на три части, завернуть в блины конвертом. Прогреть со сливочным маслом на сковороде или в духовке до горячей середины.
5. Подать три блина и 20 г сметаны. Проверить фактическую массу изделий после выпечки и прогрева.

Контроль качества Блины тонкие и эластичные, с лёгким румянцем; начинка однородная, не течёт; изделия прогреты внутри.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Пшеница и глютен; молоко; яйцо.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Блины с творогом';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мука пшеничная' ORDER BY id LIMIT 1), 0.04, 0.04 FROM "Producto" p WHERE p.nombre = 'Блины с творогом';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Молоко' ORDER BY id LIMIT 1), 0.082524, 0.082524 FROM "Producto" p WHERE p.nombre = 'Блины с творогом';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.444444, 0.444444 FROM "Producto" p WHERE p.nombre = 'Блины с творогом';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сахар' ORDER BY id LIMIT 1), 0.017, 0.017 FROM "Producto" p WHERE p.nombre = 'Блины с творогом';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.005435, 0.005435 FROM "Producto" p WHERE p.nombre = 'Блины с творогом';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0004, 0.0004 FROM "Producto" p WHERE p.nombre = 'Блины с творогом';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Творог' ORDER BY id LIMIT 1), 0.09, 0.09 FROM "Producto" p WHERE p.nombre = 'Блины с творогом';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Ванильный сахар' ORDER BY id LIMIT 1), 1, 1 FROM "Producto" p WHERE p.nombre = 'Блины с творогом';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Масло сливочное' ORDER BY id LIMIT 1), 0.005, 0.005 FROM "Producto" p WHERE p.nombre = 'Блины с творогом';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-10', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сметана' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Блины с творогом';
-- Д03 Самса с говядиной
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 160, 'Технологический паспорт Д03 · Самса с говядиной. Выход: 1 штука около 160 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Из муки, воды и части соли замесить плотное тесто, дать отлежаться 25–30 минут. Тонко раскатать, смазать маслом, свернуть рулетом и охладить до уплотнения масла.
2. Мясо, жир и лук мелко нарубить, смешать с оставшейся солью, зирой и перцем.
3. Отрезать заготовку теста, раскатать с сохранением слоёв, выложить начинку и плотно защипнуть треугольником.
4. Для пробной партии использовать духовку около 200–210 °C ориентировочно 25–35 минут, смазав верх яйцом. Проверить полную готовность мясной начинки.
5. При работе в тандыре отдельно установить режим посадки, время и выход на конкретном оборудовании. Отпустить одну самсу.

Контроль качества Слоистая румяная корочка, швы закрыты, начинка сочная и полностью приготовленная.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Пшеница и глютен; молоко; яйцо.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода для теста 24 г.

Принято в проекте Меню заявляет самсу из тандыра. Указанный режим духовки служит только для проработки; до продажи с формулировкой «из тандыра» утвердить реальную тандырную технологию.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Самса с говядиной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мука пшеничная' ORDER BY id LIMIT 1), 0.055, 0.055 FROM "Producto" p WHERE p.nombre = 'Самса с говядиной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Масло сливочное' ORDER BY id LIMIT 1), 0.012, 0.012 FROM "Producto" p WHERE p.nombre = 'Самса с говядиной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Говядина' ORDER BY id LIMIT 1), 0.055, 0.055 FROM "Producto" p WHERE p.nombre = 'Самса с говядиной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лук репчатый' ORDER BY id LIMIT 1), 0.035, 0.035 FROM "Producto" p WHERE p.nombre = 'Самса с говядиной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Жир говяжий' ORDER BY id LIMIT 1), 0.008, 0.008 FROM "Producto" p WHERE p.nombre = 'Самса с говядиной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.088889, 0.088889 FROM "Producto" p WHERE p.nombre = 'Самса с говядиной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0015, 0.0015 FROM "Producto" p WHERE p.nombre = 'Самса с говядиной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зира' ORDER BY id LIMIT 1), 0.2, 0.2 FROM "Producto" p WHERE p.nombre = 'Самса с говядиной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец чёрный молотый' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Самса с говядиной';
-- Д04 Сырники со сметаной
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 205, 'Технологический паспорт Д04 · Сырники со сметаной. Выход: 3 сырника около 180 г + 25 г сметаны.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Творог протереть; при избыточной сыворотке предварительно отцедить и только затем взвесить 150 г.
2. Смешать с яйцом, сахаром, ванильным сахаром, солью и мукой для массы. Не вымешивать чрезмерно долго.
3. Разделить массу на три части, сформовать шайбы и обвалять в отмеренной муке.
4. Обжарить с двух сторон на умеренном нагреве до румяной корочки. При необходимости довести в духовке около 170 °C до полностью прогретого центра.
5. Отпустить три сырника со сметаной. Проверить выход, учитывая влажность конкретного творога.

Контроль качества Сырники держат форму, внутри нежные, без сырой мучной массы; корочка золотистая, без горечи.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Молоко; яйцо; пшеница и глютен.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Сырники со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Творог' ORDER BY id LIMIT 1), 0.15, 0.15 FROM "Producto" p WHERE p.nombre = 'Сырники со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.333333, 0.333333 FROM "Producto" p WHERE p.nombre = 'Сырники со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мука пшеничная' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Сырники со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сахар' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Сырники со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Ванильный сахар' ORDER BY id LIMIT 1), 1, 1 FROM "Producto" p WHERE p.nombre = 'Сырники со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0003, 0.0003 FROM "Producto" p WHERE p.nombre = 'Сырники со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.006522, 0.006522 FROM "Producto" p WHERE p.nombre = 'Сырники со сметаной';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сметана' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Сырники со сметаной';
-- Д05 Торт «Наполеон» (кусок)
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 120, 'Технологический паспорт Д05 · Торт Наполеон кусок. Выход: 120 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Муку порубить с холодным маслом в крошку. Ввести холодную воду, лимонный сок и соль, быстро собрать тесто, не согревая его длительным вымешиванием. Охладить до удобной раскатки.
2. Тесто разделить на несколько частей, раскатать тонкие коржи, наколоть вилкой. Выпекать при 200–210 °C до сухого золотистого состояния; обрезки сохранить для крошки.
3. Для крема смешать яйцо, сахар и крахмал. Постепенно ввести горячее молоко; вернуть на нагрев и при постоянном перемешивании заварить до равномерного загустения и полной тепловой обработки. Добавить масло и ванильный сахар.
4. Коржи и крем охладить по принятому режиму. Собрать торт, промазывая слои, покрыть крошкой и выдержать в холодильнике для пропитывания.
5. Нарезать взвешенными кусками по 120 г. Рецептуру удобнее готовить партией на 10 порций, затем учитывать обрезки и фактический выход.

Контроль качества Выраженные тонкие слои, однородный крем без комков; кусок держит форму, отсутствуют посторонний запах и подсохший крем.

Отпуск Отпускать охлаждённым. Кремовые изделия хранить в холодильнике с маркировкой времени изготовления и утверждённого срока.

Аллергены Пшеница и глютен; молоко; яйцо.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода холодная 10 г.

Принято в проекте Предложено собственное производство. Если торт закупается, заменить эту карту картой отпуска по спецификации поставщика.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Торт «Наполеон» (кусок)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мука пшеничная' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Торт «Наполеон» (кусок)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Масло сливочное' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Торт «Наполеон» (кусок)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сок лимона' ORDER BY id LIMIT 1), 0.0005, 0.0005 FROM "Producto" p WHERE p.nombre = 'Торт «Наполеон» (кусок)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0001, 0.0001 FROM "Producto" p WHERE p.nombre = 'Торт «Наполеон» (кусок)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Молоко' ORDER BY id LIMIT 1), 0.048544, 0.048544 FROM "Producto" p WHERE p.nombre = 'Торт «Наполеон» (кусок)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.222222, 0.222222 FROM "Producto" p WHERE p.nombre = 'Торт «Наполеон» (кусок)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сахар' ORDER BY id LIMIT 1), 0.014, 0.014 FROM "Producto" p WHERE p.nombre = 'Торт «Наполеон» (кусок)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Крахмал кукурузный' ORDER BY id LIMIT 1), 0.004, 0.004 FROM "Producto" p WHERE p.nombre = 'Торт «Наполеон» (кусок)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Ванильный сахар' ORDER BY id LIMIT 1), 0.5, 0.5 FROM "Producto" p WHERE p.nombre = 'Торт «Наполеон» (кусок)';
-- Д06 Чак-чак
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 100, 'Технологический паспорт Д06 · Чак-чак. Выход: 100 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Из муки, яйца и соли замесить плотное тесто. Накрыть и выдержать 20–30 минут.
2. Тонко раскатать и нарезать короткой соломкой. Удалить избыток подпыла, если он использовался и учтён в расходе муки.
3. Жарить небольшими партиями при 165–175 °C до светло-золотистого цвета и готовности внутри. Откинуть на сито.
4. Мёд, сахар и воду нагреть до растворения сахара и получения связующего сиропа. Не перегревать до горелого вкуса.
5. Смешать жареное тесто с горячим сиропом, осторожно сформовать и остудить. Порционировать по 100 г.

Контроль качества Кусочки теста лёгкие, покрыты медовым сиропом; масса держит форму, без горелого привкуса и избытка масла.

Отпуск Подавать после остывания на десертной тарелке. Хранить закрытым по утверждённым условиям для готового изделия.

Аллергены Пшеница и глютен; яйцо; возможна индивидуальная реакция на мёд.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода для сиропа 4 г.

Принято в проекте Орехи в базовый состав не включены. Если добавляются, внести их в рецептуру и сведения об аллергенах.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Чак-чак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мука пшеничная' ORDER BY id LIMIT 1), 0.04, 0.04 FROM "Producto" p WHERE p.nombre = 'Чак-чак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Яйцо куриное' ORDER BY id LIMIT 1), 0.444444, 0.444444 FROM "Producto" p WHERE p.nombre = 'Чак-чак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0002, 0.0002 FROM "Producto" p WHERE p.nombre = 'Чак-чак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.008696, 0.008696 FROM "Producto" p WHERE p.nombre = 'Чак-чак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мёд' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Чак-чак';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сахар' ORDER BY id LIMIT 1), 0.012, 0.012 FROM "Producto" p WHERE p.nombre = 'Чак-чак';
-- А01 Аджика
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 30, 'Технологический паспорт А01 · Аджика. Выход: 30 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Томаты и перцы вымыть, удалить несъедобные части. Взвесить подготовленные продукты и измельчить.
2. Томат и перцы соединить с маслом, солью, сахаром и кориандром. Варить на слабом нагреве 15–20 минут, помешивая.
3. Добавить измельчённый чеснок и уксус, кратко проварить. Уварить до выхода 30 г на порцию, затем быстро охладить по принятому режиму.
4. Переложить в чистую маркированную ёмкость. Отпускать по 30 г отдельным чистым инвентарём.

Контроль качества Однородная или мелкозернистая красная масса; вкус острый, чесночный, умеренно кислый.

Отпуск Отпускать охлаждённой в соуснике; хранить охлаждённой в пределах утверждённого срока.

Аллергены Проверить состав специй; основные декларируемые аллергены в базовую рецептуру не добавлены.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Это предложенная варёная томатная аджика. Уксус не делает продукт пригодным для хранения при комнатной температуре; карта не является технологией консервирования.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Аджика';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Помидоры' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Аджика';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец сладкий' ORDER BY id LIMIT 1), 0.008, 0.008 FROM "Producto" p WHERE p.nombre = 'Аджика';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Перец острый' ORDER BY id LIMIT 1), 0.001, 0.001 FROM "Producto" p WHERE p.nombre = 'Аджика';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Чеснок' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Аджика';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Растительное масло' ORDER BY id LIMIT 1), 0.001087, 0.001087 FROM "Producto" p WHERE p.nombre = 'Аджика';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Уксус столовый 6%' ORDER BY id LIMIT 1), 0.001, 0.001 FROM "Producto" p WHERE p.nombre = 'Аджика';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-07', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0005, 0.0005 FROM "Producto" p WHERE p.nombre = 'Аджика';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-08', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сахар' ORDER BY id LIMIT 1), 0.0005, 0.0005 FROM "Producto" p WHERE p.nombre = 'Аджика';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-09', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Кориандр молотый' ORDER BY id LIMIT 1), 0.1, 0.1 FROM "Producto" p WHERE p.nombre = 'Аджика';
-- А02 Кетчуп
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 30, 'Технологический паспорт А02 · Кетчуп. Выход: 30 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Выбрать конкретного производителя и зафиксировать состав с упаковки: томатное сырьё, вода, сахар, соль, кислоты, специи и другие фактические компоненты.
2. Проверить целостность, срок годности и условия хранения. При вскрытии нанести дату и время.
3. Чистым дозатором или ложкой отвесить 30 г в соусник. Не возвращать остатки из соусника в общую упаковку.

Контроль качества Цвет и густота соответствуют продукту; нет расслоения сверх допустимого производителем, брожения и постороннего запаха.

Отпуск Условия и срок после вскрытия — строго по маркировке изготовителя.

Аллергены По маркировке конкретного кетчупа; возможны сельдерей или горчица.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Карта отпуска покупного соуса. Точный промышленный состав не восстановим по названию.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Кетчуп';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Кетчуп' ORDER BY id LIMIT 1), 0.03, 0.03 FROM "Producto" p WHERE p.nombre = 'Кетчуп';
-- А03 Майонез
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 30, 'Технологический паспорт А03 · Майонез. Выход: 30 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Использовать готовый майонез от утверждённого поставщика. Зафиксировать жирность и состав: обычно масло, вода, яичные компоненты, кислота, соль и другие ингредиенты по этикетке.
2. После вскрытия маркировать тару и соблюдать условия производителя.
3. Отвесить 30 г чистым инвентарём непосредственно перед отпуском; не смешивать партии разных дат.

Контроль качества Однородная эмульсия без постороннего запаха; консистенция соответствует маркировке.

Отпуск Отпускать в чистом соуснике; после вскрытия соблюдать режим на упаковке.

Аллергены Обычно яйцо; горчица и другие аллергены — по этикетке.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Домашний майонез из сырого яйца не является заменой этой карты. Норма 30 г предложена, поскольку в меню выход не указан.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Майонез';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Майонез' ORDER BY id LIMIT 1), 0.03, 0.03 FROM "Producto" p WHERE p.nombre = 'Майонез';
-- А04 Сметана
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 30, 'Технологический паспорт А04 · Сметана. Выход: 30 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Проверить маркировку, срок годности и температуру приёмки. Для единой калькуляции закрепить производителя и жирность.
2. Вскрытую упаковку маркировать. При необходимости осторожно перемешать чистой ложкой до однородности.
3. Отвесить 30 г в соусник, подавать отдельно. Порции сметаны внутри других блюд учитываются в их картах и второй раз не списываются.

Контроль качества Однородная белая или кремовая масса, чистый кисломолочный запах; нет плесени и несвойственного расслоения.

Отпуск Отпускать охлаждённой; хранение и срок после вскрытия — по маркировке производителя.

Аллергены Молоко.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Возможна другая жирность после согласования и обновления калькуляции.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Сметана';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сметана' ORDER BY id LIMIT 1), 0.03, 0.03 FROM "Producto" p WHERE p.nombre = 'Сметана';
-- А05 Соус чесночный
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 40, 'Технологический паспорт А05 · Соус чесночный. Выход: 40 г.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Зелень вымыть, обсушить и мелко нарезать. Чеснок очистить и измельчить непосредственно перед смешиванием.
2. Сметану и готовый майонез соединить в чистой ёмкости. Добавить чеснок, укроп, лимонный сок и соль.
3. Перемешать до равномерного распределения зелени. Держать в закрытой маркированной ёмкости в холодильнике.
4. Отвесить 40 г в соусник. Для обслуживания брать отдельную чистую ложку.

Контроль качества Однородный густой соус с мелкой зеленью, выраженный чесночный вкус без горечи и отделившейся жидкости.

Отпуск Отпускать охлаждённым; готовить небольшими партиями в пределах утверждённого срока реализации.

Аллергены Молоко; яйцо; горчица возможна в майонезе.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Соус чесночный';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сметана' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Соус чесночный';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Майонез' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Соус чесночный';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Чеснок' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Соус чесночный';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Зелень (укроп, петрушка)' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Соус чесночный';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-05', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сок лимона' ORDER BY id LIMIT 1), 0.0005, 0.0005 FROM "Producto" p WHERE p.nombre = 'Соус чесночный';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-06', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.0005, 0.0005 FROM "Producto" p WHERE p.nombre = 'Соус чесночный';
-- Н01 Айран
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 300, 'Технологический паспорт Н01 · Айран. Выход: 300 мл.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Использовать пастеризованный промышленный кисломолочный продукт без сахара и добавок. Проверить срок и условия хранения.
2. Смешать йогурт с частью охлаждённой питьевой воды и солью, взбить венчиком до однородности.
3. Добавить воду до фактического объёма 300 мл; вода в таблице является ориентиром, а не гарантией суммы объёмов.
4. Налить в стакан непосредственно перед отпуском. Самостоятельное сквашивание молока этой картой не предусмотрено.

Контроль качества Однородный белый напиток, приятный кисломолочный вкус, умеренная солёность.

Отпуск Подавать охлаждённым. Готовить небольшими партиями, хранить в закрытой маркированной ёмкости в холодильнике.

Аллергены Молоко.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода питьевая охлаждённая ориентировочно 100 г.

Принято в проекте Предложен айран из готового йогурта. Для покупного айрана использовать карту отпуска 300 мл по спецификации поставщика.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Айран';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Йогурт натуральный' ORDER BY id LIMIT 1), 0.2, 0.2 FROM "Producto" p WHERE p.nombre = 'Айран';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Соль' ORDER BY id LIMIT 1), 0.001, 0.001 FROM "Producto" p WHERE p.nombre = 'Айран';
-- Н02 Компот из сухофруктов
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 250, 'Технологический паспорт Н02 · Компот из сухофруктов. Выход: 250 мл без фруктов.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Сухофрукты перебрать, удалить посторонние примеси и тщательно промыть. При разном составе смеси разделить плотные яблоки и груши и более мягкие плоды.
2. В кипящую воду сначала положить плотные плоды, затем остальные. Варить при слабом кипении ориентировочно 15–25 минут до мягкости.
3. Добавить сахар, размешать, кратко прокипятить. Дать настояться под крышкой, не оставляя длительно при комнатной температуре.
4. Процедить, довести питьевой водой до планового объёма готовой партии с последующим прогревом. Для холодного отпуска быстро охладить по принятому режиму.
5. Отмерить 250 мл напитка. Варёные фрукты в гостевую порцию этой карты не входят.

Контроль качества Прозрачный или слегка опалесцирующий настой, характерный фруктовый аромат, без брожения и посторонних включений.

Отпуск Отпускать охлаждённым или тёплым по заказу; способ подачи закрепить для меню.

Аллергены В сухофруктах возможны сульфиты; проверить маркировку.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода питьевая ориентировочно 290 г.

Принято в проекте Расход воды зависит от поглощения плодами и выпаривания. Если фрукты подаются в стакане, нужна отдельная норма выхода.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Компот из сухофруктов';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сухофрукты' ORDER BY id LIMIT 1), 0.025, 0.025 FROM "Producto" p WHERE p.nombre = 'Компот из сухофруктов';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сахар' ORDER BY id LIMIT 1), 0.015, 0.015 FROM "Producto" p WHERE p.nombre = 'Компот из сухофруктов';
-- Н03 Кофе американо
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 200, 'Технологический паспорт Н03 · Кофе американо. Выход: 200 мл.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Проверить чистоту кофемашины и фильтрацию воды. Смолоть 18 г кофе под используемую корзину.
2. Равномерно распределить и утрамбовать кофе. Приготовить двойной эспрессо; стартовый ориентир — 36–40 г напитка за 25–30 секунд, затем настроить по зерну.
3. В чашку добавить горячую воду и эспрессо в принятом порядке. Довести объём готового напитка до 200 мл.
4. Подать сразу. Гуща является отходом, а промывочная вода кофемашины не входит в пищевой выход.

Контроль качества Чистый кофейный аромат, без горелого вкуса; нет частиц гущи; объём стабилен.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены В базовом составе основные декларируемые аллергены не добавлены.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода питьевая для эспрессо и разбавления ориентировочно 210 г.

Принято в проекте Выбран двойной эспрессо. Сахар, молоко и сливки не включены и должны учитываться отдельно.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Кофе американо';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Кофе зерновой' ORDER BY id LIMIT 1), 0.018, 0.018 FROM "Producto" p WHERE p.nombre = 'Кофе американо';
-- Н04 Лимонад домашний
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 350, 'Технологический паспорт Н04 · Лимонад домашний. Выход: 300 мл напитка + 50 г льда.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Из части питьевой негазированной воды и сахара приготовить сироп, охладить. Эту воду учитывать в общем количестве воды на напиток.
2. Лимон вымыть, сок отжать и процедить. Мяту вымыть и обсушить, слегка размять без перетирания в кашу.
3. В мерной ёмкости смешать сок, сироп и мяту. Добавить охлаждённую воду до 300 мл жидкой части.
4. В большой стакан положить 50 г пищевого льда и дольку лимона, влить лимонад. Подавать сразу, пока сохраняется газирование.

Контроль качества Освежающий кисло-сладкий вкус, выраженный аромат лимона и мяты; лёд чистый, без постороннего запаха.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены В базовой рецептуре основные декларируемые аллергены не добавлены.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода питьевая газированная ориентировочно 250 г; Лёд из питьевой воды 50 г.

Принято в проекте В меню указан только большой стакан. Предложена жидкая часть 300 мл; посуду подобрать с запасом для льда и украшения.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Лимонад домашний';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сок лимона' ORDER BY id LIMIT 1), 0.03, 0.03 FROM "Producto" p WHERE p.nombre = 'Лимонад домашний';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сахар' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Лимонад домашний';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Мята свежая' ORDER BY id LIMIT 1), 0.002, 0.002 FROM "Producto" p WHERE p.nombre = 'Лимонад домашний';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лимон' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Лимонад домашний';
-- Н05 Морс клюквенный
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 300, 'Технологический паспорт Н05 · Морс клюквенный. Выход: 300 мл.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Клюкву перебрать и промыть. Замороженные ягоды обработать согласно маркировке, не считая замораживание обеззараживанием.
2. Размять ягоды, соединить с водой и довести до кипения. Проварить 5–7 минут, добавить сахар и растворить.
3. Процедить через чистое сито, слегка отжимая ягоды. Довести до планового объёма партии и вновь прогреть; сырой сок после тепловой обработки не добавлять.
4. Для холодной подачи быстро охладить по принятому режиму. Отмерить 300 мл.

Контроль качества Красный напиток с характерной кислинкой клюквы, без косточек, крупных частиц и признаков брожения.

Отпуск Подавать охлаждённым; хранить в закрытой маркированной ёмкости в холодильнике.

Аллергены В базовой рецептуре основные декларируемые аллергены не добавлены.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода питьевая ориентировочно 285 г.

Принято в проекте Предложен выход 300 мл вместо неопределённого «большого стакана». Вода учитывает потери с ягодным жмыхом.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Морс клюквенный';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Клюква' ORDER BY id LIMIT 1), 0.04, 0.04 FROM "Producto" p WHERE p.nombre = 'Морс клюквенный';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Сахар' ORDER BY id LIMIT 1), 0.02, 0.02 FROM "Producto" p WHERE p.nombre = 'Морс клюквенный';
-- Н06 Чай зелёный (чайник)
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 500, 'Технологический паспорт Н06 · Чай зелёный чайник. Выход: 500 мл настоя.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Прогреть чистый чайник горячей водой и слить её; промывочная вода не входит в закладку.
2. Внести 5 г чая. Залить питьевой водой ориентировочно 75–85 °C, если производитель не установил другой режим.
3. Настаивать примерно 2–3 минуты, затем удалить заварку или процедить. Уточнить время по сорту, чтобы исключить выраженную горечь.
4. Обеспечить 500 мл готового настоя, подать в чайнике. Не доливать свежую заварку к старой.

Контроль качества Настой характерного для сорта цвета и аромата, без грубой горечи и посторонних примесей.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Проверить состав ароматизированных чаёв.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода питьевая ориентировочно 520 г.

Принято в проекте Сахар, мёд и лимон не включены. Вода в таблице учитывает небольшие потери в чайном листе.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Чай зелёный (чайник)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Чай зелёный' ORDER BY id LIMIT 1), 0.005, 0.005 FROM "Producto" p WHERE p.nombre = 'Чай зелёный (чайник)';
-- Н07 Чай чёрный (чайник)
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 510, 'Технологический паспорт Н07 · Чай чёрный чайник. Выход: 500 мл настоя + 10 г лимона.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Прогреть чистый чайник, промывочную воду слить. Лимон вымыть и нарезать, удалить косточки.
2. Внести чай и залить водой ориентировочно 95–100 °C с учётом инструкции производителя.
3. Настаивать 3–5 минут, затем удалить заварку или процедить. Получить 500 мл настоя.
4. Подать чайник с лимоном на отдельном блюдце или добавить лимон при отпуске по принятому стандарту.

Контроль качества Чистый аромат и прозрачный настой характерной крепости; лимон свежий, без косточек.

Отпуск Подавать сразу после приготовления в чистой посуде. Массу порции проверять на весах.

Аллергены Проверить состав ароматизированного чая.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Вода и лёд (со склада не списываются, ориентировочно): Вода питьевая ориентировочно 520 г.

Принято в проекте Сахар и молоко не включены. В меню лимон заявлен, поэтому его расход включён.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Чай чёрный (чайник)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Чай чёрный' ORDER BY id LIMIT 1), 0.005, 0.005 FROM "Producto" p WHERE p.nombre = 'Чай чёрный (чайник)';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Лимон' ORDER BY id LIMIT 1), 0.01, 0.01 FROM "Producto" p WHERE p.nombre = 'Чай чёрный (чайник)';
-- Н08 Coca-Cola 0,5 л
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 500, 'Технологический паспорт Н08 · Coca-Cola 0,5 л. Выход: 500 мл.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. При приёмке проверить наименование, объём, дату изготовления, срок годности, условия хранения и целостность упаковки.
2. Охладить продукт согласно маркировке. Не использовать упаковку с нарушенной герметичностью или признаками порчи.
3. Отпустить одну заводскую бутылку указанного объёма. Открыть при подаче по принятому стандарту; стаканы предоставить отдельно.
4. Лёд, лимон и другие добавки в эту карту не включены. При добавлении учитывать их отдельными строками.

Контроль качества Внешний вид, вкус и запах соответствуют конкретному продукту; нет несвойственного осадка или признаков порчи.

Отпуск Отпускать охлаждённым, если это допускает маркировка. Срок после вскрытия и хранение — по упаковке.

Аллергены По маркировке.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Газированный безалкогольный напиток; точный состав и сахаросодержание — по этикетке выбранного продукта. Производственный рецепт бренда не подменяется приблизительной домашней рецептурой.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Coca-Cola 0,5 л';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Coca-Cola 0,5 л' ORDER BY id LIMIT 1), 1, 1 FROM "Producto" p WHERE p.nombre = 'Coca-Cola 0,5 л';
-- Н09 Coca-Cola 1,5 л
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 1500, 'Технологический паспорт Н09 · Coca-Cola 1,5 л. Выход: 1500 мл.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. При приёмке проверить наименование, объём, дату изготовления, срок годности, условия хранения и целостность упаковки.
2. Охладить продукт согласно маркировке. Не использовать упаковку с нарушенной герметичностью или признаками порчи.
3. Отпустить одну заводскую бутылку указанного объёма. Открыть при подаче по принятому стандарту; стаканы предоставить отдельно.
4. Лёд, лимон и другие добавки в эту карту не включены. При добавлении учитывать их отдельными строками.

Контроль качества Внешний вид, вкус и запах соответствуют конкретному продукту; нет несвойственного осадка или признаков порчи.

Отпуск Отпускать охлаждённым, если это допускает маркировка. Срок после вскрытия и хранение — по упаковке.

Аллергены По маркировке.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Газированный безалкогольный напиток; вариант Original, Zero или другой должен быть отдельной складской позицией. Производственный рецепт бренда не подменяется приблизительной домашней рецептурой.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Coca-Cola 1,5 л';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Coca-Cola 1,5 л' ORDER BY id LIMIT 1), 1, 1 FROM "Producto" p WHERE p.nombre = 'Coca-Cola 1,5 л';
-- Н10 Pepsi 0,5 л
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 500, 'Технологический паспорт Н10 · Pepsi 0,5 л. Выход: 500 мл.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. При приёмке проверить наименование, объём, дату изготовления, срок годности, условия хранения и целостность упаковки.
2. Охладить продукт согласно маркировке. Не использовать упаковку с нарушенной герметичностью или признаками порчи.
3. Отпустить одну заводскую бутылку указанного объёма. Открыть при подаче по принятому стандарту; стаканы предоставить отдельно.
4. Лёд, лимон и другие добавки в эту карту не включены. При добавлении учитывать их отдельными строками.

Контроль качества Внешний вид, вкус и запах соответствуют конкретному продукту; нет несвойственного осадка или признаков порчи.

Отпуск Отпускать охлаждённым, если это допускает маркировка. Срок после вскрытия и хранение — по упаковке.

Аллергены По маркировке.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Газированный безалкогольный напиток; точный состав и сахаросодержание — по этикетке выбранного продукта. Производственный рецепт бренда не подменяется приблизительной домашней рецептурой.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Pepsi 0,5 л';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Pepsi 0,5 л' ORDER BY id LIMIT 1), 1, 1 FROM "Producto" p WHERE p.nombre = 'Pepsi 0,5 л';
-- Н11 Pepsi 1,5 л
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 1500, 'Технологический паспорт Н11 · Pepsi 1,5 л. Выход: 1500 мл.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. При приёмке проверить наименование, объём, дату изготовления, срок годности, условия хранения и целостность упаковки.
2. Охладить продукт согласно маркировке. Не использовать упаковку с нарушенной герметичностью или признаками порчи.
3. Отпустить одну заводскую бутылку указанного объёма. Открыть при подаче по принятому стандарту; стаканы предоставить отдельно.
4. Лёд, лимон и другие добавки в эту карту не включены. При добавлении учитывать их отдельными строками.

Контроль качества Внешний вид, вкус и запах соответствуют конкретному продукту; нет несвойственного осадка или признаков порчи.

Отпуск Отпускать охлаждённым, если это допускает маркировка. Срок после вскрытия и хранение — по упаковке.

Аллергены По маркировке.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Газированный безалкогольный напиток; вариант продукта и производитель фиксируются в карточке сырья. Производственный рецепт бренда не подменяется приблизительной домашней рецептурой.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Pepsi 1,5 л';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Pepsi 1,5 л' ORDER BY id LIMIT 1), 1, 1 FROM "Producto" p WHERE p.nombre = 'Pepsi 1,5 л';
-- Н12 Вода минеральная 0,5 л
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 500, 'Технологический паспорт Н12 · Вода минеральная 0,5 л. Выход: 500 мл.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. При приёмке проверить наименование, объём, дату изготовления, срок годности, условия хранения и целостность упаковки.
2. Охладить продукт согласно маркировке. Не использовать упаковку с нарушенной герметичностью или признаками порчи.
3. Отпустить одну заводскую бутылку указанного объёма. Открыть при подаче по принятому стандарту; стаканы предоставить отдельно.
4. Лёд, лимон и другие добавки в эту карту не включены. При добавлении учитывать их отдельными строками.

Контроль качества Внешний вид, вкус и запах соответствуют конкретному продукту; нет несвойственного осадка или признаков порчи.

Отпуск Отпускать охлаждённым, если это допускает маркировка. Срок после вскрытия и хранение — по упаковке.

Аллергены По маркировке.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Бутилированная минеральная вода. Минеральный состав и наличие газа — по маркировке изготовителя. Производственный рецепт бренда не подменяется приблизительной домашней рецептурой.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Вода минеральная 0,5 л';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Вода минеральная 0,5 л' ORDER BY id LIMIT 1), 1, 1 FROM "Producto" p WHERE p.nombre = 'Вода минеральная 0,5 л';
-- Н13 Квас
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 300, 'Технологический паспорт Н13 · Квас. Выход: 300 мл.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. При приёмке проверить наименование, объём, дату изготовления, срок годности, условия хранения и целостность упаковки.
2. Охладить продукт согласно маркировке. Не использовать упаковку с нарушенной герметичностью или признаками порчи.
3. Вскрытую тару маркировать. Отмерить 300 мл в чистый стакан, сохранив газирование; остаток хранить по инструкции производителя.
4. Лёд, лимон и другие добавки в эту карту не включены. При добавлении учитывать их отдельными строками.

Контроль качества Внешний вид, вкус и запах соответствуют конкретному продукту; нет несвойственного осадка или признаков порчи.

Отпуск Отпускать охлаждённым, если это допускает маркировка. Срок после вскрытия и хранение — по упаковке.

Аллергены Часто рожь, ячмень, пшеница и глютен; проверить маркировку.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

Принято в проекте Покупной готовый квас. Типичная основа — вода, хлебное или солодовое сырьё и сахар; точный состав берётся с этикетки. Производственный рецепт бренда не подменяется приблизительной домашней рецептурой.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Квас';
INSERT INTO "RecetaItem"(id,"recetaId","insumoId",cantidad,neto) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Insumo" WHERE nombre = 'Квас' ORDER BY id LIMIT 1), 0.3, 0.3 FROM "Producto" p WHERE p.nombre = 'Квас';
-- К01 Бизнес-ланч «Классический»
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 850, 'Технологический паспорт К01 · Бизнес-ланч Классический. Выход: 100 г салата + 250 г супа со сметаной + 250 г горячего + 250 мл компота.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Приготовить компоненты по картам Р01, С01, Г07 и Н02. Для этого предложенного варианта суп дня — борщ, горячее — плов.
2. Отвесить 100 г винегрета в отдельную салатницу. Суп 235 г дополнить 15 г сметаны в суповой посуде.
3. Плов отвесить 250 г, компот отмерить 250 мл. Проверить комплектность и подать.
4. При смене супа или горячего создать отдельный вариант комплекта с новым составом и калькуляцией.

Контроль качества Все компоненты соответствуют своим картам; количество и масса проверены, горячее и холодное поданы раздельно.

Отпуск Собирать под заказ. Горячие блюда и холодные салаты размещать в разной посуде; напитки отпускать отдельно.

Аллергены Молоко в сметане; остальные аллергены — по выбранным компонентам.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

СОСТАВ НАБОРА (документ): Винегрет готовый Р01 г — 100; Борщ без сметаны готовый С01 г — 235; Сметана к борщу г — 15; Плов готовый Г07 г — 250; Компот Н02 мл — 250.
Сметана к борщу (15 г) учтена внутри компонента «Борщ».

Принято в проекте Конкретные салат, суп и горячее в исходном меню не определены. Данный состав предложен для проработки; это один комплект, а не четыре полные порции меню.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Бизнес-ланч «Классический»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Винегрет' LIMIT 1), 0.555556 FROM "Producto" p WHERE p.nombre = 'Бизнес-ланч «Классический»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Борщ со сметаной' LIMIT 1), 0.671429 FROM "Producto" p WHERE p.nombre = 'Бизнес-ланч «Классический»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Плов по-узбекски' LIMIT 1), 0.714286 FROM "Producto" p WHERE p.nombre = 'Бизнес-ланч «Классический»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Компот из сухофруктов' LIMIT 1), 1 FROM "Producto" p WHERE p.nombre = 'Бизнес-ланч «Классический»';
-- К02 Бизнес-ланч «Лёгкий»
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 650, 'Технологический паспорт К02 · Бизнес-ланч Лёгкий. Выход: 250 г супа + 150 г салата + 50 г хлеба + 200 мл чая.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Приготовить суп с лапшой по С02 и винегрет по Р01. В уменьшенной порции супа пропорционально сохранить курицу, лапшу и яйцо.
2. Отвесить 250 г супа, 150 г салата и 50 г хлеба в отдельную посуду.
3. Заварить чай по Н06 и отпустить 200 мл настоя в чашке. Сахар в комплект не включён.
4. Проверить состав заказа; при выборе другого супа или салата заменить вариант комплекта в системе.

Контроль качества Все компоненты соответствуют своим картам; количество и масса проверены, горячее и холодное поданы раздельно.

Отпуск Собирать под заказ. Горячие блюда и холодные салаты размещать в разной посуде; напитки отпускать отдельно.

Аллергены Пшеница и глютен; яйцо; дополнительные аллергены по хлебу и лапше.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

СОСТАВ НАБОРА (документ): Куриный суп готовый С02 г — 250; Винегрет готовый Р01 г — 150; Хлеб готовый Р09 г — 50; Зелёный чай готовый Н06 мл — 200.

Принято в проекте Суп и салат предложены. Название «Лёгкий» сохранено из меню и не означает подтверждённую низкую калорийность.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Бизнес-ланч «Лёгкий»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Куриный бульон с лапшой' LIMIT 1), 0.714286 FROM "Producto" p WHERE p.nombre = 'Бизнес-ланч «Лёгкий»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Винегрет' LIMIT 1), 0.833333 FROM "Producto" p WHERE p.nombre = 'Бизнес-ланч «Лёгкий»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Хлеб / лепёшка' LIMIT 1), 1 FROM "Producto" p WHERE p.nombre = 'Бизнес-ланч «Лёгкий»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Чай зелёный (чайник)' LIMIT 1), 0.4 FROM "Producto" p WHERE p.nombre = 'Бизнес-ланч «Лёгкий»';
-- К03 Сет «Дуэт»
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 1250, 'Технологический паспорт К03 · Сет Дуэт. Выход: 24 пельменя со сметаной 550 г + салат 200 г + 2 компота по 250 мл.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Приготовить две полные порции пельменей по Г06: по 12 штук и 25 г сметаны на порцию.
2. Приготовить 200 г Оливье по Р06, разделить на две салатницы по 100 г либо подать общей порцией.
3. Разлить компот в два стакана по 250 мл. Пельмени подать сразу после варки.
4. При сборке проверить: 24 пельменя, 50 г сметаны суммарно, 200 г салата, два напитка.

Контроль качества Все компоненты соответствуют своим картам; количество и масса проверены, горячее и холодное поданы раздельно.

Отпуск Собирать под заказ. Горячие блюда и холодные салаты размещать в разной посуде; напитки отпускать отдельно.

Аллергены Пшеница и глютен; яйцо; молоко; возможны горчица и соя в покупных продуктах.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

СОСТАВ НАБОРА (документ): Пельмени со сметаной готовые Г06 г — 550; Салат Оливье готовый Р06 г — 200; Компот Н02 мл — 500.

Принято в проекте Меню не указывает количество пельменей и вид салата. Предложен вариант на двоих с двумя полными порциями пельменей.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Сет «Дуэт»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Пельмени со сметаной' LIMIT 1), 2 FROM "Producto" p WHERE p.nombre = 'Сет «Дуэт»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Салат «Оливье»' LIMIT 1), 1 FROM "Producto" p WHERE p.nombre = 'Сет «Дуэт»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Компот из сухофруктов' LIMIT 1), 2 FROM "Producto" p WHERE p.nombre = 'Сет «Дуэт»';
-- К04 Сет «Праздничный»
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 2520, 'Технологический паспорт К04 · Сет Праздничный. Выход: 700 г плова + 2 шампура с луком 420 г + 400 г салата + 1 л компота.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Приготовить две полные порции плова по Г07 и два шампура куриного шашлыка с луком по Г08.
2. Отвесить 400 г винегрета; разложить в общую салатницу или по 100 г на четыре человека.
3. Отмерить четыре компота по 250 мл. Горячее подать на отдельном общем блюде или порционно.
4. Проверить суммарные массы и количество шампуров. Не заменять куриный шашлык другим мясом без изменения карты.

Контроль качества Все компоненты соответствуют своим картам; количество и масса проверены, горячее и холодное поданы раздельно.

Отпуск Собирать под заказ. Горячие блюда и холодные салаты размещать в разной посуде; напитки отпускать отдельно.

Аллергены По фактическому сырью и компонентам; основные декларируемые аллергены в базовую рецептуру не добавлены.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

СОСТАВ НАБОРА (документ): Плов готовый Г07 г — 700; Шашлык с луком готовый Г08 г — 420; Винегрет готовый Р01 г — 400; Компот Н02 мл — 1000.

Принято в проекте Количество горячего и вид салата предложены; четыре компота соответствуют исходному описанию. Это общий сет, а не четыре полные порции каждого блюда.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Сет «Праздничный»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Плов по-узбекски' LIMIT 1), 2 FROM "Producto" p WHERE p.nombre = 'Сет «Праздничный»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Шашлык из курицы (шампур)' LIMIT 1), 2 FROM "Producto" p WHERE p.nombre = 'Сет «Праздничный»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Винегрет' LIMIT 1), 2.222222 FROM "Producto" p WHERE p.nombre = 'Сет «Праздничный»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Компот из сухофруктов' LIMIT 1), 4 FROM "Producto" p WHERE p.nombre = 'Сет «Праздничный»';
-- К05 Сет «Семейный»
INSERT INTO "Receta"(id,"productoId","restauranteId",rendimiento,tecnologia,"actualizadoEn") SELECT 'rec-'||p.id, p.id, p."restauranteId", 2700, 'Технологический паспорт К05 · Сет Семейный. Выход: 800 г бешбармака + 300 мл бульона + 400 г салата + 200 г баурсаков + 1 л компота.

ПРИГОТОВЛЕНИЕ И СБОРКА
1. Приготовить две полные порции бешбармака по Г02 и отдельно 300 мл его бульона. Для этого варианта выбран состав из говядины.
2. Подготовить 400 г винегрета и 200 г баурсаков; подать в отдельной посуде.
3. Налить четыре компота по 250 мл. Бульон разделить по согласованному способу подачи или поставить в общем чайнике для бульона.
4. Проверить выход всех пяти компонентов. Горячий бешбармак не смешивать с холодным салатом.

Контроль качества Все компоненты соответствуют своим картам; количество и масса проверены, горячее и холодное поданы раздельно.

Отпуск Собирать под заказ. Горячие блюда и холодные салаты размещать в разной посуде; напитки отпускать отдельно.

Аллергены Пшеница и глютен; яйцо; молоко в баурсаках.

Хранение и срок реализации — по общим требованиям и утверждённой карте предприятия.

СОСТАВ НАБОРА (документ): Бешбармак без отдельного бульона Г02 г — 800; Бульон к бешбармаку Г02 мл — 300; Винегрет готовый Р01 г — 400; Баурсаки готовые Д01 г — 200; Компот Н02 мл — 1000.
Бульон 300 мл учтён внутри компонента «Бешбармак» (2 порции = 800 г блюда + 300 мл бульона).

Принято в проекте Вид салата, выпечки, напитка и массы предложены. Четыре напитка сохранены; для других напитков создать варианты сета.

Нормы закладки — нетто (колонка «Нетто»), базовая редакция 1.0 (источник: «Технологические паспорта блюд и напитков»). В колонке «Брутто» (оно списывается со склада) пока те же значения: после контрольной обработки укажите брутто с учётом отходов.', now() FROM "Producto" p WHERE p.nombre = 'Сет «Семейный»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-01', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Бешбармак' LIMIT 1), 2 FROM "Producto" p WHERE p.nombre = 'Сет «Семейный»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-02', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Винегрет' LIMIT 1), 2.222222 FROM "Producto" p WHERE p.nombre = 'Сет «Семейный»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-03', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Баурсаки (порция)' LIMIT 1), 2 FROM "Producto" p WHERE p.nombre = 'Сет «Семейный»';
INSERT INTO "RecetaItem"(id,"recetaId","componenteId",cantidad) SELECT 'ri-'||p.id||'-04', 'rec-'||p.id, (SELECT id FROM "Producto" WHERE nombre = 'Компот из сухофруктов' LIMIT 1), 4 FROM "Producto" p WHERE p.nombre = 'Сет «Семейный»';

COMMIT;

-- Проверка: должно быть 51 тех-карта
SELECT count(*) AS tehkart FROM "Receta";
