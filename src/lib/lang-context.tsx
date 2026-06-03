"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, type Lang, type T } from "./i18n";

interface LangCtx {
  lang: Lang;
  t: T;
  toggle: () => void;
}

const LangContext = createContext<LangCtx>({
  lang: "zh",
  t: translations.zh,
  toggle: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("ai-dashboard-lang") as Lang | null;
    if (saved === "en" || saved === "zh") setLang(saved);
  }, []);

  function toggle() {
    const next: Lang = lang === "zh" ? "en" : "zh";
    setLang(next);
    localStorage.setItem("ai-dashboard-lang", next);
  }

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], toggle }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
