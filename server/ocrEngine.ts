import Tesseract from 'tesseract.js';

export interface OcrResult {
  rawText: string;
  confidence: number;
  lines: string[];
}

/**
 * Perform high-accuracy local OCR on image buffers (JPG, PNG, WebP, BMP, TIFF)
 * Runs directly on the server without needing external APIs or vision models.
 */
export async function performLocalOCR(imageBuffer: Buffer): Promise<OcrResult> {
  try {
    const result = await Tesseract.recognize(
      imageBuffer,
      'eng',
      {
        errorHandler: (err) => console.warn('[Tesseract OCR] Notice:', err),
      }
    );

    const rawText = (result.data?.text || '').trim();
    const confidence = result.data?.confidence || 0;
    const lines = ((result.data as any)?.lines || [])
      .map((l: any) => (typeof l.text === 'string' ? l.text.trim() : ''))
      .filter((l: string) => l.length > 0);

    const fallbackLines = lines.length > 0 ? lines : rawText.split('\n').map(l => l.trim()).filter(Boolean);

    return {
      rawText,
      confidence,
      lines: fallbackLines,
    };
  } catch (err: any) {
    console.error('[Tesseract OCR] Error executing OCR:', err);
    return {
      rawText: '',
      confidence: 0,
      lines: [],
    };
  }
}
