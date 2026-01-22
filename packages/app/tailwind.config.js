/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        heading: ['"Press Start 2P"', 'cursive'],
        mono: ['"Space Grotesk"', 'monospace'],
      },
      colors: {
        neon: {
          blue: '#00f3ff',
          pink: '#ff00ff',
          green: '#39ff14',
          purple: '#bf00ff',
          yellow: '#ffff00',
        },
        dark: {
          bg: '#0a0e27',
          card: '#151934',
          border: '#1e2442',
        },
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, #1e2442 1px, transparent 1px), linear-gradient(to bottom, #1e2442 1px, transparent 1px)",
        'neon-gradient': 'linear-gradient(135deg, #00f3ff 0%, #bf00ff 50%, #ff00ff 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(21, 25, 52, 0.9) 0%, rgba(30, 36, 66, 0.9) 100%)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      boxShadow: {
        'neon-blue': '0 0 20px rgba(0, 243, 255, 0.5), 0 0 40px rgba(0, 243, 255, 0.3)',
        'neon-pink': '0 0 20px rgba(255, 0, 255, 0.5), 0 0 40px rgba(255, 0, 255, 0.3)',
        'neon-green': '0 0 20px rgba(57, 255, 20, 0.5), 0 0 40px rgba(57, 255, 20, 0.3)',
        'card': '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'heart-beat': 'heartBeat 0.6s ease-in-out',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'glow': 'glow 2s ease-in-out infinite',
        'slide-in': 'slideIn 0.5s ease-out',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 243, 255, 0.5)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 243, 255, 0.8), 0 0 60px rgba(0, 243, 255, 0.6)' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} 