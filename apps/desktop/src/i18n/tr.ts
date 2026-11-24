/**
 * UI string catalogue. The English source string is the key, so untranslated
 * strings fall back to readable English. `{name}` placeholders are filled from `vars`.
 *
 * App.tsx calls setTrLanguage(uiLang) at the top of every render, so any component
 * rendered below it reads the current language. Memoised values that call tr()
 * must list the UI language in their dependencies.
 */
import type { UILanguage } from "./translations.mjs";

type Entry = [fr: string, ar: string];

const CATALOG: Record<string, Entry> = {
  // ── App shell / toasts ──────────────────────────────────────────────
  "No local PDF attached yet for this metadata entry — drop or import its PDF.": [
    "Aucun PDF local pour cette fiche — déposez ou importez son PDF.",
    "لا يوجد ملف PDF مرفق بهذه البطاقة بعد — اسحب الملف أو استورده.",
  ],
  "Already in library ({reason}) — opening existing paper.": [
    "Déjà dans la bibliothèque ({reason}) — ouverture de l’article existant.",
    "موجودة مسبقاً في المكتبة ({reason}) — جارٍ فتح الورقة.",
  ],
  "Paper already in library ({reason}).": ["Article déjà dans la bibliothèque ({reason}).", "الورقة موجودة مسبقاً في المكتبة ({reason})."],
  "identical file hash": ["empreinte de fichier identique", "بصمة ملف مطابقة"],
  "Added “{title}” to library.": ["« {title} » ajouté à la bibliothèque.", "أُضيفت «{title}» إلى المكتبة."],
  "Filtered library for [[{title}]]": ["Bibliothèque filtrée pour [[{title}]]", "تمت تصفية المكتبة حسب [[{title}]]"],
  "All Papers": ["Tous les articles", "كل الأوراق"],
  "Inbox (To Read)": ["Boîte de réception (à lire)", "الوارد (للقراءة)"],
  "Currently Reading": ["En cours de lecture", "قيد القراءة حالياً"],
  "Important Papers": ["Articles importants", "أوراق مهمة"],
  Collection: ["Collection", "مجموعة"],
  "Open a paper first to export its Markdown notes.": [
    "Ouvrez d’abord un article pour exporter ses notes Markdown.",
    "افتح ورقة أولاً لتصدير ملاحظاتها بصيغة Markdown.",
  ],
  "Exported {file}": ["{file} exporté", "تم تصدير {file}"],
  "No papers to export to BibTeX.": ["Aucun article à exporter en BibTeX.", "لا توجد أوراق لتصديرها بصيغة BibTeX."],
  "Exported {n} BibTeX entries.": ["{n} entrées BibTeX exportées.", "تم تصدير {n} مدخلات BibTeX."],
  "No valid BibTeX entries found in file.": ["Aucune entrée BibTeX valide dans ce fichier.", "لم يُعثر على مدخلات BibTeX صالحة في الملف."],
  "Imported {added} of {total} BibTeX entries.": ["{added} entrées BibTeX importées sur {total}.", "تم استيراد {added} من أصل {total} مدخلات BibTeX."],
  "Import / Open PDF file…": ["Importer / ouvrir un PDF…", "استيراد / فتح ملف PDF…"],
  "Import paper by DOI or arXiv ID…": ["Importer par DOI ou identifiant arXiv…", "استيراد ورقة عبر DOI أو معرّف arXiv…"],
  "Show Library view": ["Afficher la bibliothèque", "عرض المكتبة"],
  "Configure AI provider (BYOK / Ollama)…": ["Configurer le fournisseur d’IA (clé perso / Ollama)…", "إعداد مزوّد الذكاء الاصطناعي (مفتاحك / Ollama)…"],
  "Switch theme (current: {theme})": ["Changer de thème (actuel : {theme})", "تبديل المظهر (الحالي: {theme})"],
  "Hide Library panel": ["Masquer la bibliothèque", "إخفاء لوحة المكتبة"],
  "Show Library panel": ["Afficher la bibliothèque", "إظهار لوحة المكتبة"],
  "Hide Context panel": ["Masquer le panneau contextuel", "إخفاء اللوحة الجانبية"],
  "Show Context panel": ["Afficher le panneau contextuel", "إظهار اللوحة الجانبية"],
  "Find in current paper": ["Rechercher dans l’article", "البحث في الورقة الحالية"],
  "Disable margin crop": ["Désactiver le rognage des marges", "إيقاف قص الهوامش"],
  "Enable smart margin crop": ["Activer le rognage intelligent", "تفعيل القص الذكي للهوامش"],
  "Toggle Library (Ctrl+[)": ["Bibliothèque (Ctrl+[)", "المكتبة (Ctrl+[)"],
  "Toggle Clean Reading Mode (Ctrl+R)": ["Mode lecture épurée (Ctrl+R)", "وضع القراءة المريحة (Ctrl+R)"],
  "Toggle Split View (Paper + Notes)": ["Vue partagée (article + notes)", "عرض مقسوم (الورقة + الملاحظات)"],
  "Knowledge Graph": ["Graphe de connaissances", "خريطة المعرفة"],
  "Research Projects (Thesis / Paper Workspaces)": ["Projets de recherche (mémoire / article)", "المشاريع البحثية (مذكرة / مقال)"],
  "Import by DOI or arXiv ID": ["Importer par DOI ou arXiv", "استيراد عبر DOI أو arXiv"],
  "Import PDF (Ctrl+O)": ["Importer un PDF (Ctrl+O)", "استيراد PDF (Ctrl+O)"],
  "Switch interface language (EN / FR / العربية)": ["Changer la langue (EN / FR / العربية)", "تغيير لغة الواجهة (EN / FR / العربية)"],
  "AI Settings (BYOK / Ollama)": ["Réglages IA (clé perso / Ollama)", "إعدادات الذكاء الاصطناعي"],
  "Toggle Context panel (Ctrl+])": ["Panneau contextuel (Ctrl+])", "اللوحة الجانبية (Ctrl+])"],
  "Theme: {theme}": ["Thème : {theme}", "المظهر: {theme}"],
  light: ["Clair", "فاتح"],
  sepia: ["Sépia", "دافئ"],
  dark: ["Sombre", "داكن"],
  Reflow: ["Reformaté", "نص منسّق"],
  Split: ["Partager", "تقسيم"],
  Graph: ["Graphe", "الخريطة"],
  "Projects ({n})": ["Projets ({n})", "المشاريع ({n})"],
  Library: ["Bibliothèque", "المكتبة"],
  "New collection": ["Nouvelle collection", "مجموعة جديدة"],
  "Local AI only (confidential)": ["IA locale uniquement (confidentiel)", "ذكاء محلي فقط (سرّي)"],
  "Click to restrict this collection to Local AI only": [
    "Cliquez pour limiter cette collection à l’IA locale",
    "اضغط لقصر هذه المجموعة على الذكاء المحلي فقط",
  ],
  "Close {title}": ["Fermer {title}", "إغلاق {title}"],
  Context: ["Contexte", "السياق"],
  "Downloaded Anki flashcards (.tsv)": ["Cartes Anki téléchargées (.tsv)", "تم تنزيل بطاقات Anki ‏(.tsv)"],
  "Key kept for this session only.": ["Clé conservée pour cette session uniquement.", "سيُحتفظ بالمفتاح لهذه الجلسة فقط."],
  "AI assistant disabled.": ["Assistant IA désactivé.", "تم إيقاف المساعد الذكي."],
  "API key removed.": ["Clé API supprimée.", "تم حذف مفتاح API."],
  "Could not remove the key.": ["Impossible de supprimer la clé.", "تعذّر حذف المفتاح."],
  "AI ready: {provider}": ["IA prête : {provider}", "الذكاء الاصطناعي جاهز: {provider}"],
  "0 matches": ["0 résultat", "لا نتائج"],
  Untagged: ["Sans étiquette", "بلا وسم"],
  yellow: ["jaune", "أصفر"],
  green: ["vert", "أخضر"],
  blue: ["bleu", "أزرق"],
  red: ["rouge", "أحمر"],
  purple: ["violet", "بنفسجي"],
  Question: ["Question", "سؤال"],
  "PFE Related-Work Note": ["Note d’état de l’art (PFE)", "ملاحظة الدراسات السابقة (مذكرة التخرج)"],
  "Security Paper Triage": ["Tri d’article de sécurité", "فرز ورقة في الأمن"],
  "Methodology Deep-Dive": ["Analyse approfondie de la méthode", "تعمّق في المنهجية"],
  "Import papers, create collections, or link notes with `[[Paper Title]]` to populate your knowledge graph.": [
    "Importez des articles, créez des collections ou liez des notes avec `[[Titre]]` pour remplir votre graphe.",
    "استورد أوراقاً، أو أنشئ مجموعات، أو اربط الملاحظات بـ`[[عنوان الورقة]]` لبناء خريطة معرفتك.",
  ],
  "Linked collections ({n})": ["Collections liées ({n})", "المجموعات المرتبطة ({n})"],
  "Backlinks ({n})": ["Rétroliens ({n})", "الإحالات الواردة ({n})"],
  Free: ["Gratuit", "مجاني"],
  "Reading view": ["Mode de lecture", "طريقة العرض"],
  PDF: ["PDF", "PDF"],
  "PDF + Reflow": ["PDF + Reformaté", "PDF + نص منسّق"],
  "Full screen (F11)": ["Plein écran (F11)", "ملء الشاشة (F11)"],
  "Exit full screen (Esc)": ["Quitter le plein écran (Échap)", "الخروج من ملء الشاشة (Esc)"],
  "Settings saved.": ["Réglages enregistrés.", "تم حفظ الإعدادات."],
  "{n} paragraphs": ["{n} paragraphes", "{n} فقرات"],
  "Open Tabs": ["Onglets ouverts", "الأوراق المفتوحة"],

  // ── AI settings ─────────────────────────────────────────────────────
  "Paste your API key first — use “Where do I get a key?” above.": [
    "Collez d’abord votre clé API — voir « Où obtenir une clé ? » ci-dessus.",
    "الصق مفتاح API أولاً — استعن برابط «أين أحصل على مفتاح؟» أعلاه.",
  ],
  "Add the provider's Base URL first.": ["Ajoutez d’abord l’URL de base du fournisseur.", "أضف عنوان URL الأساسي للمزوّد أولاً."],
  "Connected. Your key is saved in your system keychain.": [
    "Connecté. Votre clé est enregistrée dans le trousseau du système.",
    "تم الاتصال. حُفظ مفتاحك في خزنة مفاتيح النظام.",
  ],
  "Connected successfully.": ["Connexion réussie.", "تم الاتصال بنجاح."],
  "Connection test failed.": ["Échec du test de connexion.", "فشل اختبار الاتصال."],
  "AI Provider Settings": ["Réglages du fournisseur d’IA", "إعدادات مزوّد الذكاء الاصطناعي"],
  "Bring Your Own AI (Settings)": ["Votre propre IA (réglages)", "ذكاؤك الاصطناعي الخاص (الإعدادات)"],
  "Enable AI assistant (requests go directly to your chosen provider)": [
    "Activer l’assistant IA (les requêtes vont directement à votre fournisseur)",
    "تفعيل المساعد الذكي (تُرسل الطلبات مباشرة إلى المزوّد الذي تختاره)",
  ],
  "Provider (Free, no-credit-card options listed first)": [
    "Fournisseur (options gratuites sans carte en premier)",
    "المزوّد (الخيارات المجانية دون بطاقة بنكية أولاً)",
  ],
  "Free tier · No credit card required": ["Offre gratuite · sans carte bancaire", "مجاني · لا يحتاج بطاقة بنكية"],
  "Runs locally on your machine (8+ GB RAM recommended)": [
    "Fonctionne en local (8 Go de RAM ou plus recommandés)",
    "يعمل محلياً على جهازك (يُنصح بذاكرة 8 غيغابايت أو أكثر)",
  ],
  "Paid API key required": ["Clé API payante requise", "يتطلب مفتاح API مدفوعاً"],
  "Where do I get a key?": ["Où obtenir une clé ?", "أين أحصل على مفتاح؟"],
  "Copy link — open it in your browser": ["Copier le lien — ouvrez-le dans votre navigateur", "انسخ الرابط وافتحه في متصفحك"],
  "Link copied — paste it into your browser.": ["Lien copié — collez-le dans votre navigateur.", "تم نسخ الرابط — الصقه في متصفحك."],
  Copy: ["Copier", "نسخ"],
  "Base URL": ["URL de base", "عنوان URL الأساسي"],
  "API key (saved in your system keychain — never in files)": [
    "Clé API (enregistrée dans le trousseau du système — jamais dans des fichiers)",
    "مفتاح API (يُحفظ في خزنة مفاتيح النظام — وليس في الملفات)",
  ],
  "Paste API key…": ["Collez la clé API…", "الصق مفتاح API…"],
  "(saved — paste new key to replace)": ["(enregistrée — collez une nouvelle clé pour remplacer)", "(محفوظ — الصق مفتاحاً جديداً لاستبداله)"],
  Remove: ["Supprimer", "حذف"],
  Model: ["Modèle", "النموذج"],
  "Answer language": ["Langue des réponses", "لغة الإجابة"],
  "Same as paper": ["Comme l’article", "نفس لغة الورقة"],
  "Answer style": ["Style des réponses", "أسلوب الإجابة"],
  Short: ["Court", "مختصر"],
  Balanced: ["Équilibré", "متوازن"],
  Detailed: ["Détaillé", "مفصّل"],
  "Explain like I’m a beginner": ["Expliquer comme à un débutant", "اشرح لي كمبتدئ"],
  "Ask before sending a paper to a cloud AI for the first time": [
    "Demander avant d’envoyer un article à une IA cloud la première fois",
    "اسألني قبل إرسال ورقة إلى ذكاء سحابي لأول مرة",
  ],
  "Test connection": ["Tester la connexion", "اختبار الاتصال"],
  "Testing…": ["Test…", "جارٍ الاختبار…"],
  "Save settings": ["Enregistrer", "حفظ الإعدادات"],
  Cancel: ["Annuler", "إلغاء"],
  Save: ["Enregistrer", "حفظ"],
  Close: ["Fermer", "إغلاق"],
  "Checked {date}": ["Vérifié le {date}", "تم التحقق في {date}"],

  // ── Annotations ─────────────────────────────────────────────────────
  "Filter highlights & notes…": ["Filtrer surlignages et notes…", "ابحث في التظليلات والملاحظات…"],
  "Group annotations": ["Grouper les annotations", "تجميع التظليلات"],
  "Group: Page": ["Grouper : page", "التجميع: حسب الصفحة"],
  "Group: Color": ["Grouper : couleur", "التجميع: حسب اللون"],
  "Group: Tag": ["Grouper : étiquette", "التجميع: حسب الوسم"],
  "Filter by tag": ["Filtrer par étiquette", "التصفية حسب الوسم"],
  "All tags": ["Toutes les étiquettes", "كل الوسوم"],
  "All ({n})": ["Tout ({n})", "الكل ({n})"],
  "Filter: {label}": ["Filtre : {label}", "تصفية: {label}"],
  "Page {n}": ["Page {n}", "الصفحة {n}"],
  "Select text in the paper, then press 1–5 to highlight or N for a margin note.": [
    "Sélectionnez du texte, puis 1–5 pour surligner ou N pour une note en marge.",
    "حدّد نصاً في الورقة ثم اضغط 1–5 للتظليل أو N لإضافة ملاحظة هامشية.",
  ],
  "No annotations match the active filter.": ["Aucune annotation ne correspond au filtre.", "لا توجد تظليلات تطابق التصفية الحالية."],
  "Jump to this highlight": ["Aller à ce surlignage", "الانتقال إلى هذا التظليل"],
  "Delete annotation": ["Supprimer l’annotation", "حذف التظليل"],
  "Margin note (Markdown)…": ["Note en marge (Markdown)…", "ملاحظة هامشية (Markdown)…"],
  "Click to edit note or tags": ["Cliquez pour modifier la note ou les étiquettes", "اضغط لتعديل الملاحظة أو الوسوم"],
  "+ Add a margin note or #tags": ["+ Ajouter une note ou des #étiquettes", "+ أضف ملاحظة هامشية أو #وسوم"],
  "key-idea": ["idée clé", "فكرة رئيسية"],
  method: ["méthode", "منهجية"],
  result: ["résultat", "نتيجة"],
  limitation: ["limite", "محدودية"],
  "to-cite": ["à citer", "للاستشهاد"],
  "{label} (key {n})": ["{label} (touche {n})", "{label} (المفتاح {n})"],
  "Highlight as {label} (key {n})": ["Surligner comme {label} (touche {n})", "تظليل كـ{label} (المفتاح {n})"],

  // ── Assistant ───────────────────────────────────────────────────────
  "AI-generated · cited": ["Généré par IA · sourcé", "مولَّد بالذكاء الاصطناعي · موثَّق"],
  "Jump to {cid} (page {page})": ["Aller à {cid} (page {page})", "الانتقال إلى {cid} (الصفحة {page})"],
  "No valid paragraph citation was provided for this sentence": [
    "Aucune citation de paragraphe valide pour cette phrase",
    "لم يُقدَّم استشهاد صحيح بفقرة لهذه الجملة",
  ],
  unverified: ["non vérifié", "غير موثَّق"],
  "Cached Structured Summary": ["Résumé structuré (en cache)", "ملخص منظَّم (محفوظ)"],
  "This paper belongs to a 'Local AI only' collection. Switch to Ollama in Settings.": [
    "Cet article appartient à une collection « IA locale uniquement ». Passez à Ollama dans les réglages.",
    "هذه الورقة ضمن مجموعة «ذكاء محلي فقط». انتقل إلى Ollama من الإعدادات.",
  ],
  "Add your {provider} API key first — it's free and takes a minute.": [
    "Ajoutez d’abord votre clé API {provider} — c’est gratuit et prend une minute.",
    "أضف مفتاح API الخاص بـ{provider} أولاً — مجاني ويستغرق دقيقة.",
  ],
  "No selectable text extracted for this paper yet.": ["Aucun texte sélectionnable extrait pour cet article.", "لم يُستخرج نص قابل للتحديد من هذه الورقة بعد."],
  "Confirm below before sending “{title}” text to {provider}.": [
    "Confirmez ci-dessous avant d’envoyer le texte de « {title} » à {provider}.",
    "أكّد أدناه قبل إرسال نص «{title}» إلى {provider}.",
  ],
  "TL;DR": ["En bref", "الخلاصة"],
  "Structured Summary": ["Résumé structuré", "ملخص منظَّم"],
  "Explain: “{text}…”": ["Expliquer : « {text}… »", "اشرح: «{text}…»"],
  "AI request failed.": ["La requête IA a échoué.", "فشل طلب الذكاء الاصطناعي."],
  "Create at least one highlight in this paper first.": ["Créez d’abord au moins un surlignage dans cet article.", "أنشئ تظليلاً واحداً على الأقل في هذه الورقة أولاً."],
  "Study Flashcards (Anki)": ["Cartes de révision (Anki)", "بطاقات مراجعة (Anki)"],
  "Summary of My Highlights": ["Résumé de mes surlignages", "ملخص تظليلاتي"],
  "Study tool failed.": ["L’outil de révision a échoué.", "فشلت أداة المراجعة."],
  "Recipe run failed.": ["L’exécution de la recette a échoué.", "فشل تنفيذ الوصفة."],
  "AI Off": ["IA désactivée", "الذكاء متوقف"],
  "AI Settings": ["Réglages IA", "إعدادات الذكاء الاصطناعي"],
  "Local AI only collection — cloud providers are blocked.": [
    "Collection « IA locale uniquement » — les fournisseurs cloud sont bloqués.",
    "مجموعة «ذكاء محلي فقط» — المزوّدون السحابيون محظورون.",
  ],
  "Paragraphs from this paper will be sent to": ["Des paragraphes de cet article seront envoyés à", "سيتم إرسال فقرات من هذه الورقة إلى"],
  "Allow for this paper": ["Autoriser pour cet article", "السماح لهذه الورقة"],
  "Summarize Highlights": ["Résumer les surlignages", "تلخيص التظليلات"],
  "Anki Flashcards": ["Cartes Anki", "بطاقات Anki"],
  "Run Recipe…": ["Lancer une recette…", "تشغيل وصفة…"],
  "Run AI recipe": ["Lancer une recette IA", "تشغيل وصفة ذكاء اصطناعي"],
  Stop: ["Arrêter", "إيقاف"],
  "Generating grounded answer…": ["Génération d’une réponse sourcée…", "جارٍ إعداد إجابة موثَّقة…"],
  "Ask about this paper…": ["Posez une question sur cet article…", "اسأل عن هذه الورقة…"],
  Ask: ["Demander", "اسأل"],
  "Click TL;DR, Structured Summary, select any passage and press Ctrl+E, or ask a question. Every sentence cites a verified [P#] paragraph.": [
    "Cliquez sur En bref ou Résumé structuré, sélectionnez un passage puis Ctrl+E, ou posez une question. Chaque phrase cite un paragraphe vérifié [P#].",
    "اضغط «الخلاصة» أو «ملخص منظَّم»، أو حدّد أي مقطع واضغط Ctrl+E، أو اطرح سؤالاً. كل جملة تستشهد بفقرة موثَّقة [P#].",
  ],
  "Connect a free-tier API key (no credit card needed) or local Ollama in Settings to summarize and ask grounded questions.": [
    "Connectez une clé API gratuite (sans carte) ou Ollama en local dans les réglages pour résumer et poser des questions sourcées.",
    "اربط مفتاح API مجانياً (دون بطاقة بنكية) أو Ollama محلياً من الإعدادات للتلخيص وطرح أسئلة موثَّقة.",
  ],

  // ── Clean reading ───────────────────────────────────────────────────
  "Clean Reading Mode requires extracted text paragraphs from this PDF.": [
    "Le mode lecture épurée nécessite le texte extrait de ce PDF.",
    "يتطلب وضع القراءة المريحة فقرات نصية مستخرجة من هذا الملف.",
  ],
  "Return to Original PDF": ["Revenir au PDF d’origine", "العودة إلى ملف PDF الأصلي"],
  "Clean Reading Mode": ["Lecture épurée", "القراءة المريحة"],
  "Decrease reading font size": ["Réduire la taille du texte", "تصغير الخط"],
  "Increase reading font size": ["Agrandir la taille du texte", "تكبير الخط"],
  "Focus mode (F11)": ["Mode concentration (F11)", "وضع التركيز (F11)"],
  Focus: ["Concentration", "تركيز"],
  "Original PDF (Ctrl+R)": ["PDF d’origine (Ctrl+R)", "ملف PDF الأصلي (Ctrl+R)"],

  // ── Collection tools ────────────────────────────────────────────────
  "This collection is marked 'Local AI only'. Switch to Ollama in Settings.": [
    "Cette collection est marquée « IA locale uniquement ». Passez à Ollama dans les réglages.",
    "هذه المجموعة مقيّدة بـ«ذكاء محلي فقط». انتقل إلى Ollama من الإعدادات.",
  ],
  "Add papers to this view first.": ["Ajoutez d’abord des articles à cette vue.", "أضف أوراقاً إلى هذا العرض أولاً."],
  "Collection AI request failed.": ["La requête IA sur la collection a échoué.", "فشل طلب الذكاء الاصطناعي للمجموعة."],
  "Multi-Paper AI Tools": ["Outils IA multi-articles", "أدوات ذكاء اصطناعي لعدة أوراق"],
  "Generate Comparison Table": ["Générer un tableau comparatif", "إنشاء جدول مقارنة"],
  "Ask across all papers in this view (e.g. How do they evaluate robustness?)…": [
    "Interrogez tous les articles de cette vue (ex. Comment évaluent-ils la robustesse ?)…",
    "اسأل كل الأوراق في هذا العرض (مثلاً: كيف يقيّمون المتانة؟)…",
  ],
  "AI-generated · Multi-Paper Grounded": ["Généré par IA · sourcé sur plusieurs articles", "مولَّد بالذكاء الاصطناعي · موثَّق من عدة أوراق"],

  // ── Command palette / import / graph ────────────────────────────────
  "Command palette": ["Palette de commandes", "لوحة الأوامر"],
  "Type a command…": ["Tapez une commande…", "اكتب أمراً…"],
  "No matching commands": ["Aucune commande correspondante", "لا توجد أوامر مطابقة"],
  "Could not recognize a DOI (e.g. 10.1109/...) or arXiv ID (e.g. 1706.03762).": [
    "DOI (ex. 10.1109/...) ou identifiant arXiv (ex. 1706.03762) non reconnu.",
    "تعذّر التعرّف على DOI (مثل 10.1109/...) أو معرّف arXiv (مثل 1706.03762).",
  ],
  "Metadata lookup failed. Check your connection or add manually.": [
    "Échec de la recherche des métadonnées. Vérifiez votre connexion ou ajoutez-les à la main.",
    "فشل جلب البيانات الوصفية. تحقق من اتصالك أو أضفها يدوياً.",
  ],
  "Looking up…": ["Recherche…", "جارٍ البحث…"],
  "Fetch & Add": ["Récupérer et ajouter", "جلب وإضافة"],
  "Blue: Papers · Green: Collections · Purple: Projects · Dashed: [[wiki-links]]": [
    "Bleu : articles · Vert : collections · Violet : projets · Pointillés : [[liens wiki]]",
    "الأزرق: أوراق · الأخضر: مجموعات · البنفسجي: مشاريع · المتقطع: روابط [[wiki]]",
  ],

  // ── Library ─────────────────────────────────────────────────────────
  "To read": ["À lire", "للقراءة"],
  Reading: ["En cours", "قيد القراءة"],
  Read: ["Lu", "مقروءة"],
  Skimmed: ["Survolé", "تصفّح سريع"],
  Important: ["Important", "مهمة"],
  "Search papers, authors, tags…": ["Rechercher articles, auteurs, étiquettes…", "ابحث في الأوراق والمؤلفين والوسوم…"],
  "Sort papers": ["Trier les articles", "ترتيب الأوراق"],
  "Sort: Recently added": ["Tri : ajout récent", "الترتيب: الأحدث إضافة"],
  "Sort: Year": ["Tri : année", "الترتيب: السنة"],
  "Sort: Title": ["Tri : titre", "الترتيب: العنوان"],
  "Import BibTeX / Zotero .bib file": ["Importer un fichier BibTeX / Zotero .bib", "استيراد ملف BibTeX / Zotero ‏(.bib)"],
  "Compare papers or chat with this collection": ["Comparer les articles ou interroger cette collection", "قارن الأوراق أو حاور هذه المجموعة"],
  "Compare AI": ["Comparer (IA)", "مقارنة ذكية"],
  "Citation copy style": ["Style de citation copiée", "نمط نسخ الاستشهاد"],
  "Cite: APA": ["Citer : APA", "استشهاد: APA"],
  "Cite: IEEE": ["Citer : IEEE", "استشهاد: IEEE"],
  "Cite: ACM": ["Citer : ACM", "استشهاد: ACM"],
  "Import PDF": ["Importer un PDF", "استيراد PDF"],
  "Title & Authors": ["Titre et auteurs", "العنوان والمؤلفون"],
  Year: ["Année", "السنة"],
  Venue: ["Publication", "جهة النشر"],
  Status: ["Statut", "الحالة"],
  Collections: ["Collections", "المجموعات"],
  Actions: ["Actions", "إجراءات"],
  "Open in PDF reader": ["Ouvrir dans le lecteur PDF", "فتح في قارئ PDF"],
  "Attach PDF to read": ["Joindre le PDF pour le lire", "أرفق ملف PDF لقراءته"],
  "Unknown authors": ["Auteurs inconnus", "مؤلفون غير معروفين"],
  "Copy {style} citation": ["Copier la citation {style}", "نسخ الاستشهاد بنمط {style}"],
  "Copied {style} citation.": ["Citation {style} copiée.", "تم نسخ الاستشهاد بنمط {style}."],
  "Edit metadata": ["Modifier les métadonnées", "تعديل البيانات الوصفية"],
  "Edit paper metadata": ["Modifier les métadonnées de l’article", "تعديل بيانات الورقة"],
  "Edit Paper Metadata": ["Modifier les métadonnées", "تعديل بيانات الورقة"],
  Title: ["Titre", "العنوان"],
  "Authors (comma-separated)": ["Auteurs (séparés par des virgules)", "المؤلفون (مفصولون بفواصل)"],
  "Tags (comma-separated)": ["Étiquettes (séparées par des virgules)", "الوسوم (مفصولة بفواصل)"],
  "Save metadata": ["Enregistrer", "حفظ البيانات"],
  "1 paper": ["1 article", "ورقة واحدة"],
  "{n} papers": ["{n} articles", "{n} أوراق"],
  "Nothing matches yet.": ["Aucun résultat pour l’instant.", "لا توجد نتائج بعد."],
  "No papers match “{q}”. Try an author, a tag or a word from the abstract.": [
    "Aucun article ne correspond à « {q} ». Essayez un auteur, une étiquette ou un mot du résumé.",
    "لا توجد أوراق تطابق «{q}». جرّب اسم مؤلف أو وسماً أو كلمة من الملخص.",
  ],
  "your future self says thanks →": ["votre futur vous dit merci →", "شكراً من نفسك في المستقبل ←"],
  "Drop a paper. Start": ["Déposez un article. Commencez à", "اسحب ورقة وابدأ"],
  marking: ["annoter", "التظليل"],
  "Drag PDFs anywhere in this window, import one, or add a paper by DOI or arXiv ID.": [
    "Glissez des PDF n’importe où dans la fenêtre, importez-en un ou ajoutez un article par DOI ou arXiv.",
    "اسحب ملفات PDF إلى أي مكان في النافذة، أو استورد ملفاً، أو أضف ورقة عبر DOI أو معرّف arXiv.",
  ],
  "Everything stays on your computer.": ["Tout reste sur votre ordinateur.", "كل شيء يبقى على جهازك."],

  // ── Notes / onboarding / PDF / projects ─────────────────────────────
  "Write Markdown notes (supports [[Paper Title]] wiki-links)…": [
    "Écrivez vos notes Markdown (liens wiki [[Titre]] acceptés)…",
    "اكتب ملاحظاتك بصيغة Markdown (تدعم روابط [[عنوان الورقة]])…",
  ],
  Edit: ["Modifier", "تحرير"],
  Preview: ["Aperçu", "معاينة"],
  "Untitled section": ["Section sans titre", "قسم بلا عنوان"],
  "Failed to open PDF": ["Impossible d’ouvrir le PDF", "تعذّر فتح ملف PDF"],
  "Zoom out": ["Dézoomer", "تصغير"],
  "Zoom in": ["Zoomer", "تكبير"],
  "Toggle smart margin crop": ["Rognage intelligent des marges", "القص الذكي للهوامش"],
  Crop: ["Rogner", "قص"],
  "Search in document (Ctrl+F)": ["Rechercher dans le document (Ctrl+F)", "البحث في المستند (Ctrl+F)"],
  "No selectable text found. Highlights and AI are off for this file.": [
    "Aucun texte sélectionnable. Surlignage et IA désactivés pour ce fichier.",
    "لا يوجد نص قابل للتحديد. التظليل والذكاء الاصطناعي متوقفان لهذا الملف.",
  ],
  "Find in paper…": ["Rechercher dans l’article…", "ابحث في الورقة…"],
  "Highlight selection": ["Surligner la sélection", "تظليل التحديد"],
  Underline: ["Souligner", "تسطير"],
  Strikethrough: ["Barrer", "شطب"],
  "Highlight & add margin note (key N)": ["Surligner et annoter (touche N)", "تظليل وإضافة ملاحظة (المفتاح N)"],
  Note: ["Note", "ملاحظة"],
  "Explain selection with your AI (Ctrl+E)": ["Expliquer la sélection avec votre IA (Ctrl+E)", "اشرح التحديد بذكائك الاصطناعي (Ctrl+E)"],
  Explain: ["Expliquer", "اشرح"],
  "Opening PDF…": ["Ouverture du PDF…", "جارٍ فتح ملف PDF…"],
  "Research Projects": ["Projets de recherche", "المشاريع البحثية"],
  "New project name (e.g. PFE Thesis — 6G Intrusion Detection)…": [
    "Nom du projet (ex. Mémoire PFE — détection d’intrusions 6G)…",
    "اسم المشروع (مثلاً: مذكرة التخرج — كشف التسلل في 6G)…",
  ],
  Create: ["Créer", "إنشاء"],
  "Export Project BibTeX": ["Exporter le BibTeX du projet", "تصدير BibTeX للمشروع"],
  "Create collections in the sidebar to link them to this project.": [
    "Créez des collections dans la barre latérale pour les lier à ce projet.",
    "أنشئ مجموعات من الشريط الجانبي لربطها بهذا المشروع.",
  ],
  "Project Draft (`draft.md` — supports `[[Paper Title]]` wiki-links)": [
    "Brouillon du projet (`draft.md` — liens wiki `[[Titre]]` acceptés)",
    "مسودة المشروع (`draft.md` — تدعم روابط `[[عنوان الورقة]]`)",
  ],
  "Create a project to group related collections, draft your related-work chapter with `[[wiki-links]]`, and export its bibliography in one click.": [
    "Créez un projet pour regrouper des collections, rédiger votre état de l’art avec des `[[liens wiki]]` et exporter sa bibliographie en un clic.",
    "أنشئ مشروعاً لتجميع المجموعات ذات الصلة، وكتابة فصل الدراسات السابقة بروابط `[[wiki]]`، وتصدير مراجعه بنقرة واحدة.",
  ],
};

let current: UILanguage = "en";

export function setTrLanguage(lang: UILanguage): void {
  current = lang;
}

export function getTrLanguage(): UILanguage {
  return current;
}

export function tr(source: string, vars?: Record<string, string | number>): string {
  let out = source;
  if (current !== "en") {
    const entry = CATALOG[source];
    if (entry) out = entry[current === "fr" ? 0 : 1];
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return out;
}

/** Exposed for tests: every catalogue entry must keep the same placeholders in each language. */
export const __CATALOG = CATALOG;
