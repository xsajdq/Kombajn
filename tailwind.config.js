/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './*.ts',
    './components/**/*.ts',
    './pages/**/*.ts',
    './handlers/**/*.ts',
    './listeners/**/*.ts',
    './services/**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        'primary': 'rgba(var(--primary-color-rgb), <alpha-value>)',
        'primary-hover': 'rgba(var(--primary-hover-color-rgb), <alpha-value>)',
        'text-main': 'rgba(var(--text-color-rgb), <alpha-value>)',
        'text-subtle': 'rgba(var(--subtle-text-color-rgb), <alpha-value>)',
        'background': 'rgba(var(--background-color-rgb), <alpha-value>)',
        'content': 'rgba(var(--content-bg-rgb), <alpha-value>)',
        'border-color': 'rgba(var(--border-color-rgb), <alpha-value>)',
        'danger': 'rgba(var(--danger-color-rgb), <alpha-value>)',
        'success': 'rgba(var(--success-color-rgb), <alpha-value>)',
        'warning': 'rgba(var(--warning-color-rgb), <alpha-value>)',
        'sidebar-text': 'rgba(var(--sidebar-text-rgb), <alpha-value>)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '8px',
        md: '6px',
        sm: '4px',
        full: '9999px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}