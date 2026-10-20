// Тех-карты блюд и склад под СНГ-меню. Нормы закладки типовые (по сборникам рецептур): шеф-повар должен сверить их с реальными.
// Генерируется вместе с install-скриптом; запускается из seed.ts после создания меню и склада.
import { PrismaClient } from '@prisma/client';

const DATA = {
 "existentes": {
  "Картофель": 250,
  "Помидоры": 800,
  "Огурцы": 250,
  "Салат латук": 1500,
  "Лимон": 1200,
  "Соль": 100,
  "Растительное масло": 900,
  "Томатная паста": 900,
  "Кетчуп": 700,
  "Майонез": 750,
  "Приправа для курицы": 3000,
  "Древесный уголь": 300
 },
 "insumos": [
  {
   "id": "ins-govyadina",
   "nombre": "Говядина",
   "categoria": "Мясо",
   "unidad": "кг",
   "stock": 40,
   "minimo": 10,
   "costo": 3800
  },
  {
   "id": "ins-baranina",
   "nombre": "Баранина",
   "categoria": "Мясо",
   "unidad": "кг",
   "stock": 15,
   "minimo": 5,
   "costo": 4200
  },
  {
   "id": "ins-kuritsa_file",
   "nombre": "Куриное филе",
   "categoria": "Мясо",
   "unidad": "кг",
   "stock": 25,
   "minimo": 8,
   "costo": 2200
  },
  {
   "id": "ins-farsh",
   "nombre": "Фарш мясной",
   "categoria": "Мясо",
   "unidad": "кг",
   "stock": 12,
   "minimo": 4,
   "costo": 3200
  },
  {
   "id": "ins-kolbasa",
   "nombre": "Колбаса варёная",
   "categoria": "Мясо",
   "unidad": "кг",
   "stock": 6,
   "minimo": 2,
   "costo": 2800
  },
  {
   "id": "ins-seld",
   "nombre": "Сельдь солёная",
   "categoria": "Рыба",
   "unidad": "кг",
   "stock": 5,
   "minimo": 2,
   "costo": 2500
  },
  {
   "id": "ins-morkov",
   "nombre": "Морковь",
   "categoria": "Овощи",
   "unidad": "кг",
   "stock": 25,
   "minimo": 8,
   "costo": 200
  },
  {
   "id": "ins-luk",
   "nombre": "Лук репчатый",
   "categoria": "Овощи",
   "unidad": "кг",
   "stock": 25,
   "minimo": 8,
   "costo": 150
  },
  {
   "id": "ins-chesnok",
   "nombre": "Чеснок",
   "categoria": "Овощи",
   "unidad": "кг",
   "stock": 3,
   "minimo": 1,
   "costo": 1500
  },
  {
   "id": "ins-kapusta",
   "nombre": "Капуста белокочанная",
   "categoria": "Овощи",
   "unidad": "кг",
   "stock": 20,
   "minimo": 6,
   "costo": 180
  },
  {
   "id": "ins-svekla",
   "nombre": "Свёкла",
   "categoria": "Овощи",
   "unidad": "кг",
   "stock": 12,
   "minimo": 4,
   "costo": 200
  },
  {
   "id": "ins-romano",
   "nombre": "Салат романо",
   "categoria": "Овощи",
   "unidad": "кг",
   "stock": 4,
   "minimo": 1,
   "costo": 2500
  },
  {
   "id": "ins-zelen",
   "nombre": "Зелень (укроп, петрушка)",
   "categoria": "Овощи",
   "unidad": "кг",
   "stock": 3,
   "minimo": 1,
   "costo": 1500
  },
  {
   "id": "ins-goroshek",
   "nombre": "Горошек консервированный",
   "categoria": "Консервы",
   "unidad": "кг",
   "stock": 6,
   "minimo": 2,
   "costo": 900
  },
  {
   "id": "ins-ogurtsy_sol",
   "nombre": "Огурцы солёные",
   "categoria": "Консервы",
   "unidad": "кг",
   "stock": 6,
   "minimo": 2,
   "costo": 900
  },
  {
   "id": "ins-nut",
   "nombre": "Нут",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 5,
   "minimo": 2,
   "costo": 1200
  },
  {
   "id": "ins-klukva",
   "nombre": "Клюква",
   "categoria": "Ягоды",
   "unidad": "кг",
   "stock": 5,
   "minimo": 1.5,
   "costo": 3500
  },
  {
   "id": "ins-suhofrukty",
   "nombre": "Сухофрукты",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 6,
   "minimo": 2,
   "costo": 1800
  },
  {
   "id": "ins-muka",
   "nombre": "Мука пшеничная",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 60,
   "minimo": 20,
   "costo": 350
  },
  {
   "id": "ins-ris",
   "nombre": "Рис",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 30,
   "minimo": 10,
   "costo": 600
  },
  {
   "id": "ins-grechka",
   "nombre": "Гречневая крупа",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 20,
   "minimo": 6,
   "costo": 700
  },
  {
   "id": "ins-makarony",
   "nombre": "Макаронные изделия",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 12,
   "minimo": 4,
   "costo": 600
  },
  {
   "id": "ins-lapsha",
   "nombre": "Лапша для лагмана",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 10,
   "minimo": 3,
   "costo": 900
  },
  {
   "id": "ins-suhari",
   "nombre": "Сухари панировочные",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 3,
   "minimo": 1,
   "costo": 1500
  },
  {
   "id": "ins-sahar",
   "nombre": "Сахар",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 25,
   "minimo": 8,
   "costo": 500
  },
  {
   "id": "ins-med",
   "nombre": "Мёд",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 3,
   "minimo": 1,
   "costo": 4500
  },
  {
   "id": "ins-chai_black",
   "nombre": "Чай чёрный",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 2,
   "minimo": 0.5,
   "costo": 6000
  },
  {
   "id": "ins-chai_green",
   "nombre": "Чай зелёный",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 1.5,
   "minimo": 0.4,
   "costo": 6500
  },
  {
   "id": "ins-kofe",
   "nombre": "Кофе зерновой",
   "categoria": "Бакалея",
   "unidad": "кг",
   "stock": 3,
   "minimo": 1,
   "costo": 9000
  },
  {
   "id": "ins-spetsii",
   "nombre": "Специи универсальные",
   "categoria": "Специи",
   "unidad": "кг",
   "stock": 2,
   "minimo": 0.5,
   "costo": 4000
  },
  {
   "id": "ins-smetana",
   "nombre": "Сметана",
   "categoria": "Молочные",
   "unidad": "кг",
   "stock": 12,
   "minimo": 4,
   "costo": 1500
  },
  {
   "id": "ins-maslo_sl",
   "nombre": "Масло сливочное",
   "categoria": "Молочные",
   "unidad": "кг",
   "stock": 8,
   "minimo": 2,
   "costo": 4000
  },
  {
   "id": "ins-syr",
   "nombre": "Сыр твёрдый",
   "categoria": "Молочные",
   "unidad": "кг",
   "stock": 3,
   "minimo": 1,
   "costo": 4500
  },
  {
   "id": "ins-tvorog",
   "nombre": "Творог",
   "categoria": "Молочные",
   "unidad": "кг",
   "stock": 8,
   "minimo": 3,
   "costo": 1800
  },
  {
   "id": "ins-moloko",
   "nombre": "Молоко",
   "categoria": "Молочные",
   "unidad": "л",
   "stock": 20,
   "minimo": 6,
   "costo": 500
  },
  {
   "id": "ins-yaitso",
   "nombre": "Яйцо куриное",
   "categoria": "Яйца",
   "unidad": "шт",
   "stock": 240,
   "minimo": 60,
   "costo": 60
  },
  {
   "id": "ins-lepeshka",
   "nombre": "Лепёшка",
   "categoria": "Хлеб",
   "unidad": "шт",
   "stock": 60,
   "minimo": 15,
   "costo": 50
  },
  {
   "id": "ins-adzhika",
   "nombre": "Аджика",
   "categoria": "Соусы",
   "unidad": "кг",
   "stock": 4,
   "minimo": 1,
   "costo": 1800
  },
  {
   "id": "ins-cola05",
   "nombre": "Coca-Cola 0,5 л",
   "categoria": "Напитки",
   "unidad": "шт",
   "stock": 48,
   "minimo": 12,
   "costo": 350
  },
  {
   "id": "ins-cola15",
   "nombre": "Coca-Cola 1,5 л",
   "categoria": "Напитки",
   "unidad": "шт",
   "stock": 24,
   "minimo": 6,
   "costo": 650
  },
  {
   "id": "ins-pepsi05",
   "nombre": "Pepsi 0,5 л",
   "categoria": "Напитки",
   "unidad": "шт",
   "stock": 48,
   "minimo": 12,
   "costo": 350
  },
  {
   "id": "ins-pepsi15",
   "nombre": "Pepsi 1,5 л",
   "categoria": "Напитки",
   "unidad": "шт",
   "stock": 24,
   "minimo": 6,
   "costo": 650
  },
  {
   "id": "ins-voda05",
   "nombre": "Вода минеральная 0,5 л",
   "categoria": "Напитки",
   "unidad": "шт",
   "stock": 48,
   "minimo": 12,
   "costo": 150
  },
  {
   "id": "ins-ayran",
   "nombre": "Айран",
   "categoria": "Напитки",
   "unidad": "л",
   "stock": 20,
   "minimo": 6,
   "costo": 600
  },
  {
   "id": "ins-kvas",
   "nombre": "Квас",
   "categoria": "Напитки",
   "unidad": "л",
   "stock": 25,
   "minimo": 8,
   "costo": 500
  }
 ],
 "precios": {
  "prod-borsch": 1500,
  "prod-lagman": 1800,
  "prod-solyanka": 1900,
  "prod-bulyon": 1200,
  "prod-shorpa": 2200,
  "prod-pollo-entero": 3500,
  "prod-medio-pollo": 2200,
  "prod-cuarto-pollo": 2400,
  "prod-octavo-pollo": 1800,
  "prod-pelmeni": 1900,
  "prod-manty": 2200,
  "prod-golubtsy": 1900,
  "prod-stroganov": 2600,
  "prod-combo-personal": 3200,
  "prod-combo-broaster": 2400,
  "prod-combo-duo": 4500,
  "prod-combo-familiar": 9500,
  "prod-combo-broaster2": 7800,
  "prod-papas-fritas": 900,
  "prod-yuca-frita": 800,
  "prod-ensalada": 900,
  "prod-arroz": 500,
  "prod-chaufa-arroz": 800,
  "prod-vinegret": 800,
  "prod-caesar": 1800,
  "prod-shuba": 1000,
  "prod-hleb": 100,
  "prod-samsa": 700,
  "prod-blini": 1100,
  "prod-syrniki": 1200,
  "prod-napoleon": 1100,
  "prod-chak-chak": 800,
  "prod-baursaki": 600,
  "prod-coca-personal": 700,
  "prod-coca-grande": 1300,
  "prod-inca-personal": 700,
  "prod-inca-grande": 1300,
  "prod-agua": 400,
  "prod-limonada": 900,
  "prod-chicha": 600,
  "prod-kompot": 400,
  "prod-chai-black": 600,
  "prod-chai-green": 600,
  "prod-coffee": 900,
  "prod-ayran": 500,
  "prod-kvas": 500,
  "prod-ketchup": 100,
  "prod-mayonesa": 100,
  "prod-aji-verde": 250,
  "prod-salsa-criolla": 200,
  "prod-salsa-huancaina": 300
 },
 "recetas": [
  {
   "productoId": "prod-borsch",
   "rendimiento": 350,
   "tecnologia": "Говядину отварить в холодной воде, бульон процедить. Свёклу и морковь пассеровать с томатным пюре, добавить картофель и капусту, варить до готовности. Подавать со сметаной.\n\nИсточник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 82 «Борщ с капустой свежей с мясом и со сметаной» (выход 250 г), пересчитано на 350 г (×1,4).",
   "items": [
    {
     "insumo": "Говядина",
     "cantidad": 0.045
    },
    {
     "insumo": "Свёкла",
     "cantidad": 0.07
    },
    {
     "insumo": "Капуста белокочанная",
     "cantidad": 0.035
    },
    {
     "insumo": "Картофель",
     "cantidad": 0.041
    },
    {
     "insumo": "Морковь",
     "cantidad": 0.035
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.025
    },
    {
     "insumo": "Томатная паста",
     "cantidad": 0.004
    },
    {
     "insumo": "Масло сливочное",
     "cantidad": 0.006
    },
    {
     "insumo": "Сахар",
     "cantidad": 0.003
    },
    {
     "insumo": "Сметана",
     "cantidad": 0.01
    }
   ]
  },
  {
   "productoId": "prod-lagman",
   "rendimiento": 400,
   "tecnologia": "Мясо обжарить с луком и морковью, добавить томатную пасту, чеснок, картофель, тушить. Лапшу отварить отдельно, подавать в тарелке с наваристым бульоном.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Говядина",
     "cantidad": 0.07
    },
    {
     "insumo": "Лапша для лагмана",
     "cantidad": 0.08
    },
    {
     "insumo": "Картофель",
     "cantidad": 0.04
    },
    {
     "insumo": "Морковь",
     "cantidad": 0.025
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.025
    },
    {
     "insumo": "Томатная паста",
     "cantidad": 0.015
    },
    {
     "insumo": "Чеснок",
     "cantidad": 0.005
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.015
    },
    {
     "insumo": "Зелень (укроп, петрушка)",
     "cantidad": 0.005
    },
    {
     "insumo": "Соль",
     "cantidad": 0.003
    },
    {
     "insumo": "Специи универсальные",
     "cantidad": 0.001
    }
   ]
  },
  {
   "productoId": "prod-solyanka",
   "rendimiento": 350,
   "tecnologia": "Картофель отварить, добавить пассерованный лук с томатной пастой, нарезанные соленые огурцы, отварные говядину и курицу. Варить 5–10 минут, за 5 минут до готовности положить сметану. Подавать с лимоном.\n\nИсточник норм: Сборник рецептур для предприятий общественного питания при общеобразовательных школах, под ред. В. Т. Лапшиной (М.: Хлебпродинформ, 2004), рецептура № 157 «Солянка домашняя со сметаной» (выход 250 г), пересчитано на 350 г (×1,4); лимон — по технологии карты.",
   "items": [
    {
     "insumo": "Говядина",
     "cantidad": 0.036
    },
    {
     "insumo": "Куриное филе",
     "cantidad": 0.031
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.029
    },
    {
     "insumo": "Огурцы солёные",
     "cantidad": 0.035
    },
    {
     "insumo": "Картофель",
     "cantidad": 0.076
    },
    {
     "insumo": "Томатная паста",
     "cantidad": 0.005
    },
    {
     "insumo": "Масло сливочное",
     "cantidad": 0.006
    },
    {
     "insumo": "Сметана",
     "cantidad": 0.007
    },
    {
     "insumo": "Лимон",
     "cantidad": 0.01
    }
   ]
  },
  {
   "productoId": "prod-bulyon",
   "rendimiento": 350,
   "tecnologia": "Куриное филе отварить, бульон процедить. Морковь и лук припустить с маслом, добавить картофель и макаронные изделия, варить до готовности.\n\nИсточник норм: Сборник рецептур для предприятий общественного питания при общеобразовательных школах, под ред. В. Т. Лапшиной (М.: Хлебпродинформ, 2004), карта № 140 «Суп с изделиями макаронными» (выход 250 г), пересчитано на 350 г (×1,4); куриное филе для бульона — расчётное.",
   "items": [
    {
     "insumo": "Куриное филе",
     "cantidad": 0.08
    },
    {
     "insumo": "Макаронные изделия",
     "cantidad": 0.014
    },
    {
     "insumo": "Картофель",
     "cantidad": 0.14
    },
    {
     "insumo": "Морковь",
     "cantidad": 0.018
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.017
    },
    {
     "insumo": "Масло сливочное",
     "cantidad": 0.004
    },
    {
     "insumo": "Соль",
     "cantidad": 0.001
    }
   ]
  },
  {
   "productoId": "prod-shorpa",
   "rendimiento": 400,
   "tecnologia": "Баранину варить на медленном огне до мягкости, добавить крупно нарезанные картофель, морковь, лук, помидоры. Подавать с зеленью.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Баранина",
     "cantidad": 0.1
    },
    {
     "insumo": "Картофель",
     "cantidad": 0.08
    },
    {
     "insumo": "Морковь",
     "cantidad": 0.025
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.025
    },
    {
     "insumo": "Помидоры",
     "cantidad": 0.03
    },
    {
     "insumo": "Зелень (укроп, петрушка)",
     "cantidad": 0.005
    },
    {
     "insumo": "Соль",
     "cantidad": 0.003
    },
    {
     "insumo": "Специи универсальные",
     "cantidad": 0.001
    }
   ]
  },
  {
   "productoId": "prod-pollo-entero",
   "rendimiento": 450,
   "tecnologia": "Мясо (вырезка и суповой набор) отварить с луком и морковью, бульон процедить. Тесто на яйце и бульоне раскатать, нарезать пластами, отварить. Выложить на блюдо с мясом и луком, подавать с бульоном и зеленью.\n\nИсточник норм: ВкусВилл, рецепт «Бешбармак» на 7 порций (vkusvill.ru/media/recipes/beshbarmak.html): мясо 800 г, мука 400 г, яйцо 1 шт., лук, морковь — пересчитано на 1 порцию.",
   "items": [
    {
     "insumo": "Говядина",
     "cantidad": 0.114
    },
    {
     "insumo": "Мука пшеничная",
     "cantidad": 0.057
    },
    {
     "insumo": "Яйцо куриное",
     "cantidad": 0.14
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.029
    },
    {
     "insumo": "Морковь",
     "cantidad": 0.011
    },
    {
     "insumo": "Зелень (укроп, петрушка)",
     "cantidad": 0.003
    },
    {
     "insumo": "Чеснок",
     "cantidad": 0.002
    },
    {
     "insumo": "Соль",
     "cantidad": 0.002
    }
   ]
  },
  {
   "productoId": "prod-medio-pollo",
   "rendimiento": 350,
   "tecnologia": "Мясо обжарить в казане с луком и морковью, добавить нут и зиру, залить водой (зирвак). Заложить промытый рис, довести до готовности, настоять.\n\nИсточник норм: Госкомстат Республики Узбекистан, состав для «индекса плова» на 1 кг риса: 1 кг моркови, 0,7 кг говядины, 0,3 л масла, 0,3 кг лука, 0,1 кг нута, зира, соль (stat.uz, podrobno.uz); порция на 100 г риса.",
   "items": [
    {
     "insumo": "Рис",
     "cantidad": 0.1
    },
    {
     "insumo": "Морковь",
     "cantidad": 0.1
    },
    {
     "insumo": "Говядина",
     "cantidad": 0.07
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.03
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.03
    },
    {
     "insumo": "Нут",
     "cantidad": 0.01
    },
    {
     "insumo": "Специи универсальные",
     "cantidad": 0.001
    },
    {
     "insumo": "Соль",
     "cantidad": 0.002
    }
   ]
  },
  {
   "productoId": "prod-cuarto-pollo",
   "rendimiento": 250,
   "tecnologia": "Филе отбить, завернуть кусочек масла, запанировать в муке, яйце и сухарях, обжарить во фритюре. Подать с картофельным пюре.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Куриное филе",
     "cantidad": 0.14
    },
    {
     "insumo": "Масло сливочное",
     "cantidad": 0.035
    },
    {
     "insumo": "Яйцо куриное",
     "cantidad": 0.5
    },
    {
     "insumo": "Мука пшеничная",
     "cantidad": 0.01
    },
    {
     "insumo": "Сухари панировочные",
     "cantidad": 0.025
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.03
    },
    {
     "insumo": "Картофель",
     "cantidad": 0.15
    },
    {
     "insumo": "Молоко",
     "cantidad": 0.03
    },
    {
     "insumo": "Зелень (укроп, петрушка)",
     "cantidad": 0.003
    },
    {
     "insumo": "Соль",
     "cantidad": 0.002
    }
   ]
  },
  {
   "productoId": "prod-octavo-pollo",
   "rendimiento": 150,
   "tecnologia": "Филе нарезать кусочками, замариновать с луком и приправой на 2–3 часа, нанизать на шампур, жарить на углях.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Куриное филе",
     "cantidad": 0.14
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.03
    },
    {
     "insumo": "Приправа для курицы",
     "cantidad": 0.002
    },
    {
     "insumo": "Соль",
     "cantidad": 0.002
    },
    {
     "insumo": "Древесный уголь",
     "cantidad": 0.1
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.005
    }
   ]
  },
  {
   "productoId": "prod-pelmeni",
   "rendimiento": 300,
   "tecnologia": "Тесто из муки, яйца и воды, начинка из фарша с луком. Лепить, варить 7–8 минут после всплытия. Подавать со сметаной.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Мука пшеничная",
     "cantidad": 0.1
    },
    {
     "insumo": "Фарш мясной",
     "cantidad": 0.1
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.02
    },
    {
     "insumo": "Яйцо куриное",
     "cantidad": 0.2
    },
    {
     "insumo": "Соль",
     "cantidad": 0.003
    },
    {
     "insumo": "Сметана",
     "cantidad": 0.03
    }
   ]
  },
  {
   "productoId": "prod-manty",
   "rendimiento": 250,
   "tecnologia": "Тесто раскатать, заполнить рубленым мясом с луком, защипнуть, готовить на пару 40–45 минут.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Мука пшеничная",
     "cantidad": 0.09
    },
    {
     "insumo": "Говядина",
     "cantidad": 0.1
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.07
    },
    {
     "insumo": "Соль",
     "cantidad": 0.003
    },
    {
     "insumo": "Масло сливочное",
     "cantidad": 0.005
    }
   ]
  },
  {
   "productoId": "prod-golubtsy",
   "rendimiento": 300,
   "tecnologia": "Капустные листья ошпарить, завернуть фарш с рисом, уложить в соус из томатной пасты, моркови и лука, тушить. Подать со сметаной.\n\nИсточник норм: Лайфхакер, «Классические голубцы» на 6 порций (фарш 1 кг, рис 150 г, томатная паста 150–200 г) и Lady.mail.ru (ленивые голубцы на 4 порции) — пересчитано на 1 порцию.",
   "items": [
    {
     "insumo": "Капуста белокочанная",
     "cantidad": 0.15
    },
    {
     "insumo": "Фарш мясной",
     "cantidad": 0.15
    },
    {
     "insumo": "Рис",
     "cantidad": 0.025
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.025
    },
    {
     "insumo": "Морковь",
     "cantidad": 0.02
    },
    {
     "insumo": "Томатная паста",
     "cantidad": 0.025
    },
    {
     "insumo": "Сметана",
     "cantidad": 0.02
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.01
    }
   ]
  },
  {
   "productoId": "prod-stroganov",
   "rendimiento": 300,
   "tecnologia": "Отварное мясо нарезать соломкой, соединить с протёртой отварной морковью и сметанным соусом, тушить 5–10 минут. Подавать с рассыпчатой гречкой.\n\nИсточник норм: Сборник технологических нормативов для школ, под ред. А. Я. Перевалова (Уральский региональный центр питания, 2013), рецептура № 366/442 «Бефстроганов из отварной говядины» (выход 100 г), пересчитано на 150 г мяса с соусом; гарнир — Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), № 171.",
   "items": [
    {
     "insumo": "Говядина",
     "cantidad": 0.132
    },
    {
     "insumo": "Морковь",
     "cantidad": 0.019
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.004
    },
    {
     "insumo": "Мука пшеничная",
     "cantidad": 0.0023
    },
    {
     "insumo": "Масло сливочное",
     "cantidad": 0.01
    },
    {
     "insumo": "Сметана",
     "cantidad": 0.044
    },
    {
     "insumo": "Гречневая крупа",
     "cantidad": 0.06
    },
    {
     "insumo": "Соль",
     "cantidad": 0.003
    }
   ]
  },
  {
   "productoId": "prod-combo-personal",
   "rendimiento": null,
   "tecnologia": "Комплексный обед: салат «Оливье» + борщ + бефстроганов с гречкой + компот. Списывается как набор блюд.",
   "items": [
    {
     "componenteId": "prod-ensalada",
     "cantidad": 1
    },
    {
     "componenteId": "prod-borsch",
     "cantidad": 1
    },
    {
     "componenteId": "prod-stroganov",
     "cantidad": 1
    },
    {
     "componenteId": "prod-kompot",
     "cantidad": 1
    }
   ]
  },
  {
   "productoId": "prod-combo-broaster",
   "rendimiento": null,
   "tecnologia": "Лёгкий обед: бульон + винегрет + хлеб + чай.",
   "items": [
    {
     "componenteId": "prod-bulyon",
     "cantidad": 1
    },
    {
     "componenteId": "prod-vinegret",
     "cantidad": 1
    },
    {
     "componenteId": "prod-hleb",
     "cantidad": 1
    },
    {
     "componenteId": "prod-chai-black",
     "cantidad": 1
    }
   ]
  },
  {
   "productoId": "prod-combo-duo",
   "rendimiento": null,
   "tecnologia": "Сет для двоих: пельмени + салат «Оливье» + 2 компота.",
   "items": [
    {
     "componenteId": "prod-pelmeni",
     "cantidad": 1
    },
    {
     "componenteId": "prod-ensalada",
     "cantidad": 1
    },
    {
     "componenteId": "prod-kompot",
     "cantidad": 2
    }
   ]
  },
  {
   "productoId": "prod-combo-familiar",
   "rendimiento": null,
   "tecnologia": "Семейный сет: бешбармак + салат «Оливье» + самса + 4 компота.",
   "items": [
    {
     "componenteId": "prod-pollo-entero",
     "cantidad": 1
    },
    {
     "componenteId": "prod-ensalada",
     "cantidad": 1
    },
    {
     "componenteId": "prod-samsa",
     "cantidad": 1
    },
    {
     "componenteId": "prod-kompot",
     "cantidad": 4
    }
   ]
  },
  {
   "productoId": "prod-combo-broaster2",
   "rendimiento": null,
   "tecnologia": "Праздничный сет: плов + шашлык + салат «Оливье» + 4 компота.",
   "items": [
    {
     "componenteId": "prod-medio-pollo",
     "cantidad": 1
    },
    {
     "componenteId": "prod-octavo-pollo",
     "cantidad": 1
    },
    {
     "componenteId": "prod-ensalada",
     "cantidad": 1
    },
    {
     "componenteId": "prod-kompot",
     "cantidad": 4
    }
   ]
  },
  {
   "productoId": "prod-papas-fritas",
   "rendimiento": 150,
   "tecnologia": "Картофель нарезать брусочками, обсушить, обжарить во фритюре до золотистой корочки, посолить.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Картофель",
     "cantidad": 0.2
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.04
    },
    {
     "insumo": "Соль",
     "cantidad": 0.002
    }
   ]
  },
  {
   "productoId": "prod-yuca-frita",
   "rendimiento": 200,
   "tecnologia": "Картофель отварить, растереть горячим, вводя кипячёное молоко и растопленное сливочное масло, взбить до однородности.\n\nИсточник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 312 «Пюре картофельное» (выход 200 г).",
   "items": [
    {
     "insumo": "Картофель",
     "cantidad": 0.246
    },
    {
     "insumo": "Молоко",
     "cantidad": 0.03
    },
    {
     "insumo": "Масло сливочное",
     "cantidad": 0.006
    },
    {
     "insumo": "Соль",
     "cantidad": 0.001
    }
   ]
  },
  {
   "productoId": "prod-ensalada",
   "rendimiento": 150,
   "tecnologia": "Отварные картофель, морковь и яйца, колбасу и соленые огурцы нарезать кубиком, добавить горошек, заправить майонезом.\n\nИсточник норм: Лайфхакер и Lady.mail.ru, классический «Оливье» на 8 порций (колбаса 350 г, горошек 300 г, яйца 5 шт.) — пересчитано на 1 порцию.",
   "items": [
    {
     "insumo": "Колбаса варёная",
     "cantidad": 0.044
    },
    {
     "insumo": "Горошек консервированный",
     "cantidad": 0.037
    },
    {
     "insumo": "Яйцо куриное",
     "cantidad": 0.63
    },
    {
     "insumo": "Картофель",
     "cantidad": 0.055
    },
    {
     "insumo": "Морковь",
     "cantidad": 0.03
    },
    {
     "insumo": "Огурцы солёные",
     "cantidad": 0.03
    },
    {
     "insumo": "Майонез",
     "cantidad": 0.03
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.005
    },
    {
     "insumo": "Соль",
     "cantidad": 0.001
    }
   ]
  },
  {
   "productoId": "prod-arroz",
   "rendimiento": 150,
   "tecnologia": "Крупу перебрать, промыть, всыпать в кипящую подсоленную воду, варить до загустения и довести до готовности под крышкой. Заправить сливочным маслом.\n\nИсточник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 171 «Каша рассыпчатая» (гречневая, выход 150 г).",
   "items": [
    {
     "insumo": "Гречневая крупа",
     "cantidad": 0.067
    },
    {
     "insumo": "Масло сливочное",
     "cantidad": 0.009
    },
    {
     "insumo": "Соль",
     "cantidad": 0.001
    }
   ]
  },
  {
   "productoId": "prod-chaufa-arroz",
   "rendimiento": 250,
   "tecnologia": "Макароны отварить в подсоленной воде. Фарш обжарить с луком и томатной пастой, соединить с макаронами, заправить маслом.\n\nИсточник норм: Макароны — Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 203 (отварные макаронные изделия, 53 г на 160 г готовых); фарш и овощи — ориентировочно.",
   "items": [
    {
     "insumo": "Макаронные изделия",
     "cantidad": 0.06
    },
    {
     "insumo": "Фарш мясной",
     "cantidad": 0.08
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.025
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.01
    },
    {
     "insumo": "Томатная паста",
     "cantidad": 0.01
    },
    {
     "insumo": "Масло сливочное",
     "cantidad": 0.006
    },
    {
     "insumo": "Соль",
     "cantidad": 0.002
    }
   ]
  },
  {
   "productoId": "prod-vinegret",
   "rendimiento": 150,
   "tecnologia": "Отварные свёклу, картофель, морковь нарезать кубиком, смешать с огурцом, горошком и луком, заправить маслом.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Свёкла",
     "cantidad": 0.06
    },
    {
     "insumo": "Картофель",
     "cantidad": 0.04
    },
    {
     "insumo": "Морковь",
     "cantidad": 0.02
    },
    {
     "insumo": "Огурцы солёные",
     "cantidad": 0.025
    },
    {
     "insumo": "Горошек консервированный",
     "cantidad": 0.015
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.01
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.01
    }
   ]
  },
  {
   "productoId": "prod-caesar",
   "rendimiento": 200,
   "tecnologia": "Куриное филе обжарить, нарезать. Салат романо, помидоры, сыр и сухарики смешать с соусом.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Куриное филе",
     "cantidad": 0.08
    },
    {
     "insumo": "Салат романо",
     "cantidad": 0.05
    },
    {
     "insumo": "Помидоры",
     "cantidad": 0.03
    },
    {
     "insumo": "Сыр твёрдый",
     "cantidad": 0.015
    },
    {
     "insumo": "Сухари панировочные",
     "cantidad": 0.015
    },
    {
     "insumo": "Майонез",
     "cantidad": 0.025
    },
    {
     "insumo": "Чеснок",
     "cantidad": 0.002
    }
   ]
  },
  {
   "productoId": "prod-shuba",
   "rendimiento": 180,
   "tecnologia": "Слоями: сельдь, картофель, морковь, лук, свёкла, яйцо; каждый слой промазать майонезом. Настоять не менее 2 часов.\n\nИсточник норм: Сельдь — Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 76 (филе 58 г на порцию 60 г); остальные слои — ориентировочно.",
   "items": [
    {
     "insumo": "Сельдь солёная",
     "cantidad": 0.06
    },
    {
     "insumo": "Картофель",
     "cantidad": 0.05
    },
    {
     "insumo": "Морковь",
     "cantidad": 0.025
    },
    {
     "insumo": "Свёкла",
     "cantidad": 0.05
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.015
    },
    {
     "insumo": "Яйцо куриное",
     "cantidad": 0.3
    },
    {
     "insumo": "Майонез",
     "cantidad": 0.03
    }
   ]
  },
  {
   "productoId": "prod-hleb",
   "rendimiento": null,
   "tecnologia": "Лепёшка из тандыра или свежий хлеб, 1 шт.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Лепёшка",
     "cantidad": 1
    }
   ]
  },
  {
   "productoId": "prod-samsa",
   "rendimiento": 150,
   "tecnologia": "Слоёное тесто, начинка из рубленой говядины с луком и маслом, выпекать 25–30 минут.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Мука пшеничная",
     "cantidad": 0.07
    },
    {
     "insumo": "Говядина",
     "cantidad": 0.06
    },
    {
     "insumo": "Лук репчатый",
     "cantidad": 0.06
    },
    {
     "insumo": "Масло сливочное",
     "cantidad": 0.015
    },
    {
     "insumo": "Яйцо куриное",
     "cantidad": 0.1
    },
    {
     "insumo": "Соль",
     "cantidad": 0.002
    }
   ]
  },
  {
   "productoId": "prod-blini",
   "rendimiento": 200,
   "tecnologia": "Тонкие блины на молоке и яйце, начинка из творога с сахаром. Подавать со сметаной.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Мука пшеничная",
     "cantidad": 0.05
    },
    {
     "insumo": "Молоко",
     "cantidad": 0.12
    },
    {
     "insumo": "Яйцо куриное",
     "cantidad": 1
    },
    {
     "insumo": "Творог",
     "cantidad": 0.08
    },
    {
     "insumo": "Сахар",
     "cantidad": 0.015
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.015
    },
    {
     "insumo": "Сметана",
     "cantidad": 0.03
    }
   ]
  },
  {
   "productoId": "prod-syrniki",
   "rendimiento": 180,
   "tecnologia": "Творог смешать с яйцом, мукой и сахаром, сформовать, обжарить с двух сторон до золотистой корочки. Подавать со сметаной.\n\nИсточник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 219 «Сырники из творога» (для 12+ лет, выход 150 г), пересчитано на 180 г; вместо сгущённого молока — сметана.",
   "items": [
    {
     "insumo": "Творог",
     "cantidad": 0.167
    },
    {
     "insumo": "Яйцо куриное",
     "cantidad": 0.17
    },
    {
     "insumo": "Мука пшеничная",
     "cantidad": 0.024
    },
    {
     "insumo": "Сахар",
     "cantidad": 0.017
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.006
    },
    {
     "insumo": "Сметана",
     "cantidad": 0.03
    }
   ]
  },
  {
   "productoId": "prod-napoleon",
   "rendimiento": 120,
   "tecnologia": "Слоёные коржи промазать заварным кремом (молоко, яйцо, сахар, масло), выдержать в холоде 6–8 часов.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Мука пшеничная",
     "cantidad": 0.04
    },
    {
     "insumo": "Масло сливочное",
     "cantidad": 0.04
    },
    {
     "insumo": "Молоко",
     "cantidad": 0.06
    },
    {
     "insumo": "Яйцо куриное",
     "cantidad": 0.5
    },
    {
     "insumo": "Сахар",
     "cantidad": 0.03
    }
   ]
  },
  {
   "productoId": "prod-chak-chak",
   "rendimiento": 80,
   "tecnologia": "Жареные полоски теста соединить горячим мёдом с сахаром, придать форму.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Мука пшеничная",
     "cantidad": 0.035
    },
    {
     "insumo": "Яйцо куриное",
     "cantidad": 0.7
    },
    {
     "insumo": "Мёд",
     "cantidad": 0.025
    },
    {
     "insumo": "Сахар",
     "cantidad": 0.01
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.015
    }
   ]
  },
  {
   "productoId": "prod-baursaki",
   "rendimiento": 100,
   "tecnologia": "Дрожжевое тесто, раскатать, нарезать ромбами, обжарить во фритюре.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Мука пшеничная",
     "cantidad": 0.06
    },
    {
     "insumo": "Молоко",
     "cantidad": 0.03
    },
    {
     "insumo": "Яйцо куриное",
     "cantidad": 0.3
    },
    {
     "insumo": "Растительное масло",
     "cantidad": 0.04
    },
    {
     "insumo": "Сахар",
     "cantidad": 0.005
    },
    {
     "insumo": "Соль",
     "cantidad": 0.001
    }
   ]
  },
  {
   "productoId": "prod-coca-personal",
   "rendimiento": 500,
   "tecnologia": "Готовый напиток, 1 бутылка.",
   "items": [
    {
     "insumo": "Coca-Cola 0,5 л",
     "cantidad": 1
    }
   ]
  },
  {
   "productoId": "prod-coca-grande",
   "rendimiento": 1500,
   "tecnologia": "Готовый напиток, 1 бутылка.",
   "items": [
    {
     "insumo": "Coca-Cola 1,5 л",
     "cantidad": 1
    }
   ]
  },
  {
   "productoId": "prod-inca-personal",
   "rendimiento": 500,
   "tecnologia": "Готовый напиток, 1 бутылка.",
   "items": [
    {
     "insumo": "Pepsi 0,5 л",
     "cantidad": 1
    }
   ]
  },
  {
   "productoId": "prod-inca-grande",
   "rendimiento": 1500,
   "tecnologia": "Готовый напиток, 1 бутылка.",
   "items": [
    {
     "insumo": "Pepsi 1,5 л",
     "cantidad": 1
    }
   ]
  },
  {
   "productoId": "prod-agua",
   "rendimiento": 500,
   "tecnologia": "Готовый напиток, 1 бутылка.",
   "items": [
    {
     "insumo": "Вода минеральная 0,5 л",
     "cantidad": 1
    }
   ]
  },
  {
   "productoId": "prod-limonada",
   "rendimiento": 350,
   "tecnologia": "Лимон выжать, смешать с сахарным сиропом, добавить воду и лёд.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Лимон",
     "cantidad": 0.04
    },
    {
     "insumo": "Сахар",
     "cantidad": 0.03
    }
   ]
  },
  {
   "productoId": "prod-chicha",
   "rendimiento": 300,
   "tecnologia": "Клюкву протереть, сварить с сахаром, остудить.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Клюква",
     "cantidad": 0.06
    },
    {
     "insumo": "Сахар",
     "cantidad": 0.025
    }
   ]
  },
  {
   "productoId": "prod-kompot",
   "rendimiento": 250,
   "tecnologia": "Сухофрукты промыть, варить 20 минут с сахаром, настоять.\n\nИсточник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 348 «Компот из кураги» (180 мл), пересчитано на 250 мл; вместо кураги — сухофрукты.",
   "items": [
    {
     "insumo": "Сухофрукты",
     "cantidad": 0.053
    },
    {
     "insumo": "Сахар",
     "cantidad": 0.0125
    }
   ]
  },
  {
   "productoId": "prod-chai-black",
   "rendimiento": 500,
   "tecnologia": "Заварить чёрный чай в чайнике на 500 мл, подать с сахаром и лимоном.\n\nИсточник норм: Сборник технических нормативов — Сборник рецептур блюд и кулинарных изделий для питания школьников, под ред. М. П. Могильного (М.: ДеЛи принт, 2005), рецептура № 375/377 «Чай с сахаром и лимоном» (200 мл), пересчитано на чайник 500 мл (×2,5).",
   "items": [
    {
     "insumo": "Чай чёрный",
     "cantidad": 0.0025
    },
    {
     "insumo": "Сахар",
     "cantidad": 0.022
    },
    {
     "insumo": "Лимон",
     "cantidad": 0.015
    }
   ]
  },
  {
   "productoId": "prod-chai-green",
   "rendimiento": 500,
   "tecnologia": "Заварить зелёный чай в чайнике на 500 мл.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Чай зелёный",
     "cantidad": 0.005
    }
   ]
  },
  {
   "productoId": "prod-coffee",
   "rendimiento": 200,
   "tecnologia": "Эспрессо из зерновых 12 г, долить горячую воду.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Кофе зерновой",
     "cantidad": 0.012
    }
   ]
  },
  {
   "productoId": "prod-ayran",
   "rendimiento": 300,
   "tecnologia": "Готовый напиток, стакан 300 мл.",
   "items": [
    {
     "insumo": "Айран",
     "cantidad": 0.3
    }
   ]
  },
  {
   "productoId": "prod-kvas",
   "rendimiento": 300,
   "tecnologia": "Готовый напиток, стакан 300 мл.",
   "items": [
    {
     "insumo": "Квас",
     "cantidad": 0.3
    }
   ]
  },
  {
   "productoId": "prod-ketchup",
   "rendimiento": 30,
   "tecnologia": "Порция кетчупа.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Кетчуп",
     "cantidad": 0.03
    }
   ]
  },
  {
   "productoId": "prod-mayonesa",
   "rendimiento": 30,
   "tecnologia": "Порция майонеза.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Майонез",
     "cantidad": 0.03
    }
   ]
  },
  {
   "productoId": "prod-aji-verde",
   "rendimiento": 40,
   "tecnologia": "Порция сметаны.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Сметана",
     "cantidad": 0.04
    }
   ]
  },
  {
   "productoId": "prod-salsa-criolla",
   "rendimiento": 30,
   "tecnologia": "Порция аджики.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Аджика",
     "cantidad": 0.03
    }
   ]
  },
  {
   "productoId": "prod-salsa-huancaina",
   "rendimiento": 30,
   "tecnologia": "Майонез смешать с измельчённым чесноком.\n\nНормы ориентировочные (типовые): не найдены в нормативных сборниках, сверьте с рецептурой вашей кухни.",
   "items": [
    {
     "insumo": "Майонез",
     "cantidad": 0.025
    },
    {
     "insumo": "Чеснок",
     "cantidad": 0.005
    }
   ]
  }
 ]
} as const;

export async function sembrarRecetas(prisma: PrismaClient, restauranteId: string): Promise<void> {
  for (const [nombre, costo] of Object.entries(DATA.existentes)) {
    await prisma.insumo.updateMany({ where: { restauranteId, nombre, costoUnitario: null }, data: { costoUnitario: costo } });
  }
  for (const i of DATA.insumos) {
    const ya = await prisma.insumo.findFirst({ where: { restauranteId, nombre: i.nombre } });
    if (ya) continue;
    await prisma.insumo.create({ data: { id: i.id, nombre: i.nombre, categoria: i.categoria, unidad: i.unidad, stockActual: i.stock, stockMinimo: i.minimo, costoUnitario: i.costo, restauranteId } });
    await prisma.movimientoInventario.create({ data: { restauranteId, insumoId: i.id, tipo: 'INICIAL', cantidad: i.stock, saldo: i.stock, costoUnitario: i.costo, motivo: 'Начальный остаток' } });
  }
  for (const [id, precio] of Object.entries(DATA.precios)) {
    await prisma.producto.updateMany({ where: { id, restauranteId }, data: { precio } });
  }
  for (const r of DATA.recetas) {
    const items: { insumoId?: string; componenteId?: string; cantidad: number }[] = [];
    for (const it of r.items) {
      if ('componenteId' in it) items.push({ componenteId: it.componenteId, cantidad: it.cantidad });
      else {
        const ins = await prisma.insumo.findFirst({ where: { restauranteId, nombre: it.insumo } });
        if (ins) items.push({ insumoId: ins.id, cantidad: it.cantidad });
      }
    }
    await prisma.receta.create({ data: { id: 'rec-' + r.productoId, productoId: r.productoId, restauranteId, rendimiento: r.rendimiento, tecnologia: r.tecnologia, items: { create: items } } });
  }
  console.log(`✅ Тех-карты: ${DATA.recetas.length}, новых ингредиентов: ${DATA.insumos.length}`);
}
