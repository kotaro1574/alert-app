/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: '#FF9500',
        surface: '#1C1C1E',
        secondary: '#8E8E93',
        border: '#38383A',
        danger: '#FF3B30',
      },
    },
  },
  plugins: [],
};
