import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthInitializer } from './components/AuthInitializer';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './index.css';
import { initSounds } from './sound';

initSounds();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInitializer>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'rgb(var(--card))',
                color: 'rgb(var(--foreground))',
                border: '1px solid rgb(var(--border))',
                borderRadius: '8px',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: 'rgb(var(--success))', secondary: 'rgb(var(--success-bg))' } },
              error:   { iconTheme: { primary: 'rgb(var(--error))', secondary: 'rgb(var(--error-bg))' } },
            }}
          />
        </AuthInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
