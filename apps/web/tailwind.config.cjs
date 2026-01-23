module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "ui-sans-serif", "system-ui"],
        body: ["Fraunces", "ui-serif", "Georgia"]
      },
      colors: {
        ink: "#0f172a",
        mist: "#e2e8f0",
        sky: "#cfe0ff",
        night: "#0b1220",
        flame: "#ef4444",
        gold: "#fbbf24",
        ocean: "#0ea5e9"
      }
    }
  },
  plugins: []
};
