export type UILanguage = "en" | "fr" | "ar";

export declare function getLanguageDirection(lang: UILanguage): "ltr" | "rtl";
export declare function loadUILanguage(): UILanguage;
export declare function saveUILanguage(lang: UILanguage): void;

export interface TranslationBundle {
  searchOrCommand: string;
  importPdf: string;
  doiArxiv: string;
  library: string;
  allPapers: string;
  inbox: string;
  reading: string;
  important: string;
  collections: string;
  newCollectionPlaceholder: string;
  clickPlusCollections: string;
  openTabs: string;
  outline: string;
  highlights: string;
  notes: string;
  ai: string;
  exportMd: string;
  exportBib: string;
  openPdfOutlineHint: string;
  noOutlineHint: string;
  openPdfHighlightsHint: string;
  openPdfNotesHint: string;
  openPdfAiHint: string;
  onboardingTitle: string;
  onboardingSubtitle: string;
  chooseLanguage: string;
  chooseAiMode: string;
  freeAiOption: string;
  freeAiDesc: string;
  paidAiOption: string;
  paidAiDesc: string;
  univAiOption: string;
  univAiDesc: string;
  localAiOption: string;
  localAiDesc: string;
  noAiOption: string;
  noAiDesc: string;
  lowRamWarning: string;
  finishSetup: string;
  langBadge: string;
}

export declare const TRANSLATIONS: Record<UILanguage, TranslationBundle>;
