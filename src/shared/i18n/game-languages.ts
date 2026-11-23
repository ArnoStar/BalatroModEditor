// The game's languages (a mod's texts can have a translation for each): the
// game's keys, as its settings and a mod's `loc` name them, and their own names.

export interface GameLanguage { key: string; name: string }

export const GAME_LANGUAGES: GameLanguage[] = [
  { key: 'en-us', name: 'English' },
  { key: 'de', name: 'Deutsch' },
  { key: 'es_419', name: 'Español (América Latina)' },
  { key: 'es_ES', name: 'Español (España)' },
  { key: 'fr', name: 'Français' },
  { key: 'id', name: 'Bahasa Indonesia' },
  { key: 'it', name: 'Italiano' },
  { key: 'ja', name: '日本語' },
  { key: 'ko', name: '한국어' },
  { key: 'nl', name: 'Nederlands' },
  { key: 'pl', name: 'Polski' },
  { key: 'pt_BR', name: 'Português (Brasil)' },
  { key: 'ru', name: 'Русский' },
  { key: 'zh_CN', name: '简体中文' },
  { key: 'zh_TW', name: '繁體中文' },
];
