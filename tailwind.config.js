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
        'primary': 'var(--primary-color)',
        'primary-hover': 'var(--primary-hover-color)',
        'text-main': 'var(--text-color)',
        'text-subtle': 'var(--subtle-text-color)',
        'background': 'var(--background-color)',
        'content': 'var(--content-bg)',
        'border-color': 'var(--border-color)',
        'danger': 'var(--danger-color)',
        'success': 'var(--success-color)',
        'warning': 'var(--warning-color)',
        'sidebar-text': 'var(--sidebar-text)',
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
