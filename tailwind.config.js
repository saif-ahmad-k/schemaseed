/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: '#090a0d',
        panel: '#10131a',
        'panel-2': '#171b24',
        line: '#ffffff14',
        amber: '#e4a24a',
        foam: '#e7e1d6',
        mist: '#9aa3b5',
        danger: '#ff8d7a',
      },
    },
  },
  plugins: [],
}
