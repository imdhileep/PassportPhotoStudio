module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // LeepCast uses Geist for everything.
        display: ["Geist", "ui-sans-serif", "system-ui"],
        body: ["Geist", "ui-sans-serif", "system-ui"]
      },
      colors: {
        /* Brand → amber/gold (LeepCast). "ocean" is kept as the brand-token name. */
        ocean: "#f59e0b",
        /* Remap Tailwind's indigo & violet palettes to amber/gold so every existing
           indigo-* / violet-* utility class across the app renders in the LeepCast brand
           without touching each component. */
        indigo: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
          950: "#451a03"
        },
        violet: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
          950: "#451a03"
        },
        /* Surface levels — LeepCast near-black ink / surface */
        night: "#0a0b14",
        surface: "#12131f",
        elevated: "#181a26",
        /* Semantic */
        flame: "#ef4444",
        gold: "#f59e0b",
        /* Alias shades used in ToolApp */
        ink: "#0f172a",
        mist: "#e2e8f0",
        sky: "#eef2ff"
      },
      boxShadow: {
        brand: "0 0 20px rgba(245, 158, 11, 0.35)",
        "brand-sm": "0 0 10px rgba(245, 158, 11, 0.25)",
        card: "0 24px 64px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)"
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)",
        "amber-gradient": "linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)",
        "surface-gradient": "linear-gradient(155deg, rgba(18,19,31,0.94), rgba(10,11,20,0.88))"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 16px rgba(245,158,11,0.3)" },
          "50%": { boxShadow: "0 0 28px rgba(245,158,11,0.5)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
