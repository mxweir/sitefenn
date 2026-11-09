import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Language = "de" | "en";
const storageKey = "sitefenn:language";
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
}>({ language: "de", setLanguage: () => {} });

export function useLanguage() {
  return useContext(LanguageContext).language;
}

export function useTranslation() {
  const language = useLanguage();
  return (german: string, english: string) =>
    language === "en" ? english : german;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem(storageKey) === "en" ? "en" : "de";
    } catch {
      return "de";
    }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "en"
        ? "SiteFenn — Your website companion"
        : "SiteFenn — Dein Website-Begleiter";
    try {
      localStorage.setItem(storageKey, language);
    } catch {
      // The current session still uses the selected language.
    }
  }, [language]);
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function LanguageSwitch() {
  const { language, setLanguage } = useContext(LanguageContext);
  return (
    <span className="language-bar">
      <label htmlFor="sitefenn-language">
        {language === "en" ? "Language" : "Sprache"}
      </label>
      <select
        id="sitefenn-language"
        value={language}
        onChange={(event) =>
          setLanguage(event.target.value === "en" ? "en" : "de")
        }
      >
        <option value="de" lang="de">
          Deutsch
        </option>
        <option value="en" lang="en">
          English
        </option>
      </select>
    </span>
  );
}
