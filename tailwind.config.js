/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx,mdx}",
    "./app/components/**/*.{js,jsx,ts,tsx,mdx}",
    "./app/events/**/*.{js,jsx,ts,tsx,mdx}",
    "./app/[id]/**/*.{js,jsx,ts,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
