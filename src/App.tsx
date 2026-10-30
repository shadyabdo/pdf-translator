import { useState, useCallback, useRef } from 'react';
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
  Eye
} from 'lucide-react';
import { 
  extractPdfContent, 
  translatePages, 
  generateTranslatedPdf, 
  downloadPdf,
  type TranslationProgress,
  type PageData
} from './services/pdfService';

type AppState = 'idle' | 'uploading' | 'extracting' | 'translating' | 'generating' | 'done' | 'error';

function App() {
  const [state, setState] = useState<AppState>('idle');
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [fileName, setFileName] = useState('');
  const [translatedPdfBytes, setTranslatedPdfBytes] = useState<Uint8Array | null>(null);
  const [previewPages, setPreviewPages] = useState<PageData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    try {
      // Step 1: Extract content
      const { pages, pdfBytes } = await extractPdfContent(file, handleProgress);
      setPreviewPages(pages);

      // Step 2: Translate
      const translatedPages = await translatePages(pages, handleProgress);

      // Step 3: Generate PDF
      const resultBytes = await generateTranslatedPdf(translatedPages, pdfBytes, handleProgress);
      
      setTranslatedPdfBytes(resultBytes);
      setState('done');
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
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDownload = () => {
    if (translatedPdfBytes) {
      const newName = fileName.replace('.pdf', '_معرب.pdf');
      downloadPdf(translatedPdfBytes, newName);
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getProgressPercentage = () => {
    if (!progress) return 0;
    if (progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const getStageLabel = () => {
    switch (state) {
      case 'uploading': return 'جاري رفع الملف...';
      case 'extracting': return 'جاري استخراج المحتوى...';
      case 'translating': return 'جاري الترجمة من اليابانية إلى العربية...';
      case 'generating': return 'جاري إنشاء ملف PDF المترجم...';
      case 'done': return 'تمت الترجمة بنجاح!';
      case 'error': return 'حدث خطأ';
      default: return '';
    }
  };

  const getStageIcon = () => {
    switch (state) {
      case 'done': return <CheckCircle2 className="w-8 h-8 text-green-400" />;
      case 'error': return <AlertCircle className="w-8 h-8 text-red-400" />;
      default: return <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 pt-8 pb-4 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center float-animation">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
              مترجم الروايات الخفيفة
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            ترجم رواياتك الخفيفة المفضلة من اليابانية إلى العربية مع الحفاظ على الصور
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm border border-indigo-500/30">
              🇯🇵 ياباني
            </span>
            <Languages className="w-4 h-4 text-purple-400" />
            <span className="px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-sm border border-pink-500/30">
              عربي 🇸🇦
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          {/* Upload Section */}
          {state === 'idle' && (
            <div className="glass-card rounded-2xl p-8 glow-border">
              <div
                className={`upload-zone rounded-xl p-12 text-center cursor-pointer transition-all ${
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
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center pulse-glow">
                    <FileUp className="w-10 h-10 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      ارفع ملف PDF هنا
                    </h3>
                    <p className="text-gray-400">
                      اسحب الملف وأفلته أو اضغط لاختيار ملف
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      الحد الأقصى لحجم الملف: 50 ميجابايت
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-gray-400">
                      يدعم النصوص اليابانية مع الحفاظ على الصور
                    </span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="text-center p-4 rounded-xl bg-white/5">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center mx-auto mb-3">
                    <FileUp className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h4 className="text-white font-medium text-sm">رفع سهل</h4>
                  <p className="text-gray-500 text-xs mt-1">اسحب وأفلت أو اضغط</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/5">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                    <Languages className="w-5 h-5 text-purple-400" />
                  </div>
                  <h4 className="text-white font-medium text-sm">ترجمة ذكية</h4>
                  <p className="text-gray-500 text-xs mt-1">ترجمة دقيقة من اليابانية</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/5">
                  <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center mx-auto mb-3">
                    <FileDown className="w-5 h-5 text-pink-400" />
                  </div>
                  <h4 className="text-white font-medium text-sm">تحميل فوري</h4>
                  <p className="text-gray-500 text-xs mt-1">PDF معرّب جاهز للتحميل</p>
                </div>
              </div>
            </div>
          )}

          {/* Processing Section */}
          {(state === 'uploading' || state === 'extracting' || state === 'translating' || state === 'generating') && (
            <div className="glass-card rounded-2xl p-8 glow-border">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-6">
                  {getStageIcon()}
                  <h3 className="text-xl font-semibold text-white">{getStageLabel()}</h3>
                </div>
                
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                    <span>{progress?.message}</span>
                    <span>{getProgressPercentage()}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="progress-bar h-full rounded-full transition-all duration-300"
                      style={{ width: `${getProgressPercentage()}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-6 mt-6 text-sm">
                  <div className={`flex items-center gap-2 ${state === 'extracting' ? 'text-indigo-400' : (state as string) === 'translating' || (state as string) === 'generating' || (state as string) === 'done' ? 'text-green-400' : 'text-gray-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${state === 'extracting' ? 'bg-indigo-400 animate-pulse' : 'bg-green-400'}`}></div>
                    <span>الاستخراج</span>
                  </div>
                  <div className={`flex items-center gap-2 ${state === 'translating' ? 'text-purple-400' : (state as string) === 'generating' || (state as string) === 'done' ? 'text-green-400' : 'text-gray-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${state === 'translating' ? 'bg-purple-400 animate-pulse' : (state as string) === 'generating' || (state as string) === 'done' ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                    <span>الترجمة</span>
                  </div>
                  <div className={`flex items-center gap-2 ${state === 'generating' ? 'text-pink-400' : (state as string) === 'done' ? 'text-green-400' : 'text-gray-600'}`}>
                    <div className={`w-2 h-2 rounded-full ${state === 'generating' ? 'bg-pink-400 animate-pulse' : (state as string) === 'done' ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                    <span>الإنشاء</span>
                  </div>
                </div>

                <p className="text-gray-500 text-sm mt-4">
                  <span className="text-indigo-300">📄</span> {fileName}
                </p>
              </div>
            </div>
          )}

          {/* Done Section */}
          {state === 'done' && (
            <div className="glass-card rounded-2xl p-8 glow-border">
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">تمت الترجمة بنجاح! ✨</h3>
                <p className="text-gray-400">
                  تم ترجمة <span className="text-indigo-300">{fileName}</span> من اليابانية إلى العربية
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50"
                >
                  <Download className="w-5 h-5" />
                  تحميل النسخة المعربة
                </button>
                
                {previewPages.length > 0 && (
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-3 px-6 py-4 bg-white/10 rounded-xl text-white font-medium hover:bg-white/20 transition-all border border-white/10"
                  >
                    <Eye className="w-5 h-5" />
                    {showPreview ? 'إخفاء المعاينة' : 'معاينة المحتوى'}
                  </button>
                )}

                <button
                  onClick={handleReset}
                  className="flex items-center gap-3 px-6 py-4 bg-white/5 rounded-xl text-gray-300 font-medium hover:bg-white/10 transition-all border border-white/10"
                >
                  <RotateCcw className="w-5 h-5" />
                  ترجمة ملف آخر
                </button>
              </div>

              {/* Preview Section */}
              {showPreview && previewPages.length > 0 && (
                <div className="mt-8 max-h-96 overflow-y-auto rounded-xl bg-black/30 p-4 border border-white/10">
                  <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                    معاينة المحتوى المستخرج ({previewPages.length} صفحة)
                  </h4>
                  {previewPages.map((page, idx) => (
                    <div key={idx} className="page-preview">
                      <div className="flex items-center gap-2 mb-2 border-b border-gray-200 pb-2">
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                          صفحة {page.pageNumber}
                        </span>
                        <span className="text-xs text-gray-500">
                          {page.textItems.length} عنصر نصي
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 leading-relaxed" dir="rtl">
                        {page.textItems.map((item, i) => (
                          <span key={i} className="inline-block ml-2 mb-1">
                            {item.text}
                          </span>
                        ))}
                        {page.textItems.length === 0 && (
                          <p className="text-gray-400 italic">لا يوجد نص في هذه الصفحة (صور فقط)</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error Section */}
          {state === 'error' && (
            <div className="glass-card rounded-2xl p-8 glow-border">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-10 h-10 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">حدث خطأ</h3>
                <p className="text-gray-400 mb-6">{errorMessage}</p>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all mx-auto"
                >
                  <RotateCcw className="w-5 h-5" />
                  المحاولة مرة أخرى
                </button>
              </div>
            </div>
          )}

          {/* Info Section */}
          {state === 'idle' && (
            <div className="mt-8 glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                كيف يعمل الموقع؟
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-sm">1</span>
                  <div>
                    <h4 className="text-white text-sm font-medium">ارفع ملف PDF</h4>
                    <p className="text-gray-500 text-xs mt-1">ارفع ملف الرواية الخفيفة بصيغة PDF</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-sm">2</span>
                  <div>
                    <h4 className="text-white text-sm font-medium">استخراج المحتوى</h4>
                    <p className="text-gray-500 text-xs mt-1">يتم استخراج النصوص والصور تلقائياً</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-300 font-bold text-sm">3</span>
                  <div>
                    <h4 className="text-white text-sm font-medium">الترجمة التلقائية</h4>
                    <p className="text-gray-500 text-xs mt-1">يتم ترجمة النصوص من اليابانية إلى العربية</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-300 font-bold text-sm">4</span>
                  <div>
                    <h4 className="text-white text-sm font-medium">تحميل النتيجة</h4>
                    <p className="text-gray-500 text-xs mt-1">حمّل النسخة المعربة مع الصور الأصلية</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-gray-500 text-sm">
        <p>مترجم الروايات الخفيفة 🌸 Light Novel Translator</p>
        <p className="mt-1 text-xs text-gray-600">يدعم الروايات الخفيفة اليابانية - ترجمة تلقائية من اليابانية إلى العربية</p>
      </footer>
    </div>
  );
}

export default App;
