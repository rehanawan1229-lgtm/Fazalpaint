import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Warm espresso — primary text + occasional dark grounding surfaces
        'bg-dark': '#4A3527',
        primary: '#4A3527',
        'primary-light': '#5C4433',
        secondary: '#3D2818',
        // Backgrounds & surfaces — warm cream, never stark white
        'bg-light': '#FFF9F4',
        surface: '#FFFFFF',
        'surface-alt': '#FFF1E6',
        border: '#F3E4D4',
        // Accent — soft coral/terracotta (paint swatch)
        accent: '#C94A2E',
        'accent-soft': '#E8724C',
        'accent-strong': '#C94A2E',
        'accent-hover': '#A83D24',
        // Gold — warm, cheerful secondary accent
        gold: '#F5B942',
        'gold-dark': '#C99530',
        // Text
        'text-primary': '#4A3527',
        'text-secondary': '#8A7A6D',
        'text-muted': '#B5A594',
        // Sage mint — trust/success
        success: '#4E9C79',
        'success-light': '#EAF6F0',
        error: '#D64545',
        'error-light': '#FCEBEA'
      },
      fontFamily: {
        heading: ['Sora', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      },
      boxShadow: {
        soft: '0 12px 34px rgba(74, 53, 39, 0.10)',
        lift: '0 20px 45px rgba(74, 53, 39, 0.16)',
        glow: '0 0 0 4px rgba(201, 74, 46, 0.12)'
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.55 }
        },
        popIn: {
          '0%': { transform: 'scale(0.4)', opacity: 0 },
          '60%': { transform: 'scale(1.15)', opacity: 1 },
          '100%': { transform: 'scale(1)', opacity: 1 }
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 }
        },
        modalPop: {
          '0%': { transform: 'scale(0.95)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 }
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(24px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        },
        bounceCart: {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '30%': { transform: 'scale(1.35) rotate(-8deg)' },
          '55%': { transform: 'scale(0.92) rotate(6deg)' },
          '75%': { transform: 'scale(1.08) rotate(-2deg)' }
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        accordionDown: {
          '0%': { height: '0', opacity: 0 },
          '100%': { height: 'var(--radix-accordion-content-height, auto)', opacity: 1 }
        }
      },
      animation: {
        'pulse-soft': 'pulseSoft 1.4s ease-in-out infinite',
        'pop-in': 'popIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-in-right': 'slideInRight 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'modal-pop': 'modalPop 0.22s ease-out forwards',
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'bounce-cart': 'bounceCart 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'float-slow': 'floatSlow 5s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
