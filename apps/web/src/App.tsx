import { Suspense, lazy, useEffect } from "react";
import Landing from "./pages/Landing";

const AppShell = lazy(() => import("./pages/AppShell"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const Login = lazy(() => import("./pages/Login"));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-white text-slate-800">
    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-4 text-sm backdrop-blur">
      Loading experience...
    </div>
  </div>
);

export default function App() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const canonicalPath = path === "/" ? "" : path;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const href = `https://www.passportphoto.art${canonicalPath}`;
    let link = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [canonicalPath]);

  if (path.startsWith("/app")) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <AppShell />
      </Suspense>
    );
  }
  if (path === "/about") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <About />
      </Suspense>
    );
  }
  if (path === "/contact") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Contact />
      </Suspense>
    );
  }
  if (path === "/privacy-policy") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <PrivacyPolicy />
      </Suspense>
    );
  }
  if (path === "/terms") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Terms />
      </Suspense>
    );
  }
  if (path === "/faq") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <FaqPage />
      </Suspense>
    );
  }
  if (path === "/login") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Login />
      </Suspense>
    );
  }
  return <Landing />;
}
