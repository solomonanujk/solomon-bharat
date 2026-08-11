import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#F2E6C9',
        'bg-surface': '#F8F1DE',
        border: '#CBB783',
        'text-primary': '#2A2318',
        'text-muted': '#6B5C3F',
        'accent-primary': '#4F6B4A',
        'accent-primary-hover': '#3D5539',
        'accent-secondary': '#A6342C',
        'accent-secondary-hover': '#8A2A23',
        success: '#2F5233',
        error: '#7A2A20',
        gold: '#B8863B',
        'fill-subtle': '#E8D8AE',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      fontSize: {
        display: ['4rem', { lineHeight: '1.1' }],
        hero: ['3.25rem', { lineHeight: '1.15' }],
        h1: ['2.5rem', { lineHeight: '1.2' }],
        h2: ['2rem', { lineHeight: '1.25' }],
        h3: ['1.5rem', { lineHeight: '1.3' }],
        h4: ['1.25rem', { lineHeight: '1.4' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        body: ['1rem', { lineHeight: '1.6' }],
        small: ['0.875rem', { lineHeight: '1.5' }],
        caption: ['0.75rem', { lineHeight: '1.4' }],
      },
      borderRadius: {
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        button: '8px',
        input: '8px',
        card: '4px',
        modal: '6px',
      },
      maxWidth: {
        content: '1280px',
      },
      spacing: {
        'section-mobile': '64px',
        'section-desktop': '120px',
        'margin-mobile': '20px',
        'margin-desktop': '80px',
      },
    },
  },
  plugins: [],
};

export default config;