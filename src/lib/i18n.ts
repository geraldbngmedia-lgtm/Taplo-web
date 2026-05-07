import en from "@/translations/en.json";
import sv from "@/translations/sv.json";
import type { SupportedLanguage } from "@/types/interview";

const dictionaries = { en, sv };

export type TranslationKey = keyof typeof en;

export function getTranslator(language: SupportedLanguage) {
  const dictionary = dictionaries[language] ?? dictionaries.en;

  return (key: TranslationKey) => dictionary[key] ?? dictionaries.en[key] ?? key;
}

export function languageLabel(language: SupportedLanguage) {
  return language === "sv" ? "Swedish" : "English";
}
