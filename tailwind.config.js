/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'card-border': 'var(--card-border)',
        'input-bg': 'var(--input-bg)',
        'input-border': 'var(--input-border)',
        'input-text': 'var(--input-text)',
        'input-placeholder': 'var(--input-placeholder)',
        'text-primary': 'var(--text-primary)',
        'text-muted': 'var(--text-muted)',
        primary: 'var(--text-primary)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'focus-ring': 'var(--focus-ring)',
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc5fb',
          400: '#38a5f6',
          500: '#0e87ea',
          600: '#026bc7',
          700: '#0355a1',
          800: '#074884',
          900: '#0c3d6e',
          950: '#082749',
        },
      },
      boxShadow: {
        'soft-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
