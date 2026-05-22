/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./emails/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#000000",
        accent: "#1a1a1a",
        "text-secondary": "#666666",
        border: "#E5E5E5",
        success: "#22C55E",
        error: "#EF4444",
        occupied: "#FCA5A5",
        free: "#BBF7D0",
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        sans: ["DM Sans", "Plus Jakarta Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
