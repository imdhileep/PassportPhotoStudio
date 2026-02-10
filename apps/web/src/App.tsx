import Landing from "./pages/Landing";
import AppShell from "./pages/AppShell";
import About from "./pages/About";
import Contact from "./pages/Contact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import FaqPage from "./pages/FaqPage";
import Login from "./pages/Login";

export default function App() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const canonicalPath = path === "/" ? "" : path;
  if (typeof document !== "undefined") {
    const href = `https://www.passportphoto.art${canonicalPath}`;
    let link = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = href;
  }
  if (path.startsWith("/app")) {
    return <AppShell />;
  }
  if (path === "/about") {
    return <About />;
  }
  if (path === "/contact") {
    return <Contact />;
  }
  if (path === "/privacy-policy") {
    return <PrivacyPolicy />;
  }
  if (path === "/terms") {
    return <Terms />;
  }
  if (path === "/faq") {
    return <FaqPage />;
  }
  if (path === "/login") {
    return <Login />;
  }
  return <Landing />;
}
