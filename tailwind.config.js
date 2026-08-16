/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        ink: "#3D1735",
        paper: "#F7F0E3",
        rust: { DEFAULT: "#C9972B", dark: "#A67C1E" },
        sage: { DEFAULT: "#3F6B5C", dark: "#254238" },
        clay: { DEFAULT: "#B5423A", dark: "#7A2A24" },
        plum: { DEFAULT: "#A83F91", dark: "#832F72" },
        stone: "#8A8677",
        line: "#E4D9C3",
        beige: { 50: "#F7F0E3", 100: "#F1E7D3", 200: "#E4D9C3" },
        gold: { 400: "#DEB847", 500: "#C9972B", 600: "#A67C1E" },
        purple: { 50: "#F7E3F2", 100: "#F0CCE8", 400: "#C25FAF", 500: "#A83F91", 600: "#832F72" },
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(168,63,145,0.08), 0 8px 24px -8px rgba(168,63,145,0.10)",
      },
    },
  },
  plugins: [],
};
