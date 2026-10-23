import {
  BarChart2, ShoppingCart, Truck, Boxes, Landmark, Contact, SlidersHorizontal,
} from 'lucide-react';

export interface SectionPageDef { slug: string; label: string }
export interface SectionGroup {
  slug: string;
  label: string;
  icon: typeof BarChart2;
  pages: SectionPageDef[];
}

/** Разделы back-office: /s/<группа>/<страница>. Страницы пока — заготовки (SeccionPage). */
export const SECTION_GROUPS: SectionGroup[] = [
  {
    slug: 'otchety', label: 'Отчёты', icon: BarChart2,
    pages: [
      { slug: 'statistika-prodazh', label: 'Статистика продаж' },
      { slug: 'smeny', label: 'Смены' },
      { slug: 'kassiry', label: 'Отчёты по кассирам' },
      { slug: 'skidki', label: 'Отчёты по скидкам' },
      { slug: 'konsultanty', label: 'Отчёты по консультантам' },
      { slug: 'dvizhenie-deneg', label: 'Движение денег' },
      { slug: 'pribyli-ubytki', label: 'Прибыли и убытки' },
      { slug: 'abc-analiz', label: 'ABC-анализ' },
      { slug: 'populyarnost', label: 'Отчёт по популярности' },
      { slug: 'polnyy', label: 'Полный отчёт' },
    ],
  },
  {
    slug: 'prodazhi', label: 'Продажи', icon: ShoppingCart,
    pages: [
      { slug: 'istoriya', label: 'История продаж' },
      { slug: 'otmenennye', label: 'Отменённые товары' },
      { slug: 'vozvrat-pokupatelya', label: 'Возврат покупателя' },
      { slug: 'dolgi', label: 'Долги' },
    ],
  },
  {
    slug: 'zakupki', label: 'Закупки', icon: Truck,
    pages: [
      { slug: 'priemka', label: 'Приёмка' },
      { slug: 'vozvrat-postavshchikam', label: 'Возвраты поставщикам' },
      { slug: 'platezhi', label: 'Платежи' },
    ],
  },
  {
    slug: 'tovary', label: 'Товары', icon: Boxes,
    pages: [
      { slug: 'spisok', label: 'Список товаров' },
      { slug: 'kategorii', label: 'Категории' },
      { slug: 'artikul', label: 'Артикул' },
      { slug: 'bystrye', label: 'Быстрые товары' },
      { slug: 'sklad', label: 'Склад' },
      { slug: 'spisanie', label: 'Списание' },
      { slug: 'oprihodovanie', label: 'Оприходование' },
      { slug: 'inventarizatsiya', label: 'Инвентаризация' },
      { slug: 'peremeshchenie', label: 'Перемещение' },
      { slug: 'aktsii', label: 'Акции' },
    ],
  },
  {
    slug: 'finansy', label: 'Финансы', icon: Landmark,
    pages: [
      { slug: 'obzor-po-schetam', label: 'Обзор по счетам' },
      { slug: 'platezhi', label: 'Платежи' },
      { slug: 'perevody', label: 'Переводы' },
    ],
  },
  {
    slug: 'kontragenty', label: 'Контрагенты', icon: Contact,
    pages: [
      { slug: 'klienty', label: 'Клиенты' },
      { slug: 'postavshchiki', label: 'Поставщики' },
    ],
  },
  {
    slug: 'upravlenie', label: 'Управление', icon: SlidersHorizontal,
    pages: [
      { slug: 'polzovateli', label: 'Пользователи' },
      { slug: 'nastroyki', label: 'Настройки' },
      { slug: 'chek', label: 'Управление чеком' },
      { slug: 'vesy', label: 'Весы' },
      { slug: 'kassy', label: 'Управление кассами' },
      { slug: 'konsultanty', label: 'Консультанты' },
      { slug: 'tipy-raskhodov', label: 'Типы расходов' },
      { slug: 'razresheniya', label: 'Настройки разрешений' },
      { slug: 'spravochnik', label: 'Справочник' },
    ],
  },
];

export const findSection = (grupo?: string, pagina?: string) => {
  const group = SECTION_GROUPS.find((g) => g.slug === grupo);
  const page = group?.pages.find((p) => p.slug === pagina);
  return group && page ? { group, page } : null;
};
