import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* ── Colores accesibles para daltonismo deuteranopia/protanopia ───
       *  success → cyan   (#22D3EE)  — nunca confundible con error
       *  error   → magenta (#F472B6) — no depende del canal verde
       *  warning → ámbar  (#FBBF24) — visible para todos los tipos
       *  info    → azul   (#60A5FA)
       *  primary → naranja (#E8590C) — acento de marca
       * ────────────────────────────────────────────────────────────── */
      /* Colores definidos como variables CSS (ver index.css) → tema claro/oscuro */
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        'card-foreground': 'rgb(var(--card-foreground) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--primary-foreground) / <alpha-value>)',
        'primary-soft': 'rgb(var(--primary-soft) / <alpha-value>)',
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        'sidebar-bg': 'rgb(var(--sidebar-bg) / <alpha-value>)',
        'header-bg': 'rgb(var(--header-bg) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        'success-bg': 'rgb(var(--success-bg) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        'warning-bg': 'rgb(var(--warning-bg) / <alpha-value>)',
        error: 'rgb(var(--error) / <alpha-value>)',
        'error-bg': 'rgb(var(--error-bg) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        'info-bg': 'rgb(var(--info-bg) / <alpha-value>)',
      },

      /* ── Fuentes escaladas para baja visión ───────────────────────
       *  Cada tamaño sube ~2px respecto al default de Tailwind.
       *  xs: 13 → sm: 15 → base: 17 → lg: 19 → xl: 21
       *  Esto afecta a TODOS los componentes sin cambiar código.
       * ────────────────────────────────────────────────────────────── */
      fontSize: {
        xs:   ['0.8125rem', { lineHeight: '1.25rem' }],   /* 13px */
        sm:   ['0.9375rem', { lineHeight: '1.5rem'  }],   /* 15px */
        base: ['1.0625rem', { lineHeight: '1.75rem' }],   /* 17px */
        lg:   ['1.1875rem', { lineHeight: '1.875rem'}],   /* 19px */
        xl:   ['1.3125rem', { lineHeight: '2rem'    }],   /* 21px */
        '2xl':['1.5625rem', { lineHeight: '2.25rem' }],   /* 25px */
        '3xl':['1.875rem',  { lineHeight: '2.5rem'  }],   /* 30px */
        '4xl':['2.25rem',   { lineHeight: '3rem'    }],   /* 36px */
      },

      borderRadius: {
        s:    '4px',
        m:    '8px',
        l:    '12px',
        pill: '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
