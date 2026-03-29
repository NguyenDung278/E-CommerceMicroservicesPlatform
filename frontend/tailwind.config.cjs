/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        nd: {
          surface: "#fbf9f4",
          ink: "#1b1c19",
          forest: "#061b0e",
          pine: "#1b3022",
          low: "#f5f3ee",
          line: "#e4e2dd",
          muted: "#737973",
          accent: "#d07d63"
        }
      },
      fontFamily: {
        body: ["Inter", "Segoe UI", "sans-serif"],
        display: ["Noto Serif", "Georgia", "serif"]
      },
      boxShadow: {
        editorial: "0 24px 50px rgba(27, 28, 25, 0.08)"
      },
      maxWidth: {
        "screen-2xl": "1536px"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};
