import { sembrarRecetas } from './seed-recetas';
import { PrismaClient, Rol, EstadoMesa } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpiando base de datos...');

  // Limpiar en orden por FK
  await prisma.recetaItem.deleteMany();
  await prisma.receta.deleteMany();
  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.insumo.deleteMany();
  await prisma.mesa.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.restaurante.deleteMany();

  console.log('✅ BD limpia');
  console.log('🌱 Cargando datos de pollería...');

  // ── Restaurante ──────────────────────────────────────────────────────
  const restaurante = await prisma.restaurante.create({
    data: {
      id: 'rest-polleria-1',
      nombre: 'Pollería El Gallo de Oro',
      direccion: 'Av. Principal 456',
      telefono: '01-234-5678',
      timerMesa: 45,
    },
  });
  console.log('✅ Restaurante:', restaurante.nombre);

  // ── Usuarios ─────────────────────────────────────────────────────────
  const usuarios = [
    { nombre: 'Владелец',        email: 'owner@polleria.com',   password: 'Owner123!',  rol: Rol.SUPERADMIN },
    { nombre: 'Administrador',   email: 'admin@polleria.com',   password: 'Admin123!',  rol: Rol.ADMIN },
    { nombre: 'Carlos Mesero',   email: 'mesero@polleria.com',  password: 'Mesero123!', rol: Rol.MESERO },
    { nombre: 'Juan Cocinero',   email: 'cocina@polleria.com',  password: 'Cocina123!', rol: Rol.COCINERO },
    { nombre: 'María Cajera',    email: 'caja@polleria.com',    password: 'Caja123!',   rol: Rol.CAJERO },
  ];

  for (const u of usuarios) {
    const hash = await bcrypt.hash(u.password, 10);
    await prisma.usuario.create({
      data: {
        nombre: u.nombre,
        email: u.email,
        passwordHash: hash,
        rol: u.rol,
        restauranteId: restaurante.id,
      },
    });
    console.log(`   👤 ${u.nombre} (${u.rol}) — ${u.email} / ${u.password}`);
  }

  // ── Mesas ─────────────────────────────────────────────────────────────
  const capacidades = [2, 2, 4, 4, 4, 4, 4, 4, 6, 6, 6, 8];
  for (let i = 1; i <= 12; i++) {
    await prisma.mesa.create({
      data: {
        id: `mesa-${i}`,
        numero: i,
        capacidad: capacidades[i - 1],
        estado: EstadoMesa.LIBRE,
        restauranteId: restaurante.id,
      },
    });
  }
  console.log('✅ 12 mesas creadas (cap: 2×2, 6×4, 3×6, 1×8)');

  // ── Categorías ────────────────────────────────────────────────────────
  const cats = [
    { id: 'cat-sopas', nombre: 'Супы' },
    { id: 'cat-pollos', nombre: 'Горячие блюда' },
    { id: 'cat-combos', nombre: 'Бизнес-ланч и сеты' },
    { id: 'cat-acompanamientos', nombre: 'Гарниры и салаты' },
    { id: 'cat-postres', nombre: 'Выпечка и десерты' },
    { id: 'cat-bebidas', nombre: 'Напитки' },
    { id: 'cat-extras', nombre: 'Соусы и добавки' },
  ];

  for (const c of cats) {
    await prisma.categoria.create({
      data: { ...c, restauranteId: restaurante.id },
    });
  }
  console.log(`✅ ${cats.length} categorías creadas`);

  // ── Productos ─────────────────────────────────────────────────────────
  const productos = [
    { id: 'prod-borsch', nombre: 'Борщ со сметаной', precio: 1500.00, cat: 'cat-sopas', requiereCocina: true, desc: 'Борщ с говядиной, сметана и зелень' },
    { id: 'prod-lagman', nombre: 'Лагман', precio: 1800.00, cat: 'cat-sopas', requiereCocina: true, desc: 'Суп с лапшой, говядиной и овощами' },
    { id: 'prod-solyanka', nombre: 'Солянка мясная', precio: 1900.00, cat: 'cat-sopas', requiereCocina: true, desc: 'Сборная мясная солянка с лимоном и маслинами' },
    { id: 'prod-bulyon', nombre: 'Куриный бульон с лапшой', precio: 1200.00, cat: 'cat-sopas', requiereCocina: true, desc: 'Домашний бульон, лапша, яйцо' },
    { id: 'prod-shorpa', nombre: 'Шурпа', precio: 2200.00, cat: 'cat-sopas', requiereCocina: true, desc: 'Наваристый суп из баранины с овощами' },
    { id: 'prod-pollo-entero', nombre: 'Бешбармак', precio: 3500.00, cat: 'cat-pollos', requiereCocina: true, desc: 'Конина/говядина, пласты теста, лук, наваристый бульон' },
    { id: 'prod-medio-pollo', nombre: 'Плов по-узбекски', precio: 2200.00, cat: 'cat-pollos', requiereCocina: true, desc: 'Рис, говядина, морковь, нут, чеснок' },
    { id: 'prod-cuarto-pollo', nombre: 'Котлета по-киевски с пюре', precio: 2400.00, cat: 'cat-pollos', requiereCocina: true, desc: 'Куриная котлета со сливочным маслом и картофельным пюре' },
    { id: 'prod-octavo-pollo', nombre: 'Шашлык из курицы (шампур)', precio: 1800.00, cat: 'cat-pollos', requiereCocina: true, desc: 'Шампур маринованной курицы с луком' },
    { id: 'prod-pelmeni', nombre: 'Пельмени со сметаной', precio: 1900.00, cat: 'cat-pollos', requiereCocina: true, desc: 'Домашние пельмени, 12 шт.' },
    { id: 'prod-manty', nombre: 'Манты (5 шт.)', precio: 2200.00, cat: 'cat-pollos', requiereCocina: true, desc: 'Манты с мясом и луком, на пару' },
    { id: 'prod-golubtsy', nombre: 'Голубцы со сметаной', precio: 1900.00, cat: 'cat-pollos', requiereCocina: true, desc: 'Капустные голубцы с мясом и рисом' },
    { id: 'prod-stroganov', nombre: 'Бефстроганов с гречкой', precio: 2600.00, cat: 'cat-pollos', requiereCocina: true, desc: 'Говядина в сливочном соусе, гречневая каша' },
    { id: 'prod-combo-personal', nombre: 'Бизнес-ланч «Классический»', precio: 3200.00, cat: 'cat-combos', requiereCocina: true, desc: 'Салат + суп дня + горячее + компот' },
    { id: 'prod-combo-duo', nombre: 'Сет «Дуэт»', precio: 4500.00, cat: 'cat-combos', requiereCocina: true, desc: 'Пельмени + салат + 2 компота' },
    { id: 'prod-combo-familiar', nombre: 'Сет «Семейный»', precio: 9500.00, cat: 'cat-combos', requiereCocina: true, desc: 'Бешбармак + салат + выпечка + 4 напитка' },
    { id: 'prod-combo-broaster', nombre: 'Бизнес-ланч «Лёгкий»', precio: 2400.00, cat: 'cat-combos', requiereCocina: true, desc: 'Суп дня + салат + хлеб + чай' },
    { id: 'prod-combo-broaster2', nombre: 'Сет «Праздничный»', precio: 7800.00, cat: 'cat-combos', requiereCocina: true, desc: 'Плов + шашлык + салат + 4 компота' },
    { id: 'prod-papas-fritas', nombre: 'Картофель фри', precio: 900.00, cat: 'cat-acompanamientos', requiereCocina: true, desc: 'Порция хрустящего картофеля фри' },
    { id: 'prod-yuca-frita', nombre: 'Картофельное пюре', precio: 800.00, cat: 'cat-acompanamientos', requiereCocina: true, desc: 'Нежное пюре со сливочным маслом' },
    { id: 'prod-ensalada', nombre: 'Салат «Оливье»', precio: 900.00, cat: 'cat-acompanamientos', requiereCocina: true, desc: 'Классический салат с колбасой и горошком' },
    { id: 'prod-arroz', nombre: 'Гречка отварная', precio: 500.00, cat: 'cat-acompanamientos', requiereCocina: true, desc: 'Порция рассыпчатой гречки' },
    { id: 'prod-chaufa-arroz', nombre: 'Макароны по-флотски', precio: 800.00, cat: 'cat-acompanamientos', requiereCocina: true, desc: 'Макароны с мясным фаршем и луком' },
    { id: 'prod-vinegret', nombre: 'Винегрет', precio: 800.00, cat: 'cat-acompanamientos', requiereCocina: true, desc: 'Свёкла, картофель, морковь, солёный огурец' },
    { id: 'prod-caesar', nombre: 'Салат «Цезарь»', precio: 1800.00, cat: 'cat-acompanamientos', requiereCocina: true, desc: 'Курица, романо, пармезан, сухарики' },
    { id: 'prod-shuba', nombre: 'Селёдка под шубой', precio: 1000.00, cat: 'cat-acompanamientos', requiereCocina: true, desc: 'Слоёный салат с сельдью и свёклой' },
    { id: 'prod-hleb', nombre: 'Хлеб / лепёшка', precio: 100.00, cat: 'cat-acompanamientos', requiereCocina: false, desc: 'Порция хлеба или горячей лепёшки' },
    { id: 'prod-samsa', nombre: 'Самса с говядиной', precio: 700.00, cat: 'cat-postres', requiereCocina: true, desc: 'Слоёная самса из тандыра' },
    { id: 'prod-blini', nombre: 'Блины с творогом', precio: 1100.00, cat: 'cat-postres', requiereCocina: true, desc: '3 блина со сладким творогом и сметаной' },
    { id: 'prod-syrniki', nombre: 'Сырники со сметаной', precio: 1200.00, cat: 'cat-postres', requiereCocina: true, desc: 'Творожные сырники, 3 шт.' },
    { id: 'prod-napoleon', nombre: 'Торт «Наполеон» (кусок)', precio: 1100.00, cat: 'cat-postres', requiereCocina: false, desc: 'Слоёный торт с заварным кремом' },
    { id: 'prod-chak-chak', nombre: 'Чак-чак', precio: 800.00, cat: 'cat-postres', requiereCocina: false, desc: 'Восточная сладость с мёдом' },
    { id: 'prod-baursaki', nombre: 'Баурсаки (порция)', precio: 600.00, cat: 'cat-postres', requiereCocina: true, desc: 'Жареные пышки к чаю' },
    { id: 'prod-coca-personal', nombre: 'Coca-Cola 0,5 л', precio: 700.00, cat: 'cat-bebidas', requiereCocina: false, desc: '500 мл' },
    { id: 'prod-coca-grande', nombre: 'Coca-Cola 1,5 л', precio: 1300.00, cat: 'cat-bebidas', requiereCocina: false, desc: '1,5 литра' },
    { id: 'prod-inca-personal', nombre: 'Pepsi 0,5 л', precio: 700.00, cat: 'cat-bebidas', requiereCocina: false, desc: '500 мл' },
    { id: 'prod-inca-grande', nombre: 'Pepsi 1,5 л', precio: 1300.00, cat: 'cat-bebidas', requiereCocina: false, desc: '1,5 литра' },
    { id: 'prod-agua', nombre: 'Вода минеральная 0,5 л', precio: 400.00, cat: 'cat-bebidas', requiereCocina: false, desc: 'Газированная или негазированная' },
    { id: 'prod-limonada', nombre: 'Лимонад домашний', precio: 900.00, cat: 'cat-bebidas', requiereCocina: false, desc: 'Большой стакан со льдом' },
    { id: 'prod-chicha', nombre: 'Морс клюквенный', precio: 600.00, cat: 'cat-bebidas', requiereCocina: false, desc: 'Большой стакан' },
    { id: 'prod-kompot', nombre: 'Компот из сухофруктов', precio: 400.00, cat: 'cat-bebidas', requiereCocina: false, desc: 'Стакан 250 мл' },
    { id: 'prod-chai-black', nombre: 'Чай чёрный (чайник)', precio: 600.00, cat: 'cat-bebidas', requiereCocina: false, desc: 'Чайник 500 мл с лимоном' },
    { id: 'prod-chai-green', nombre: 'Чай зелёный (чайник)', precio: 600.00, cat: 'cat-bebidas', requiereCocina: false, desc: 'Чайник 500 мл' },
    { id: 'prod-coffee', nombre: 'Кофе американо', precio: 900.00, cat: 'cat-bebidas', requiereCocina: false, desc: '200 мл' },
    { id: 'prod-ayran', nombre: 'Айран', precio: 500.00, cat: 'cat-bebidas', requiereCocina: false, desc: 'Стакан 300 мл' },
    { id: 'prod-kvas', nombre: 'Квас', precio: 500.00, cat: 'cat-bebidas', requiereCocina: false, desc: 'Стакан 300 мл' },
    { id: 'prod-ketchup', nombre: 'Кетчуп', precio: 100.00, cat: 'cat-extras', requiereCocina: false },
    { id: 'prod-mayonesa', nombre: 'Майонез', precio: 100.00, cat: 'cat-extras', requiereCocina: false },
    { id: 'prod-aji-verde', nombre: 'Сметана', precio: 250.00, cat: 'cat-extras', requiereCocina: false, desc: 'Порция сметаны' },
    { id: 'prod-salsa-criolla', nombre: 'Аджика', precio: 200.00, cat: 'cat-extras', requiereCocina: false, desc: 'Порция аджики' },
    { id: 'prod-salsa-huancaina', nombre: 'Соус чесночный', precio: 300.00, cat: 'cat-extras', requiereCocina: false, desc: 'Порция чесночного соуса' },
  ];

  for (const p of productos) {
    await prisma.producto.create({
      data: {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.desc ?? null,
        precio: p.precio,
        disponible: true,
        requiereCocina: p.requiereCocina,
        categoriaId: p.cat,
        restauranteId: restaurante.id,
      },
    });
  }
  console.log(`✅ ${productos.length} productos creados`);

  // ── Insumos ───────────────────────────────────────────────────────────
  const insumos = [
    { nombre: 'Курица целая',      categoria: 'Мясо',      unidad: 'шт', stockActual: 30, stockMinimo: 10 },
    { nombre: 'Картофель',             categoria: 'Овощи',    unidad: 'кг',   stockActual: 25, stockMinimo: 10 },
    { nombre: 'Салат латук',           categoria: 'Овощи',    unidad: 'кг',   stockActual: 3,  stockMinimo: 2  },
    { nombre: 'Помидоры',            categoria: 'Овощи',    unidad: 'кг',   stockActual: 4,  stockMinimo: 2  },
    { nombre: 'Древесный уголь',            categoria: 'Топливо', unidad: 'кг',   stockActual: 50, stockMinimo: 20 },
    { nombre: 'Растительное масло',    categoria: 'Масла',     unidad: 'л',    stockActual: 10, stockMinimo: 4  },
    { nombre: 'Соль',               categoria: 'Специи', unidad: 'кг',   stockActual: 5,  stockMinimo: 2  },
    { nombre: 'Приправа для курицы', categoria: 'Специи', unidad: 'кг', stockActual: 2,  stockMinimo: 1  },
    { nombre: 'Лимон',             categoria: 'Овощи',    unidad: 'кг',   stockActual: 3,  stockMinimo: 2  },
    { nombre: 'Огурцы',          categoria: 'Овощи',     unidad: 'кг',   stockActual: 0,  stockMinimo: 3  },
    { nombre: 'Томатная паста',  categoria: 'Консервы',  unidad: 'кг',   stockActual: 0,  stockMinimo: 2  },
    { nombre: 'Кетчуп',          categoria: 'Соусы',     unidad: 'кг',   stockActual: 0,  stockMinimo: 2  },
    { nombre: 'Майонез',         categoria: 'Соусы',     unidad: 'кг',   stockActual: 0,  stockMinimo: 2  },
  ];

  for (const ins of insumos) {
    await prisma.insumo.create({
      data: {
        id: `insumo-${ins.nombre.toLowerCase().replace(/ /g, '-')}`,
        ...ins,
        restauranteId: restaurante.id,
      },
    });
  }
  console.log(`✅ ${insumos.length} insumos cargados`);

  await sembrarRecetas(prisma, restaurante.id);

  console.log('\n🎉 ¡Base de datos lista!\n');
  console.log('📋 ACCESOS:');
  console.log('   Владелец: owner@polleria.com   / Owner123!');
  console.log('   Admin:    admin@polleria.com   / Admin123!');
  console.log('   Mesero:   mesero@polleria.com  / Mesero123!');
  console.log('   Cocinero: cocina@polleria.com  / Cocina123!');
  console.log('   Cajero:   caja@polleria.com    / Caja123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
