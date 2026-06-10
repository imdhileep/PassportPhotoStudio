import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

type PageLayoutProps = {
  title: string;
  children: ReactNode;
};

export default function PageLayout({ title, children }: PageLayoutProps) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-6 py-12 text-slate-800">
        <h1 className="font-display text-4xl text-slate-900">{title}</h1>
        <div className="mt-6 space-y-4 text-sm text-slate-600">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
