import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { translateText } from './translationService';

// Fetch a font that supports Arabic characters
async function fetchArabicFont(): Promise<ArrayBuffer> {
  try {
    // Use Noto Sans Arabic from Google Fonts
    const response = await fetch(
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf'
    );
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch (e) {
    console.warn('Could not fetch Arabic font, will use fallback');
  }
  return null as unknown as ArrayBuffer;
}

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface PageData {
  pageNumber: number;
  textItems: TextItem[];
  images: ImageData[];
  width: number;
  height: number;
}

export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

export interface ImageData {
  data: Uint8Array;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TranslationProgress {
  stage: 'extracting' | 'translating' | 'generating';
  current: number;
  total: number;
  message: string;
}

export async function extractPdfContent(
  file: File,
  onProgress?: (progress: TranslationProgress) => void
): Promise<{ pages: PageData[]; pdfBytes: ArrayBuffer }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfBytes = arrayBuffer.slice(0);
  
  onProgress?.({
    stage: 'extracting',
    current: 0,
    total: 1,
    message: 'جاري تحميل الملف...'
  });

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const pages: PageData[] = [];

  for (let i = 1; i <= numPages; i++) {
    onProgress?.({
      stage: 'extracting',
      current: i,
      total: numPages,
      message: `جاري استخراج الصفحة ${i} من ${numPages}...`
    });

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    
    const textContent = await page.getTextContent();
    const textItems: TextItem[] = textContent.items
      .filter((item: any) => item.str && item.str.trim().length > 0)
      .map((item: any) => ({
        text: item.str,
        x: item.transform[4],
        y: viewport.height - item.transform[5],
        width: item.width,
        height: item.height || 12,
        fontSize: Math.abs(item.transform[0]) || 12,
        fontName: item.fontName || ''
      }));

    // Extract images from the page
    const images: ImageData[] = [];
    try {
      const operatorList = await page.getOperatorList();
      const ops = operatorList;
      
      // Get page canvas for image extraction
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      
      await page.render({ canvasContext: ctx, viewport }).promise;
      
      // Store the rendered page as an image
      const imageData = canvas.toDataURL('image/png');
      const response = await fetch(imageData);
      const blob = await response.blob();
      const imgBuffer = await blob.arrayBuffer();
      
      images.push({
        data: new Uint8Array(imgBuffer),
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height
      });
    } catch (e) {
      console.warn('Could not extract images from page', i, e);
    }

    pages.push({
      pageNumber: i,
      textItems,
      images,
      width: viewport.width,
      height: viewport.height
    });
  }

  return { pages, pdfBytes };
}

export async function translatePages(
  pages: PageData[],
  onProgress?: (progress: TranslationProgress) => void
): Promise<PageData[]> {
  const translatedPages: PageData[] = [];
  const totalTextItems = pages.reduce((sum, p) => sum + p.textItems.length, 0);
  let completedItems = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const translatedTextItems: TextItem[] = [];

    for (const item of page.textItems) {
      onProgress?.({
        stage: 'translating',
        current: completedItems,
        total: totalTextItems,
        message: `جاري ترجمة النص... (${completedItems}/${totalTextItems})`
      });

      const translated = await translateText(item.text, 'ja', 'ar');
      translatedTextItems.push({
        ...item,
        text: translated
      });
      
      completedItems++;
    }

    translatedPages.push({
      ...page,
      textItems: translatedTextItems
    });
  }

  return translatedPages;
}

export async function generateTranslatedPdf(
  translatedPages: PageData[],
  originalPdfBytes: ArrayBuffer,
  onProgress?: (progress: TranslationProgress) => void
): Promise<Uint8Array> {
  onProgress?.({
    stage: 'generating',
    current: 0,
    total: translatedPages.length,
    message: 'جاري إنشاء الملف المترجم...'
  });

  // Load the original PDF to preserve images
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  
  // Try to embed a font that supports Arabic
  pdfDoc.registerFontkit(fontkit);
  
  let arabicFont = null;
  let helveticaFont;
  
  // Try to load Arabic font
  try {
    const fontBuffer = await fetchArabicFont();
    if (fontBuffer) {
      arabicFont = await pdfDoc.embedFont(fontBuffer);
    }
  } catch (e) {
    console.warn('Could not embed Arabic font');
  }
  
  // Fallback to Helvetica
  try {
    helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  } catch (e) {
    helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }
  
  // Use Arabic font if available, otherwise fallback
  const textFont = arabicFont || helveticaFont;

  const pages = pdfDoc.getPages();
  
  for (let i = 0; i < pages.length && i < translatedPages.length; i++) {
    onProgress?.({
      stage: 'generating',
      current: i + 1,
      total: translatedPages.length,
      message: `جاري معالجة الصفحة ${i + 1} من ${translatedPages.length}...`
    });

    const page = pages[i];
    const translatedPage = translatedPages[i];
    const { width, height } = page.getSize();

    // Add white background overlay for text areas
    if (translatedPage.textItems.length > 0) {
      // Draw semi-transparent white rectangles behind text
      for (const item of translatedPage.textItems) {
        page.drawRectangle({
          x: item.x - 2,
          y: height - item.y - item.height - 2,
          width: Math.max(item.width + 4, 50),
          height: item.height + 4,
          color: rgb(1, 1, 1),
          opacity: 0.9
        });
      }

      // Draw translated text
      for (const item of translatedPage.textItems) {
        const fontSize = Math.min(item.fontSize * 0.85, 14);
        let textWidth: number;
        try {
          textWidth = textFont.widthOfTextAtSize(item.text, fontSize);
        } catch (e) {
          textWidth = item.width;
        }
        
        // Adjust position for RTL text
        const adjustedX = Math.max(item.x, item.x + item.width - textWidth);
        
        try {
          page.drawText(item.text, {
            x: adjustedX,
            y: height - item.y - item.height,
            size: fontSize,
            font: textFont,
            color: rgb(0.1, 0.1, 0.1)
          });
        } catch (e) {
          // If text can't be drawn (unsupported characters), try with helvetica
          try {
            page.drawText(item.text, {
              x: adjustedX,
              y: height - item.y - item.height,
              size: fontSize,
              font: helveticaFont,
              color: rgb(0.1, 0.1, 0.1)
            });
          } catch (e2) {
            console.warn('Could not draw text:', item.text.substring(0, 20));
          }
        }
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
