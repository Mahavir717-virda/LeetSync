/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/popup/**/*.{tsx,ts,html}',
    './src/popup/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // LeetSync Design Tokens
        'bg-primary':   '#0D1117',
        'bg-secondary': '#161B22',
        'bg-tertiary':  '#21262D',
        'bg-hover':     '#30363D',
        border:         '#30363D',
        'text-primary':   '#F0F6FC',
        'text-secondary': '#8B949E',
        'text-muted':     '#484F58',
        accent: {
          blue:    '#3B82F6',
          emerald: '#10B981',
          red:     '#EF4444',
          yellow:  '#F59E0B',
          purple:  '#8B5CF6',
        },
        difficulty: {
          easy:   '#10B981',
          medium: '#F59E0B',
          hard:   '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'slide-in-left':  'slideInLeft 0.2s ease-out',
        'slide-up':   'slideUp 0.2s ease-out',
        'badge-pop':  'badgePop 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        'ring-pulse': 'ringPulse 0.8s ease-out forwards',
        'particle':   'particle 0.7s ease-out forwards',
        'draw-check': 'drawCheck 0.4s ease-out forwards',
        'toast-in':   'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        'toast-out':  'toastOut 0.2s ease-in forwards',
        'progress':   'progressFill 1.5s ease-in-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'skeleton':   'skeleton 1.5s ease-in-out infinite',
        'spin-slow':  'spin 1s linear infinite',
        'timer-bar':  'timerBar 3s linear forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        badgePop: {
          '0%':   { transform: 'scale(0)',    opacity: '0' },
          '60%':  { transform: 'scale(1.2)',  opacity: '1' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        ringPulse: {
          '0%':   { transform: 'scale(1)',    opacity: '0.4' },
          '100%': { transform: 'scale(2.8)', opacity: '0' },
        },
        particle: {
          '0%':   { transform: 'translate(0,0) scale(1)',   opacity: '1' },
          '100%': { transform: 'var(--tx,0) var(--ty,0) scale(0)', opacity: '0' },
        },
        drawCheck: {
          from: { strokeDashoffset: '60' },
          to:   { strokeDashoffset: '0' },
        },
        toastIn: {
          from: { opacity: '0', transform: 'translateY(-12px) scale(0.95)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        toastOut: {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to:   { opacity: '0', transform: 'translateY(-8px) scale(0.95)' },
        },
        progressFill: {
          from: { width: '0%' },
        },
        skeleton: {
          '0%,100%': { opacity: '0.4' },
          '50%':     { opacity: '0.8' },
        },
        timerBar: {
          from: { width: '100%' },
          to:   { width: '0%' },
        },
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      boxShadow: {
        'emerald-glow': '0 0 12px rgba(16, 185, 129, 0.3)',
        'blue-glow':    '0 0 12px rgba(59, 130, 246, 0.3)',
        'card':         '0 1px 3px rgba(0,0,0,0.4)',
        'modal':        '0 8px 32px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
