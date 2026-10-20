import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// ──────── Refresh token con queue para evitar dobles refreshes ────────
let isRefreshing = false;
let waiters: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function flushWaiters(error: unknown, token: string | null) {
  waiters.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else       resolve(token!);
  });
  waiters = [];
}

// Adjunta token en cada request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Maneja 401: intenta refresh y reintenta UNA vez
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    // No es 401 o no hay config → propagamos
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    // No reintentamos los endpoints de auth (evita loops)
    const url = original.url ?? '';
    if (url.includes('/auth/refresh') || url.includes('/auth/login')) {
      return Promise.reject(error);
    }

    // Si ya hay un refresh en vuelo, esperamos su resultado
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waiters.push({
          resolve: (token) => {
            original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
            original._retry  = true;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing    = true;

    try {
      const { data } = await axios.post(
        '/api/auth/refresh',
        {},
        { withCredentials: true, timeout: 8000 },
      );

      const auth = useAuthStore.getState();
      if (data.user) auth.setAuth(data.user, data.accessToken);
      else           auth.setToken(data.accessToken);

      flushWaiters(null, data.accessToken);

      original.headers = { ...original.headers, Authorization: `Bearer ${data.accessToken}` };
      return api(original);
    } catch (err) {
      flushWaiters(err, null);
      // Sesión perdida — limpiamos y dejamos que React Router redirija
      useAuthStore.getState().logout();
      // Si no estamos ya en login, redirigimos suavemente
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.replace('/login');
      }
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);
