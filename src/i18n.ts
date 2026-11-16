export type Lang = "tr" | "en";
const dict = {
  tr: {
    tagline: "Konuşmanı yazıya döken, internete hiç göndermeyen not defteri.",
    record: "Kaydet", stop: "Bitir", pause: "Duraklat", resume: "Devam", import: "Dosya aç",
    library: "Notlar", settings: "Ayarlar", newNote: "Yeni kayıt", home: "Kayıt",
    tapToRecord: "Kayda başlamak için mühre dokun", listening: "Dinliyorum", paused: "Duraklatıldı",
    finishing: "Son kısım yazılıyor…", transcribingFile: "Dosya yazıya dökülüyor…",
    loadingModel: "Model indiriliyor", modelReady: "Model hazır", firstTime: "İlk seferde bir kez indirilir, sonra çevrimdışı çalışır.",
    noNotes: "Henüz not yok. İlk kaydını yap ya da bir ses dosyası aç.", search: "Notlarda ara…",
    highlights: "Öne çıkanlar", keywords: "Anahtar kelimeler", transcript: "Metin",
    exportAs: "Dışa aktar", share: "Paylaş", copy: "Kopyala", copied: "Kopyalandı", del: "Sil", confirmDel: "Bu not silinsin mi?",
    untitled: "Adsız not", rename: "Başlığı düzenle",
    how: "Nasıl çalışıyor?", sent: "Sunucuya gönderilen", bytes: "0 bayt", engine: "Motor", model: "Model",
    speed: "Hız", rtf: "× gerçek zaman", runs: "çalıştırma", load: "Yükleme",
    howText: "Ses, tarayıcının içinde çalışan Whisper modeliyle yazıya dökülür. Model dosyaları bir kez indirilir ve cihazında saklanır; kayıtların ve metinlerin bu cihazdan çıkmaz.",
    language: "Konuşma dili", auto: "Otomatik", modelSize: "Model boyutu", theme: "Tema", uiLang: "Arayüz dili",
    light: "Açık", dark: "Koyu", system: "Sistem", storage: "Depolama", clearModels: "Model önbelleğini sil", cleared: "Silindi",
    tiny: "Minik · ~40 MB · en hızlı", base: "Temel · ~80 MB · dengeli", small: "Küçük · ~250 MB · en doğru",
    notesCount: "not", modelsCached: "indirilmiş model", install: "Uygulamayı yükle",
    micDenied: "Mikrofon izni verilmedi. Tarayıcı ayarlarından izin verip tekrar dene.",
    unsupported: "Bu tarayıcı gereken özellikleri desteklemiyor. Güncel Chrome, Edge, Safari ya da Firefox dene.",
    error: "Bir sorun oldu", offline: "Çevrimdışısın — indirilmiş modelle çalışmaya devam eder.",
    duration: "Süre", created: "Oluşturma", fromMic: "Mikrofon", fromFile: "Dosya", words: "kelime",
    dropHere: "Ses ya da video dosyasını buraya bırak", back: "Geri", privacy: "Gizlilik",
    gpu: "WebGPU (ekran kartı)", cpu: "WebAssembly (işlemci)",
  },
  en: {
    tagline: "A notebook that turns speech into text and never sends it to the internet.",
    record: "Record", stop: "Finish", pause: "Pause", resume: "Resume", import: "Open file",
    library: "Notes", settings: "Settings", newNote: "New recording", home: "Record",
    tapToRecord: "Tap the seal to start recording", listening: "Listening", paused: "Paused",
    finishing: "Writing the last part…", transcribingFile: "Transcribing file…",
    loadingModel: "Downloading model", modelReady: "Model ready", firstTime: "Downloaded once, then it works offline.",
    noNotes: "No notes yet. Make your first recording or open an audio file.", search: "Search notes…",
    highlights: "Highlights", keywords: "Keywords", transcript: "Transcript",
    exportAs: "Export", share: "Share", copy: "Copy", copied: "Copied", del: "Delete", confirmDel: "Delete this note?",
    untitled: "Untitled note", rename: "Edit title",
    how: "How does it work?", sent: "Sent to a server", bytes: "0 bytes", engine: "Engine", model: "Model",
    speed: "Speed", rtf: "× real time", runs: "runs", load: "Load",
    howText: "Audio is transcribed by a Whisper model running inside your browser. Model files are downloaded once and kept on your device; your recordings and transcripts never leave it.",
    language: "Spoken language", auto: "Automatic", modelSize: "Model size", theme: "Theme", uiLang: "Interface language",
    light: "Light", dark: "Dark", system: "System", storage: "Storage", clearModels: "Clear model cache", cleared: "Cleared",
    tiny: "Tiny · ~40 MB · fastest", base: "Base · ~80 MB · balanced", small: "Small · ~250 MB · most accurate",
    notesCount: "notes", modelsCached: "downloaded models", install: "Install app",
    micDenied: "Microphone permission was denied. Allow it in your browser settings and try again.",
    unsupported: "This browser lacks required features. Try a current Chrome, Edge, Safari or Firefox.",
    error: "Something went wrong", offline: "You're offline — it keeps working with the downloaded model.",
    duration: "Duration", created: "Created", fromMic: "Microphone", fromFile: "File", words: "words",
    dropHere: "Drop an audio or video file here", back: "Back", privacy: "Privacy",
    gpu: "WebGPU (graphics card)", cpu: "WebAssembly (processor)",
  },
} as const;
export type Key = keyof typeof dict.tr;
let lang: Lang = "tr";
export const setLang = (l: Lang) => { lang = l; document.documentElement.lang = l; };
export const getLang = () => lang;
export const t = (k: Key): string => dict[lang][k];
export const locale = () => (lang === "tr" ? "tr-TR" : "en-GB");
