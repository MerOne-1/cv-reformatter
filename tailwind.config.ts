import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        'background-elevated': 'hsl(var(--background-elevated))',
        foreground: 'hsl(var(--foreground))',
        'foreground-muted': 'hsl(var(--foreground-muted))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
          hover: 'hsl(var(--card-hover))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        'border-subtle': 'hsl(var(--border-subtle))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Brand colors
        dreamit: {
          DEFAULT: 'hsl(var(--dreamit))',
          glow: 'hsl(var(--dreamit-glow))',
          subtle: 'hsl(var(--dreamit-subtle))',
        },
        rupturae: {
          DEFAULT: 'hsl(var(--rupturae))',
          glow: 'hsl(var(--rupturae-glow))',
          subtle: 'hsl(var(--rupturae-subtle))',
        },
        // Status colors
        success: {
          DEFAULT: 'hsl(var(--success))',
          glow: 'hsl(var(--success-glow))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          glow: 'hsl(var(--warning-glow))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          glow: 'hsl(var(--info-glow))',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(0, 0, 0, 0.15), 0 4px 16px -4px rgba(0, 0, 0, 0.2)',
        glow: '0 0 20px -5px',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
        elevated: '0 8px 32px -8px rgba(0, 0, 0, 0.4), 0 4px 16px -4px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'shimmer': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
        'slide-in-left': 'slide-in-left 0.3s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.2s ease-out forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 3s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
