export default {
  content: [
    "./index.html",
    "./App.js",
    "./components/**/*.{js,jsx}",
    "./main.jsx"
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui'],
        'mono': ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      colors: {
        'aviator-red': '#e40539',
        'dark-bg': '#111827',
        'dark-surface': '#1f2937',
        'dark-border': '#374151',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'float': 'float 3s ease-in-out infinite alternate',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite alternate',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow-pulse': {
          'from': { 'box-shadow': '0 0 20px -10px currentColor' },
          'to': { 'box-shadow': '0 0 30px -5px currentColor' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(circle, var(--tw-gradient-stops))',
      },
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      minHeight: {
        'screen-safe': '100dvh',
      },
      maxWidth: {
        'mobile': '428px',
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(228, 5, 57, 0.5)',
        'glow-yellow': '0 0 20px rgba(251, 191, 36, 0.5)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.5)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.5)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.5)',
      },
    },
  },
  plugins: [],
}
