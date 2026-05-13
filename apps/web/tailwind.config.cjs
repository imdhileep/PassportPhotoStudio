module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "system-ui"],
        body: ["Inter", "ui-sans-serif", "system-ui"]
      },
      colors: {
        /* Brand indigo — remapped from sky-blue so existing "ocean" classNames get the new look */
        ocean: "#6366f1",
        /* Surface levels */
        night: "#07070f",
        surface: "#0d0d1a",
        elevated: "#121226",
        /* Semantic */
        flame: "#ef4444",
        gold: "#f59e0b",
        /* Alias shades used in ToolApp */
        ink: "#0f172a",
        mist: "#e2e8f0",
        sky: "#eef2ff"
      },
      boxShadow: {
        brand: "0 0 20px rgba(99, 102, 241, 0.35)",
        "brand-sm": "0 0 10px rgba(99, 102, 241, 0.25)",
        card: "0 24px 64px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)"
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)",
        "amber-gradient": "linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)",
        "surface-gradient": "linear-gradient(155deg, rgba(18,18,38,0.94), rgba(10,10,22,0.88))"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 16px rgba(99,102,241,0.3)" },
          "50%": { boxShadow: "0 0 28px rgba(99,102,241,0.5)" }
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
