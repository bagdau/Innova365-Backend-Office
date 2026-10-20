import { create } from 'zustand';
import toast from 'react-hot-toast';

/** Efectos de sonido de la interfaz (archivos en /public/sounds). */
export type SoundName =
  | 'click' | 'open' | 'close' | 'switch' | 'toggle' | 'back'
  | 'success' | 'error' | 'login'
  | 'newOrder' | 'orderPreparing' | 'orderReady' | 'payment';

const FILES: Record<SoundName, { file: string; volume: number; priority: number }> = {
  click:      { file: 'click_003',        volume: 0.35, priority: 0 },
  switch:     { file: 'switch_003',       volume: 0.45, priority: 1 },
  toggle:     { file: 'toggle_002',       volume: 0.45, priority: 1 },
  back:       { file: 'back_001',         volume: 0.45, priority: 1 },
  open:       { file: 'open_001',         volume: 0.45, priority: 1 },
  close:      { file: 'close_001',        volume: 0.45, priority: 1 },
  login:      { file: 'open_002',         volume: 0.5,  priority: 2 },
  success:    { file: 'confirmation_002', volume: 0.55, priority: 2 },
  error:      { file: 'error_004',        volume: 0.55, priority: 2 },
  newOrder:   { file: 'bong_001',         volume: 0.8,  priority: 3 }, // cocina: pedido nuevo
  orderPreparing: { file: 'pluck_001', volume: 0.7, priority: 3 }, // caja/mesero: pedido empezó a prepararse
  orderReady: { file: 'pluck_002',        volume: 0.8,  priority: 3 }, // mesero: pedido listo
  payment:    { file: 'glass_003',        volume: 0.7,  priority: 3 }, // caja: pedido por cobrar
};

const STORAGE_KEY = 'innova365-sound';

interface SoundState {
  enabled: boolean;
  toggle: () => void;
}

export const useSoundStore = create<SoundState>((set, get) => {
  let enabled = true;
  try { enabled = localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { /* ignore */ }
  return {
    enabled,
    toggle: () => {
      const next = !get().enabled;
      try { localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off'); } catch { /* ignore */ }
      set({ enabled: next });
    },
  };
});

const cache = new Map<SoundName, HTMLAudioElement>();
let last: { stop: () => void; priority: number; at: number } | null = null;

// Web Audio: звуки декодируются заранее и стартуют мгновенно (у <audio>.play() задержка 50–150 мс, особенно на слабых моноблоках)
let ctx: AudioContext | null = null;
const buffers = new Map<SoundName, AudioBuffer>();
const loading = new Set<SoundName>();

function audioCtx(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = null; }
  return ctx;
}

function loadBuffer(name: SoundName) {
  const c = audioCtx();
  if (!c || buffers.has(name) || loading.has(name)) return;
  loading.add(name);
  fetch(`/sounds/${FILES[name].file}.ogg`)
    .then((r) => r.arrayBuffer())
    .then((ab) => c.decodeAudioData(ab))
    .then((buf) => { buffers.set(name, buf); })
    .catch(() => { /* останется запасной путь через <audio> */ })
    .finally(() => loading.delete(name));
}

function base(name: SoundName): HTMLAudioElement {
  let a = cache.get(name);
  if (!a) {
    a = new Audio(`/sounds/${FILES[name].file}.ogg`);
    a.preload = 'auto';
    cache.set(name, a);
  }
  return a;
}

export function playSound(name: SoundName) {
  if (!useSoundStore.getState().enabled) return;
  const cfg = FILES[name];
  const now = Date.now();
  // Если звук с большим приоритетом приходит почти одновременно (клик + открытие окна), он заменяет предыдущий
  if (last && now - last.at < 150 && last.priority < cfg.priority) last.stop();
  else if (last && now - last.at < 150 && last.priority > cfg.priority) return;

  const c = ctx;
  const buf = buffers.get(name);
  if (c && buf) {
    if (c.state === 'suspended') void c.resume();
    const src = c.createBufferSource();
    const gain = c.createGain();
    src.buffer = buf; gain.gain.value = cfg.volume;
    src.connect(gain).connect(c.destination);
    src.start(0);
    last = { stop: () => { try { src.stop(); } catch { /* уже закончился */ } }, priority: cfg.priority, at: now };
    return;
  }
  // запасной путь: пока буферы не декодированы
  const audio = base(name).cloneNode(true) as HTMLAudioElement;
  audio.volume = cfg.volume;
  audio.play().catch(() => { /* браузер блокирует звук до первого взаимодействия */ });
  last = { stop: () => audio.pause(), priority: cfg.priority, at: now };
}

const CLICKABLE = 'button, a[href], [role="button"], select, input[type="checkbox"], input[type="radio"], summary';

/** Sonido global de clic: data-sound="switch" elige otro sonido, data-sound="none" lo silencia. */
function onClick(e: MouseEvent) {
  const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(CLICKABLE);
  if (!el) return;
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
  const custom = el.dataset.sound;
  if (custom === 'none') return;
  playSound(custom && custom in FILES ? (custom as SoundName) : 'click');
}

let installed = false;

export function initSounds() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', onClick, true);

  // Sonido en los toasts de exito / error de toda la app
  const origSuccess = toast.success.bind(toast);
  const origError = toast.error.bind(toast);
  toast.success = ((...args: Parameters<typeof toast.success>) => { playSound('success'); return origSuccess(...args); }) as typeof toast.success;
  toast.error = ((...args: Parameters<typeof toast.error>) => { playSound('error'); return origError(...args); }) as typeof toast.error;

  // Precarga tras la primera interaccion
  const preload = () => {
    (Object.keys(FILES) as SoundName[]).forEach(base);
    audioCtx();
    (Object.keys(FILES) as SoundName[]).forEach(loadBuffer);
  };
  document.addEventListener('pointerdown', preload, { once: true });
}
