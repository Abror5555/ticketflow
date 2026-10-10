/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f1ff',
          100: '#e8e1ff',
          500: '#7c5cf5',
          600: '#6644e6',
          700: '#5233c4',
        },
      },
    },
  },
  plugins: [],
};
