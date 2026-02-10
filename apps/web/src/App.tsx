import Landing from "./pages/Landing";
import AppShell from "./pages/AppShell";

export default function App() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (path.startsWith("/app")) {
    return <AppShell />;
  }
  return <Landing />;
}
