// Translation service using MyMemory API (free)
export async function translateText(text: string, from: string = 'ja', to: string = 'ar'): Promise<string> {
  if (!text || text.trim().length === 0) return text;
  
  // Split long texts into chunks (API has character limit)
  const chunks = splitTextIntoChunks(text, 500);
  const translatedChunks: string[] = [];
  
  for (const chunk of chunks) {
    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${from}|${to}`
      );
      
      if (!response.ok) {
        console.warn(`Translation API error for chunk, using fallback`);
        translatedChunks.push(chunk);
        continue;
      }
      
      const data = await response.json();
      
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        translatedChunks.push(data.responseData.translatedText);
      } else {
        // Fallback: return original text
        translatedChunks.push(chunk);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.warn('Translation error:', error);
      translatedChunks.push(chunk);
    }
  }
  
  return translatedChunks.join(' ');
}

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[。！？\n])/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks.length > 0 ? chunks : [text];
}

export async function translateBatch(
  texts: string[],
  from: string = 'ja',
  to: string = 'ar',
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
  const results: string[] = [];
  
  for (let i = 0; i < texts.length; i++) {
    const translated = await translateText(texts[i], from, to);
    results.push(translated);
    onProgress?.(i + 1, texts.length);
  }
  
  return results;
}
