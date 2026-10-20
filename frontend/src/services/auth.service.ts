import { api } from './api';

export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  refresh: () =>
    api.post('/auth/refresh').then((r) => r.data),
  logout: () =>
    api.post('/auth/logout').then((r) => r.data),
};
