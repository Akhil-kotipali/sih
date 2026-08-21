/**
 * Lightweight Internationalization (i18n) Architecture for LearnPath
 * Supports UI localization across multiple languages with extensible translation dictionary.
 */

export type SupportedUILanguage = 'en' | 'es' | 'hi' | 'te' | 'fr' | 'de' | 'zh' | 'ja' | 'ar';

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
}

export const SUPPORTED_UI_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];

export const SUPPORTED_LEARNING_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.practice': 'Practice',
    'nav.roadmap': 'Roadmap',
    'nav.resources': 'Resources',
    'nav.mentor': 'AI Mentor',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',
    'nav.logout': 'Sign Out',
    'nav.login': 'Sign In',
    'nav.register': 'Create Account',
    'welcome.title': "Let's build your learning plan.",
    'welcome.subtitle': 'What do you want to learn today? Set a goal to generate an adaptive diagnostic and personalized roadmap.',
    'welcome.cta': 'Create your first learning goal →',
    'dashboard.empty.title': "You haven't started a learning goal yet.",
    'dashboard.empty.desc': 'Add any subject or topic—from Calculus to Conversational Spanish—to begin your personalized learning path.',
    'practice.empty.title': 'No assessment history yet.',
    'practice.empty.desc': 'Complete your first diagnostic assessment to discover your strengths and target growth areas.',
    'roadmap.empty.title': 'No active roadmap found.',
    'roadmap.empty.desc': 'Create a learning goal to generate your personalized step-by-step curriculum.',
    'resources.empty.title': 'No resources bookmarked yet.',
    'resources.empty.desc': 'Explore public educational repositories and bookmark verified tutorials, lectures, and guides.',
    'mentor.empty.title': 'AI Mentor Ready',
    'mentor.empty.desc': 'Ask questions, explore deep conceptual derivations, or request targeted drills on diagnosed weak points.',
  },
  es: {
    'nav.dashboard': 'Panel Principal',
    'nav.practice': 'Práctica',
    'nav.roadmap': 'Ruta de Aprendizaje',
    'nav.resources': 'Recursos',
    'nav.mentor': 'Mentor IA',
    'nav.profile': 'Perfil',
    'nav.settings': 'Ajustes',
    'nav.logout': 'Cerrar Sesión',
    'nav.login': 'Iniciar Sesión',
    'nav.register': 'Crear Cuenta',
    'welcome.title': 'Construyamos tu plan de aprendizaje.',
    'welcome.subtitle': '¿Qué deseas aprender hoy? Define un objetivo para generar un diagnóstico adaptativo y tu ruta personalizada.',
    'welcome.cta': 'Crea tu primer objetivo de aprendizaje →',
    'dashboard.empty.title': 'Aún no has iniciado un objetivo de aprendizaje.',
    'dashboard.empty.desc': 'Añade cualquier materia—desde Cálculo hasta Español conversacional—para comenzar tu camino.',
    'practice.empty.title': 'Sin historial de evaluaciones.',
    'practice.empty.desc': 'Completa tu primer diagnóstico para descubrir tus fortalezas y áreas de mejora.',
    'roadmap.empty.title': 'No hay ruta de aprendizaje activa.',
    'roadmap.empty.desc': 'Crea un objetivo para generar tu plan de estudio paso a paso.',
    'resources.empty.title': 'Sin recursos guardados.',
    'resources.empty.desc': 'Explora repositorios educativos abiertos y guarda tutoriales verificados.',
    'mentor.empty.title': 'Mentor IA Disponible',
    'mentor.empty.desc': 'Haz preguntas, explora conceptos profundos o solicita ejercicios de refuerzo.',
  },
  hi: {
    'nav.dashboard': 'डैशबोर्ड',
    'nav.practice': 'अभ्यास',
    'nav.roadmap': 'रोडमैप',
    'nav.resources': 'संसाधन',
    'nav.mentor': 'एआई मेंटर',
    'nav.profile': 'प्रोफ़ाइल',
    'nav.settings': 'सेटिंग्स',
    'nav.logout': 'साइन आउट',
    'nav.login': 'साइन इन',
    'nav.register': 'खाता बनाएं',
    'welcome.title': 'आइए आपकी अध्ययन योजना बनाएं।',
    'welcome.subtitle': 'आज आप क्या सीखना चाहते हैं? व्यक्तिगत रोडमैप और डायग्नोस्टिक के लिए अपना लक्ष्य निर्धारित करें।',
    'welcome.cta': 'अपना पहला सीखने का लक्ष्य बनाएं →',
    'dashboard.empty.title': 'आपने अभी तक कोई सीखने का लक्ष्य शुरू नहीं किया है।',
    'dashboard.empty.desc': 'अपनी व्यक्तिगत सीखने की यात्रा शुरू करने के लिए कोई भी विषय जोड़ें।',
    'practice.empty.title': 'कोई मूल्यांकन इतिहास नहीं मिला।',
    'practice.empty.desc': 'अपनी ताकत और कमजोरियों को जानने के लिए अपना पहला डायग्नोस्टिक टेस्ट पूरा करें।',
    'roadmap.empty.title': 'कोई सक्रिय रोडमैप नहीं है।',
    'roadmap.empty.desc': 'अपना व्यक्तिगत पाठ्यक्रम तैयार करने के लिए एक लक्ष्य बनाएं।',
    'resources.empty.title': 'कोई बुकमार्क नहीं है।',
    'resources.empty.desc': 'खुले शैक्षिक स्रोतों से सामग्री खोजें और सहेजें।',
    'mentor.empty.title': 'एआई मेंटर तैयार है',
    'mentor.empty.desc': 'प्रश्न पूछें, अवधारणाओं को समझें और व्यक्तिगत मार्गदर्शन प्राप्त करें।',
  },
  te: {
    'nav.dashboard': 'డ్యాష్‌బోర్డ్',
    'nav.practice': 'అభ్యాసం',
    'nav.roadmap': 'రోడ్‌మ్యాప్',
    'nav.resources': 'వనరులు',
    'nav.mentor': 'AI మెంటార్',
    'nav.profile': 'ప్రొఫైల్',
    'nav.settings': 'సెట్టింగ్‌లు',
    'nav.logout': 'లాగ్ అవుట్',
    'nav.login': 'లాగిన్',
    'nav.register': 'ఖాతా సృష్టించండి',
    'welcome.title': 'మీ అభ్యాస ప్రణాళికను రూపొందిద్దాం.',
    'welcome.subtitle': 'ఈ రోజు మీరు ఏమి నేర్చుకోవాలనుకుంటున్నారు? వ్యక్తిగతీకరించిన రోడ్‌మ్యాప్ కోసం మీ లక్ష్యాన్ని నిర్ణయించండి.',
    'welcome.cta': 'మీ మొదటి అభ్యాస లక్ష్యాన్ని సృష్టించండి →',
    'dashboard.empty.title': 'మీరు ఇంకా ఎటువంటి అభ్యాస లక్ష్యాన్ని ప్రారంభించలేదు.',
    'dashboard.empty.desc': 'మీ వ్యక్తిగత అభ్యాస ప్రయాణాన్ని ప్రారంభించడానికి ఏదైనా సబ్జెక్ట్‌ను జోడించండి.',
    'practice.empty.title': 'ఇంకా ఎటువంటి అసెస్‌మెంట్ రికార్డు లేదు.',
    'practice.empty.desc': 'మీ బలాలు మరియు బలహీనతలను తెలుసుకోవడానికి మొదటి డయాగ్నస్టిక్ అసెస్‌మెంట్‌ను పూర్తి చేయండి.',
    'roadmap.empty.title': 'యాక్టివ్ రోడ్‌మ్యాప్ ఏదీ లేదు.',
    'roadmap.empty.desc': 'మీ వ్యక్తిగత పాఠ్యాంశాన్ని రూపొందించడానికి ఒక లక్ష్యాన్ని సృష్టించండి.',
    'resources.empty.title': 'బుక్‌మార్క్ చేసిన వనరులు లేవు.',
    'resources.empty.desc': 'విద్యా సంబంధిత వనరులను శోధించి భద్రపరచుకోండి.',
    'mentor.empty.title': 'AI మెంటార్ సిద్ధంగా ఉంది',
    'mentor.empty.desc': 'సందేహాలను నివృత్తి చేసుకోండి మరియు ప్రత్యక్ష మార్గదర్శకత్వం పొందండి.',
  },
};

export function t(key: string, lang: string = 'en', fallback?: string): string {
  const normalizedLang = lang.toLowerCase().slice(0, 2);
  const dict = TRANSLATIONS[normalizedLang] || TRANSLATIONS['en'];
  return dict[key] || TRANSLATIONS['en'][key] || fallback || key;
}
