import net from 'net';
import http from 'http';
import { HttpError } from '../idem';

/** Сканировать можно только частные (локальные) сети. */
export function isPrivateSubnet(s: string): boolean {
  return /^(10\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}|192\.168\.\d{1,3})$/.test(s)
    && s.split('.').every((p) => Number(p) <= 255);
}

export function isPrivateHost(h: string): boolean {
  return /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/.test(h)
    && h.split('.').every((p) => Number(p) <= 255);
}

const ALLOWED_PORTS = new Set([9100, 9101, 9102, 515, 631, 80]);
export function assertPort(p: number) {
  if (!ALLOWED_PORTS.has(p)) throw new HttpError(400, 'Puerto no permitido');
}

function tcpOpen(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    const done = (ok: boolean) => { s.destroy(); resolve(ok); };
    s.setTimeout(timeout, () => done(false));
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
  });
}

export interface EstadoImpresora {
  /** Ответил на ESC/POS-запрос статуса — это точно кассовый принтер */
  escpos: boolean;
  enLinea?: boolean;
  papel?: 'ok' | 'poco' | 'sin';
}

/** Запрос статуса в реальном времени (DLE EOT 1 и 4) — принтер ничего не печатает. */
export function probeEstado(host: string, port: number, timeout = 900): Promise<EstadoImpresora> {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    const out: EstadoImpresora = { escpos: false };
    const bytes: number[] = [];
    let step = 0;
    const finish = () => {
      s.destroy();
      if (bytes.length > 0) {
        const b = bytes[0];
        if ((b & 0x93) === 0x12) { out.escpos = true; out.enLinea = (b & 0x08) === 0; }
        if (bytes.length > 1) {
          const p = bytes[1];
          out.papel = p & 0x60 ? 'sin' : p & 0x0c ? 'poco' : 'ok';
        }
      }
      resolve(out);
    };
    s.setTimeout(timeout, finish);
    s.once('error', finish);
    s.once('connect', () => s.write(Buffer.from([0x10, 0x04, 0x01])));
    s.on('data', (d) => {
      bytes.push(d[0]);
      if (step === 0) { step = 1; s.write(Buffer.from([0x10, 0x04, 0x04])); } else finish();
    });
  });
}

/** Заголовок страницы настроек принтера (многие LAN-принтеры отдают её на 80 порту). */
function webTitle(host: string): Promise<string | null> {
  return new Promise((resolve) => {
    const req = http.get({ host, port: 80, path: '/', timeout: 700 }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; if (buf.length > 4096) res.destroy(); });
      res.on('close', () => resolve(/<title[^>]*>([^<]{1,80})<\/title>/i.exec(buf)?.[1]?.trim() ?? null));
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

export interface HostEncontrado { ip: string; puerto: number; estado: EstadoImpresora; web: string | null }

/** Сканирует /24: быстрая проверка порта, затем статус ESC/POS и заголовок веб-страницы у ответивших. */
export async function descubrir(subred: string, puerto = 9100, concurrency = 80, timeout = 450): Promise<{ hosts: HostEncontrado[]; ms: number }> {
  const t0 = Date.now();
  const ips = Array.from({ length: 254 }, (_, i) => `${subred}.${i + 1}`);
  const abiertos: string[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < ips.length) {
      const ip = ips[next++];
      if (await tcpOpen(ip, puerto, timeout)) abiertos.push(ip);
    }
  }));
  const hosts = await Promise.all(abiertos.map(async (ip): Promise<HostEncontrado> => {
    const [estado, web] = await Promise.all([probeEstado(ip, puerto), webTitle(ip)]);
    return { ip, puerto, estado, web };
  }));
  hosts.sort((a, b) => a.ip.split('.').map(Number).reduce((x, y) => x * 256 + y, 0) - b.ip.split('.').map(Number).reduce((x, y) => x * 256 + y, 0));
  return { hosts, ms: Date.now() - t0 };
}

export async function comprobar(host: string, puerto: number): Promise<{ alcanzable: boolean; estado: EstadoImpresora; ms: number }> {
  const t0 = Date.now();
  const alcanzable = await tcpOpen(host, puerto, 1500);
  const estado = alcanzable ? await probeEstado(host, puerto) : { escpos: false };
  return { alcanzable, estado, ms: Date.now() - t0 };
}
