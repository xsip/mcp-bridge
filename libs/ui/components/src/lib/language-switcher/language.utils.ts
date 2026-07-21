import { TranslateService } from '@ngx-translate/core';

/**
 * Utility functions for language selection, mirroring the persisted-toggle
 * pattern in `../dark-mode-toggle/theme.utils.ts`.
 */

const LANG_STORAGE_KEY = 'mcp-bridge.lang';

export type SupportedLang = 'en' | 'de';

export const SUPPORTED_LANGS: SupportedLang[] = ['en', 'de'];

const DEFAULT_LANG: SupportedLang = 'en';

function isSupportedLang(value: string | null): value is SupportedLang {
  return value !== null && (SUPPORTED_LANGS as string[]).includes(value);
}

/** Reads the stored language preference from localStorage. Defaults to English. */
export function readStoredLang(): SupportedLang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return isSupportedLang(stored) ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/** Switches ngx-translate to the given language immediately and persists the choice. */
export function applyLang(translate: TranslateService, lang: SupportedLang): void {
  translate.use(lang);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}
