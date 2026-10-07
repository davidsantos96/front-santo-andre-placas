import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mercosul: { DEFAULT: '#003399', hover: '#002471', claro: '#E8EDF9', faixa: '#EEF2FA', tinta: '#0B2E73', borda: '#0F2C6B', sub: '#B9C8E8' },
        noite: { DEFAULT: '#001B4D', sub: '#B9C3DB' },
        grafite: '#1A1D21',
        aco: { DEFAULT: '#5C6470', 700: '#41474F', 600: '#495159' },
        linha: { DEFAULT: '#E2E5EA', forte: '#D4D8DF', fraca: '#EFF1F4', badge: '#C7CCD4' },
        fundo: '#F4F5F7',
        ok: { DEFAULT: '#1E7F4F', bg: '#E7F3ED' },
        alerta: { DEFAULT: '#B45309', texto: '#8A4B12', bg: '#FBF0E4', bgHover: '#FDF6EC', borda: '#F0DCC0' },
        erro: { DEFAULT: '#B91C1C', bg: '#FBEAEA' },
        grafico: { 1: '#003399', 2: '#4C6EB0', 3: '#7691C8', cartao: '#6B8BC9' }, // 3: escurecido (spec: #93A9D1) p/ contraste ≥ 3:1
      },
      fontFamily: {
        display: ['"Archivo Narrow"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      fontSize: { '2xs': '10.5px', xs: '11.5px', sm: '12.5px', base: '13px', md: '13.5px' },
      boxShadow: { card: '0 1px 3px rgba(0,27,77,0.06)', placa: '0 1px 3px rgba(0,27,77,0.08)' },
      borderRadius: { sm: '4px', DEFAULT: '6px', md: '8px', lg: '10px' },
      keyframes: {
        placaflutua: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: { placaflutua: 'placaflutua 1.6s ease-in-out infinite' },
    },
  },
  plugins: [],
} satisfies Config;
