import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { initApp } from 'lib';
import { App } from './App';
import { config } from './initConfig';

// Create an enhanced dark theme
const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  styles: {
    global: {
      body: {
        bg: 'gray.900',
        color: 'white',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
    },
  },
  fonts: {
    heading: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontWeights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '3.75rem',
  },
  colors: {
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    // Enhanced color palette
    blue: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    purple: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7c3aed',
      800: '#6b21a8',
      900: '#581c87',
    },
    green: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    yellow: {
      50: '#fefce8',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    red: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    // Game-specific colors
    game: {
      tictactoe: '#8b5cf6',
      chess: '#1e40af',
      dodge: '#dc2626',
      colorrush: '#f59e0b',
      cryptobubbles: '#06b6d4',
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'medium',
        borderRadius: 'xl',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        _hover: {
          transform: 'translateY(-1px)',
          boxShadow: 'lg',
        },
        _active: {
          transform: 'translateY(0)',
        },
      },
      variants: {
        solid: {
          _hover: {
            boxShadow: 'xl',
          },
        },
        outline: {
          _hover: {
            bg: 'gray.700',
            borderColor: 'gray.600',
          },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          borderRadius: '2xl',
          border: '1px solid',
          borderColor: 'gray.700',
          bg: 'gray.800',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          _hover: {
            borderColor: 'gray.600',
            boxShadow: 'xl',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    Heading: {
      baseStyle: {
        fontWeight: 'semibold',
        letterSpacing: '-0.025em',
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: 'lg',
        fontWeight: 'medium',
        px: 3,
        py: 1,
      },
    },
  },
});

initApp(config).then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ChakraProvider theme={theme}>
        <App />
      </ChakraProvider>
    </React.StrictMode>
  );
});
