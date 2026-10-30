import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FileUp, 
  FileDown, 
  Languages, 
  BookOpen, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Download,
  RotateCcw,
  Eye,
  Shield,
  Zap,
  Globe,
  Clock,
  FileText,
  BarChart3,
  Bookmark,
  Settings,
  ChevronDown,
  X,
  Plus,
  Trash2,
  Edit3,
  Star,
  Award,
  Users,
  ArrowLeft,
  Menu,
  FileCheck,
  Layers
} from 'lucide-react';
import { 
  extractPdfContent, 
  translatePages, 
  generateTranslatedPdf, 
  downloadPdf,
  downloadText,
  type TranslationProgress,
  type PageData,
  type TranslationStats
} from './services/pdfService';

type AppState = 'idle' | 'uploading' | 'extracting' | 'translating' | 'generating' | 'done' | 'error';

interface GlossaryEntry {
  id: string;
  source: string;
  target: string;
}

interface TranslationHistory {
  id: string;
  fileName: string;
  date: string;
  pages: number;
  words: number;
  sourceLang: string;
  targetLang: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'الإنجليزية', flag: '🇬🇧' },
  { code: 'fr', name: 'الفرنسية', flag: '🇫🇷' },
  { code: 'de', name: 'الألمانية', flag: '🇩🇪' },
  { code: 'es', name: 'الإسبانية', flag: '🇪🇸' },
  { code: 'it', name: 'الإيطالية', flag: '🇮🇹' },
  { code: 'pt', name: 'البرتغالية', flag: '🇵🇹' },
  { code: 'ru', name: 'الروسية', flag: '🇷🇺' },
  { code: 'tr', name: 'التركية', flag: '🇹🇷' },
  { code: 'zh', name: 'الصينية', flag: '🇨🇳' },
  { code: 'ja', name: 'اليابانية', flag: '🇯🇵' },
  { code: 'ko', name: 'الكورية', flag: '🇰🇷' },
];

function App() {
  const [state, setState] = useState<AppState>('idle');
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [fileName, setFileName] = useState('');
  const [translatedPdfBytes, setTranslatedPdfBytes] = useState<Uint8Array | null>(null);
  const [previewPages, setPreviewPages] = useState<PageData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang] = useState('ar');
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [showGlossary, setShowGlossary] = useState(false);
  const [glossary, setGlossary] = useState<GlossaryEntry[]>(() => {
    const saved = localStorage.getItem('lingua_glossary');
    return saved ? JSON.parse(saved) : [];
  });
  const [newGlossarySource, setNewGlossarySource] = useState('');
  const [newGlossaryTarget, setNewGlossaryTarget] = useState('');
  const [history, setHistory] = useState<TranslationHistory[]>(() => {
    const saved = localStorage.getItem('lingua_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('lingua_glossary', JSON.stringify(glossary));
  }, [glossary]);

  useEffect(() => {
    localStorage.setItem('lingua_history', JSON.stringify(history));
  }, [history]);

  const handleProgress = useCallback((p: TranslationProgress) => {
    setProgress(p);
    if (p.stage === 'extracting') setState('extracting');
    else if (p.stage === 'translating') setState('translating');
    else if (p.stage === 'generating') setState('generating');
  }, []);

  const processFile = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      setErrorMessage('الرجاء رفع ملف PDF صالح');
      setState('error');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('حجم الملف كبير جداً. الحد الأقصى 50 ميجابايت');
      setState('error');
      return;
    }

    setFileName(file.name);
    setState('uploading');
    setErrorMessage('');
    setTranslatedPdfBytes(null);
    setPreviewPages([]);
    setStartTime(Date.now());

    try {
      const glossaryMap: Record<string, string> = {};
      glossary.forEach(entry => {
        glossaryMap[entry.source] = entry.target;
      });

      const { pages, pdfBytes, stats: extractedStats } = await extractPdfContent(file, handleProgress);
      setPreviewPages(pages);
      setStats(extractedStats);

      const translatedPages = await translatePages(
        pages, 
        sourceLang, 
        targetLang, 
        glossaryMap, 
        handleProgress
      );

      const resultBytes = await generateTranslatedPdf(translatedPages, pdfBytes, handleProgress);
      
      setTranslatedPdfBytes(resultBytes);
      setState('done');

      // Add to history
      const newHistory: TranslationHistory = {
        id: Date.now().toString(),
        fileName: file.name,
        date: new Date().toLocaleDateString('ar-EG'),
        pages: extractedStats.totalPages,
        words: extractedStats.totalWords,
        sourceLang,
        targetLang
      };
      setHistory(prev => [newHistory, ...prev].slice(0, 10));
    } catch (error) {
      console.error('Processing error:', error);
      setErrorMessage('حدث خطأ أثناء معالجة الملف. الرجاء المحاولة مرة أخرى.');
      setState('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [sourceLang, glossary]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDownload = () => {
    if (translatedPdfBytes) {
      const newName = fileName.replace('.pdf', '_translated.pdf');
      downloadPdf(translatedPdfBytes, newName);
    }
  };

  const handleDownloadText = () => {
    if (previewPages.length > 0) {
      const textContent = previewPages
        .map(page => `--- Page ${page.pageNumber} ---\n${page.textItems.map(item => item.text).join('\n')}`)
        .join('\n\n');
      downloadText(textContent, fileName.replace('.pdf', '_translated.txt'));
    }
  };

  const handleReset = () => {
    setState('idle');
    setProgress(null);
    setFileName('');
    setTranslatedPdfBytes(null);
    setPreviewPages([]);
    setShowPreview(false);
    setErrorMessage('');
    setStats(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addGlossaryEntry = () => {
    if (newGlossarySource.trim() && newGlossaryTarget.trim()) {
      setGlossary(prev => [...prev, {
        id: Date.now().toString(),
        source: newGlossarySource.trim(),
        target: newGlossaryTarget.trim()
      }]);
      setNewGlossarySource('');
      setNewGlossaryTarget('');
    }
  };

  const removeGlossaryEntry = (id: string) => {
    setGlossary(prev => prev.filter(entry => entry.id !== id));
  };

  const getProgressPercentage = () => {
    if (!progress) return 0;
    if (progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const getElapsedTime = () => {
    if (!startTime) return '0';
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (elapsed < 60) return `${elapsed} ثانية`;
    return `${Math.floor(elapsed / 60)} دقيقة`;
  };

  const sourceLangName = SUPPORTED_LANGUAGES.find(l => l.code === sourceLang)?.name || '';
  const sourceLangFlag = SUPPORTED_LANGUAGES.find(l => l.code === sourceLang)?.flag || '';

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Languages className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-navy-900 font-display tracking-tight">LinguaDocs</h1>
                <p className="text-[10px] text-navy-500 -mt-0.5">Professional Translation</p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#home" className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors">الرئيسية</a>
              <a href="#features" className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors">المميزات</a>
              <a href="#how-it-works" className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors">كيف يعمل</a>
              <a href="#pricing" className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors">الأسعار</a>
              <button 
                onClick={() => {
                  setShowGlossary(true);
                }}
                className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors"
              >
                القاموس
              </button>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button className="px-4 py-2 text-sm font-medium text-navy-700 hover:text-navy-900 transition-colors">
                تسجيل الدخول
              </button>
              <button className="px-5 py-2.5 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors btn-shine">
                ابدأ مجاناً
              </button>
            </div>

            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-5 h-5 text-navy-900" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 py-4 px-4 animate-fade-in">
            <div className="flex flex-col gap-3">
              <a href="#home" className="text-sm font-medium text-navy-600 py-2">الرئيسية</a>
              <a href="#features" className="text-sm font-medium text-navy-600 py-2">المميزات</a>
              <a href="#how-it-works" className="text-sm font-medium text-navy-600 py-2">كيف يعمل</a>
              <a href="#pricing" className="text-sm font-medium text-navy-600 py-2">الأسعار</a>
              <button onClick={() => setShowGlossary(true)} className="text-sm font-medium text-navy-600 py-2 text-right">القاموس</button>
              <button className="mt-2 px-5 py-2.5 text-sm font-semibold text-white bg-navy-900 rounded-lg">
                ابدأ مجاناً
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="home" className="pt-28 pb-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-100/30 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 mb-6 animate-fade-in-up">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">منصة الترجمة الاحترافية الأولى عربياً</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-navy-900 leading-tight mb-6 animate-fade-in-up delay-100 font-display">
              ترجم مستنداتك بدقة
              <br />
              <span className="gradient-text">احترافية عالمية</span>
            </h1>
            
            <p className="text-lg text-navy-500 leading-relaxed mb-8 animate-fade-in-up delay-200 max-w-2xl mx-auto">
              منصة متكاملة لترجمة ملفات PDF والمستندات من الإنجليزية وأكثر من 10 لغات إلى العربية، 
              مع الحفاظ على التنسيق الأصلي والصور والجداول
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-in-up delay-300">
              <div className="flex items-center gap-2 text-sm text-navy-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>ترجمة فورية</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-navy-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>الحفاظ على الصور</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-navy-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>قاموس مخصص</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-navy-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>تصدير متعدد</span>
              </div>
            </div>
          </div>

          {/* Main Translation Card */}
          <div className="max-w-4xl mx-auto">
            {state === 'idle' && (
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 md:p-8 animate-scale-in">
                {/* Language Selection */}
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-navy-500 uppercase tracking-wider mb-2 block">اللغة المصدر</label>
                    <div className="relative">
                      <select 
                        value={sourceLang}
                        onChange={(e) => setSourceLang(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-navy-900 font-medium appearance-none cursor-pointer hover:border-emerald-300 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
                      >
                        {SUPPORTED_LANGUAGES.map(lang => (
                          <option key={lang.code} value={lang.code}>
                            {lang.flag} {lang.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex-shrink-0 mt-6">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <ArrowLeft className="w-4 h-4 text-emerald-600 rotate-180" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="text-xs font-semibold text-navy-500 uppercase tracking-wider mb-2 block">اللغة الهدف</label>
                    <div className="relative">
                      <div className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-navy-900 font-medium">
                        🇸🇦 العربية
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upload Zone */}
                <div
                  className={`upload-zone rounded-xl p-8 md:p-12 text-center cursor-pointer ${
                    isDragOver ? 'dragover' : ''
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                      <FileUp className="w-8 h-8 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-navy-900 mb-1">
                        ارفع ملف PDF للترجمة
                      </h3>
                      <p className="text-navy-500 text-sm">
                        اسحب الملف وأفلته هنا أو اضغط للاختيار
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-navy-400">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" /> PDF فقط
                      </span>
                      <span>•</span>
                      <span>الحد الأقصى 50 MB</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowGlossary(true); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-navy-600 hover:text-navy-900 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>القاموس المخصص</span>
                    {glossary.length > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">{glossary.length}</span>
                    )}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-navy-600 hover:text-navy-900 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>إعدادات متقدمة</span>
                  </button>
                </div>
              </div>
            )}

            {/* Processing State */}
            {(state === 'uploading' || state === 'extracting' || state === 'translating' || state === 'generating') && (
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 animate-scale-in">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-navy-900 mb-2">{progress?.message || 'جاري المعالجة...'}</h3>
                  <p className="text-navy-500 text-sm">
                    <span className="font-medium text-navy-700">{fileName}</span>
                    {stats && <span className="mx-2">• {stats.totalPages} صفحة • {stats.totalWords.toLocaleString('ar-EG')} كلمة</span>}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium text-navy-700">{getProgressPercentage()}%</span>
                    <span className="text-navy-400">{getElapsedTime()}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300 progress-bar-animated"
                      style={{ width: `${getProgressPercentage()}%` }}
                    ></div>
                  </div>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-3 gap-3">
                  <div className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${state === 'extracting' ? 'bg-emerald-50 border border-emerald-200' : (state as string) !== 'uploading' ? 'bg-slate-50' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${state === 'extracting' ? 'bg-emerald-500 text-white' : (state as string) !== 'uploading' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-navy-600">الاستخراج</span>
                  </div>
                  <div className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${state === 'translating' ? 'bg-emerald-50 border border-emerald-200' : (state as string) === 'generating' ? 'bg-slate-50' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${state === 'translating' ? 'bg-emerald-500 text-white' : (state as string) === 'generating' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Languages className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-navy-600">الترجمة</span>
                  </div>
                  <div className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${(state as string) === 'generating' ? 'bg-emerald-50 border border-emerald-200' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${(state as string) === 'generating' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <FileCheck className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-navy-600">الإنشاء</span>
                  </div>
                </div>
              </div>
            )}

            {/* Done State */}
            {state === 'done' && (
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 animate-scale-in">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-navy-900 mb-2">تمت الترجمة بنجاح</h3>
                  <p className="text-navy-500 text-sm">
                    تم ترجمة <span className="font-medium text-navy-700">{fileName}</span> من {sourceLangFlag} {sourceLangName} إلى العربية
                  </p>
                </div>

                {/* Stats Cards */}
                {stats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-navy-900 stat-number">{stats.totalPages}</div>
                      <div className="text-xs text-navy-500 mt-1">صفحة</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-navy-900 stat-number">{stats.totalWords.toLocaleString('ar-EG')}</div>
                      <div className="text-xs text-navy-500 mt-1">كلمة</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-navy-900 stat-number">{stats.totalCharacters.toLocaleString('ar-EG')}</div>
                      <div className="text-xs text-navy-500 mt-1">حرف</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-navy-900 stat-number">{getElapsedTime()}</div>
                      <div className="text-xs text-navy-500 mt-1">وقت المعالجة</div>
                    </div>
                  </div>
                )}

                {/* Download Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-navy-900 rounded-xl text-white font-semibold hover:bg-navy-800 transition-all btn-shine"
                  >
                    <Download className="w-5 h-5" />
                    تحميل PDF المترجم
                  </button>
                  <button
                    onClick={handleDownloadText}
                    className="flex items-center justify-center gap-2 px-5 py-4 bg-slate-100 rounded-xl text-navy-700 font-medium hover:bg-slate-200 transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    TXT
                  </button>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center justify-center gap-2 px-5 py-4 bg-slate-100 rounded-xl text-navy-700 font-medium hover:bg-slate-200 transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    معاينة
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center justify-center gap-2 px-5 py-4 bg-slate-100 rounded-xl text-navy-700 font-medium hover:bg-slate-200 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    جديد
                  </button>
                </div>

                {/* Preview */}
                {showPreview && previewPages.length > 0 && (
                  <div className="mt-6 max-h-80 overflow-y-auto rounded-xl bg-slate-50 border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-navy-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        معاينة المحتوى ({previewPages.length} صفحة)
                      </h4>
                      <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-slate-200 rounded">
                        <X className="w-4 h-4 text-navy-400" />
                      </button>
                    </div>
                    {previewPages.slice(0, 5).map((page, idx) => (
                      <div key={idx} className="page-preview-card p-4 mb-3">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                            صفحة {page.pageNumber}
                          </span>
                          <span className="text-xs text-navy-400">
                            {page.textItems.length} عنصر نصي
                          </span>
                        </div>
                        <p className="text-sm text-navy-700 leading-relaxed line-clamp-3">
                          {page.textItems.map((item, i) => (
                            <span key={i}>{item.text} </span>
                          ))}
                        </p>
                        {page.textItems.length === 0 && (
                          <p className="text-sm text-navy-400 italic">صفحة صور فقط - لا يوجد نص</p>
                        )}
                      </div>
                    ))}
                    {previewPages.length > 5 && (
                      <p className="text-center text-xs text-navy-400 mt-2">
                        + {previewPages.length - 5} صفحات أخرى
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {state === 'error' && (
              <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 animate-scale-in">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-navy-900 mb-2">حدث خطأ</h3>
                  <p className="text-navy-500 mb-6">{errorMessage}</p>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-navy-900 rounded-xl text-white font-semibold hover:bg-navy-800 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    المحاولة مرة أخرى
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="py-12 px-4 border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-xs font-semibold text-navy-400 uppercase tracking-wider mb-8">
            موثوق من قبل أكثر من 10,000 شركة ومؤسسة حول العالم
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-40">
            <div className="text-2xl font-bold text-navy-900 font-display">ARAMCO</div>
            <div className="text-2xl font-bold text-navy-900 font-display">STC</div>
            <div className="text-2xl font-bold text-navy-900 font-display">SABIC</div>
            <div className="text-2xl font-bold text-navy-900 font-display">NEOM</div>
            <div className="text-2xl font-bold text-navy-900 font-display">MC</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold mb-4">
              <Star className="w-3 h-3" />
              المميزات
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4 font-display">
              كل ما تحتاجه للترجمة الاحترافية
            </h2>
            <p className="text-navy-500">
              أدوات متقدمة مصممة خصيصاً لتلبية احتياجات الشركات والمترجمين المحترفين
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Zap className="w-5 h-5" />,
                title: 'ترجمة فورية',
                desc: 'معالجة سريعة باستخدام أحدث تقنيات الذكاء الاصطناعي مع نتائج دقيقة في ثوانٍ',
                color: 'bg-amber-50 text-amber-600'
              },
              {
                icon: <Shield className="w-5 h-5" />,
                title: 'أمان كامل',
                desc: 'تشفير end-to-end لجميع ملفاتك مع حذف تلقائي بعد المعالجة',
                color: 'bg-blue-50 text-blue-600'
              },
              {
                icon: <BookOpen className="w-5 h-5" />,
                title: 'قاموس مخصص',
                desc: 'أنشئ قاموساً خاصاً بالمصطلحات التقنية لضمان ثبات الترجمة',
                color: 'bg-emerald-50 text-emerald-600'
              },
              {
                icon: <Layers className="w-5 h-5" />,
                title: 'الحفاظ على التنسيق',
                desc: 'الاحتفاظ بالصور والجداول والتنسيق الأصلي للمستند بعد الترجمة',
                color: 'bg-purple-50 text-purple-600'
              },
              {
                icon: <Globe className="w-5 h-5" />,
                title: '+11 لغة مدعومة',
                desc: 'ترجمة من الإنجليزية والفرنسية والألمانية وأكثر من 11 لغة إلى العربية',
                color: 'bg-pink-50 text-pink-600'
              },
              {
                icon: <BarChart3 className="w-5 h-5" />,
                title: 'إحصائيات تفصيلية',
                desc: 'تقارير شاملة عن عدد الكلمات والصفحات ووقت المعالجة لكل ملف',
                color: 'bg-teal-50 text-teal-600'
              },
              {
                icon: <FileDown className="w-5 h-5" />,
                title: 'تصدير متعدد',
                desc: 'حمّل النتيجة بصيغة PDF أو TXT أو DOCX حسب احتياجك',
                color: 'bg-indigo-50 text-indigo-600'
              },
              {
                icon: <Clock className="w-5 h-5" />,
                title: 'سجل الترجمات',
                desc: 'احتفظ بسجل كامل لجميع ترجماتك السابقة مع إمكانية إعادة التحميل',
                color: 'bg-orange-50 text-orange-600'
              },
              {
                icon: <Award className="w-5 h-5" />,
                title: 'جودة احترافية',
                desc: 'نتائج ترجمة بمستوى المترجمين المحترفين مع مراجعة ذكية',
                color: 'bg-red-50 text-red-600'
              }
            ].map((feature, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-100 card-hover">
                <div className={`w-10 h-10 rounded-xl ${feature.color} flex items-center justify-center mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-navy-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold mb-4">
              <Sparkles className="w-3 h-3" />
              كيف يعمل
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4 font-display">
              ثلاث خطوات بسيطة
            </h2>
            <p className="text-navy-500">
              عملية ترجمة سهلة وسريعة لا تتطلب أي خبرة تقنية
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'ارفع الملف',
                desc: 'اختر ملف PDF الذي تريد ترجمته من جهازك أو اسحبه وأفلته',
                icon: <FileUp className="w-6 h-6" />
              },
              {
                step: '02',
                title: 'اختر اللغة',
                desc: 'حدد اللغة المصدر من أكثر من 11 لغة مدعومة والنتيجة ستكون بالعربية',
                icon: <Languages className="w-6 h-6" />
              },
              {
                step: '03',
                title: 'حمّل النتيجة',
                desc: 'احصل على ملف PDF مترجم مع الحفاظ على جميع الصور والتنسيق',
                icon: <Download className="w-6 h-6" />
              }
            ].map((item, idx) => (
              <div key={idx} className="relative text-center">
                <div className="w-16 h-16 rounded-2xl bg-navy-900 text-white flex items-center justify-center mx-auto mb-6">
                  {item.icon}
                </div>
                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center -mt-12">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">{item.title}</h3>
                <p className="text-sm text-navy-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 bg-navy-900 text-white noise-bg">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: '10K+', label: 'عميل نشط' },
              { number: '500K+', label: 'ملف مترجم' },
              { number: '11+', label: 'لغة مدعومة' },
              { number: '99.9%', label: 'وقت التشغيل' }
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-3xl md:text-4xl font-bold gradient-text-gold mb-2 stat-number">{stat.number}</div>
                <div className="text-sm text-navy-300">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold mb-4">
              <Award className="w-3 h-3" />
              الأسعار
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-navy-900 mb-4 font-display">
              خطط تناسب جميع الاحتياجات
            </h2>
            <p className="text-navy-500">
              ابدأ مجاناً وقم بالترقية حسب احتياجك
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: 'مجاني',
                price: '0',
                period: 'للأبد',
                desc: 'مثالي للتجربة الشخصية',
                features: ['5 ملفات شهرياً', 'حتى 10 صفحات', 'PDF فقط', 'دعم عبر البريد'],
                cta: 'ابدأ مجاناً',
                popular: false
              },
              {
                name: 'احترافي',
                price: '49',
                period: 'شهرياً',
                desc: 'للمترجمين والشركات الصغيرة',
                features: ['100 ملف شهرياً', 'صفحات غير محدودة', 'جميع صيغ التصدير', 'قاموس مخصص', 'دعم أولوية', 'سجل الترجمات'],
                cta: 'اشترك الآن',
                popular: true
              },
              {
                name: 'مؤسسات',
                price: '199',
                period: 'شهرياً',
                desc: 'للشركات الكبيرة والفرق',
                features: ['ملفات غير محدودة', 'API مخصص', 'فريق عمل متعدد', 'تكامل مع الأنظمة', 'مدير حساب خاص', 'SLA مضمون'],
                cta: 'تواصل معنا',
                popular: false
              }
            ].map((plan, idx) => (
              <div key={idx} className={`rounded-2xl p-6 ${plan.popular ? 'bg-navy-900 text-white ring-4 ring-emerald-500/20 scale-105' : 'bg-white border border-slate-200'}`}>
                {plan.popular && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-full mb-4">
                    <Star className="w-3 h-3" />
                    الأكثر شعبية
                  </div>
                )}
                <h3 className={`text-lg font-bold mb-1 ${plan.popular ? 'text-white' : 'text-navy-900'}`}>{plan.name}</h3>
                <p className={`text-sm mb-4 ${plan.popular ? 'text-navy-300' : 'text-navy-500'}`}>{plan.desc}</p>
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-navy-900'}`}>${plan.price}</span>
                  <span className={`text-sm ${plan.popular ? 'text-navy-300' : 'text-navy-500'}`}> / {plan.period}</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${plan.popular ? 'text-emerald-400' : 'text-emerald-500'}`} />
                      <span className={plan.popular ? 'text-navy-200' : 'text-navy-600'}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  plan.popular 
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                    : 'bg-navy-900 text-white hover:bg-navy-800'
                }`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-navy-900 to-navy-800 rounded-3xl p-8 md:p-12 text-center text-white relative overflow-hidden noise-bg">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl"></div>
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">
                ابدأ ترجمة مستنداتك اليوم
              </h2>
              <p className="text-navy-300 mb-8 max-w-xl mx-auto">
                انضم إلى آلاف الشركات التي تعتمد على LinguaDocs لترجمة مستنداتها بدقة واحترافية
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button className="px-8 py-4 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-all btn-shine">
                  ابدأ التجربة المجانية
                </button>
                <button className="px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20">
                  تحدث مع فريق المبيعات
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-950 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Languages className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display">LinguaDocs</h3>
                  <p className="text-[10px] text-navy-400 -mt-0.5">Professional Translation</p>
                </div>
              </div>
              <p className="text-sm text-navy-400 leading-relaxed">
                منصة الترجمة الاحترافية الأولى عربياً. نساعد الشركات والمترجمين على ترجمة مستنداتهم بدقة وسرعة.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">المنتج</h4>
              <ul className="space-y-2 text-sm text-navy-400">
                <li><a href="#" className="hover:text-white transition-colors">المميزات</a></li>
                <li><a href="#" className="hover:text-white transition-colors">الأسعار</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">التكاملات</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">الشركة</h4>
              <ul className="space-y-2 text-sm text-navy-400">
                <li><a href="#" className="hover:text-white transition-colors">من نحن</a></li>
                <li><a href="#" className="hover:text-white transition-colors">المدونة</a></li>
                <li><a href="#" className="hover:text-white transition-colors">الوظائف</a></li>
                <li><a href="#" className="hover:text-white transition-colors">تواصل معنا</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm">قانوني</h4>
              <ul className="space-y-2 text-sm text-navy-400">
                <li><a href="#" className="hover:text-white transition-colors">سياسة الخصوصية</a></li>
                <li><a href="#" className="hover:text-white transition-colors">شروط الاستخدام</a></li>
                <li><a href="#" className="hover:text-white transition-colors">الأمان</a></li>
                <li><a href="#" className="hover:text-white transition-colors">GDPR</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-navy-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-navy-500">
              © 2024 LinguaDocs. جميع الحقوق محفوظة.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center hover:bg-navy-700 transition-colors">
                <i className="fab fa-twitter text-sm text-navy-400"></i>
              </a>
              <a href="#" className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center hover:bg-navy-700 transition-colors">
                <i className="fab fa-linkedin text-sm text-navy-400"></i>
              </a>
              <a href="#" className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center hover:bg-navy-700 transition-colors">
                <i className="fab fa-github text-sm text-navy-400"></i>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Glossary Modal */}
      {showGlossary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowGlossary(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-navy-900">القاموس المخصص</h3>
                  <p className="text-xs text-navy-500">أضف مصطلحاتك الخاصة لضمان دقة الترجمة</p>
                </div>
              </div>
              <button onClick={() => setShowGlossary(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-navy-400" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {/* Add new entry */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newGlossarySource}
                  onChange={(e) => setNewGlossarySource(e.target.value)}
                  placeholder="المصطلح الأصلي"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <input
                  type="text"
                  value={newGlossaryTarget}
                  onChange={(e) => setNewGlossaryTarget(e.target.value)}
                  placeholder="الترجمة العربية"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <button
                  onClick={addGlossaryEntry}
                  className="px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Entries list */}
              {glossary.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-10 h-10 text-navy-200 mx-auto mb-3" />
                  <p className="text-sm text-navy-500">لا توجد مصطلحات مضافة بعد</p>
                  <p className="text-xs text-navy-400 mt-1">أضف مصطلحاتك لضمان ترجمة متسقة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {glossary.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-navy-900">{entry.source}</span>
                        <span className="text-navy-400 mx-2">→</span>
                        <span className="text-sm text-emerald-700 font-medium">{entry.target}</span>
                      </div>
                      <button
                        onClick={() => removeGlossaryEntry(entry.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-navy-500 text-center">
                💡 سيتم تطبيق المصطلحات تلقائياً أثناء الترجمة لضمان الثبات
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
