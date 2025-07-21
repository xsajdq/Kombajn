/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './*.html',
    './**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        'primary': 'rgb(var(--primary-color-rgb) / <alpha-value>)',
        'primary-hover': 'rgb(var(--primary-hover-color-rgb) / <alpha-value>)',
        'text-main': 'rgb(var(--text-color-rgb) / <alpha-value>)',
        'text-subtle': 'rgb(var(--subtle-text-color-rgb) / <alpha-value>)',
        'background': 'rgb(var(--background-color-rgb) / <alpha-value>)',
        'content': 'rgb(var(--content-bg-rgb) / <alpha-value>)',
        'border-color': 'rgb(var(--border-color-rgb) / <alpha-value>)',
        'danger': 'rgb(var(--danger-color-rgb) / <alpha-value>)',
        'success': 'rgb(var(--success-color-rgb) / <alpha-value>)',
        'warning': 'rgb(var(--warning-color-rgb) / <alpha-value>)',
        'sidebar-text': 'rgb(var(--sidebar-text-rgb) / <alpha-value>)',
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
  plugins: [],
}
