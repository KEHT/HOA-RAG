import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import WordExtractor from 'word-extractor';

export interface OfficeParseResult {
  text: string;
  pageOrSheetCount?: number;
  tables?: string[];
  summarySnippet?: string;
}

const wordExtractor = new WordExtractor();

/**
 * Helper to clean extracted text
 */
function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\x20-\x7E\n\t\u00A0-\u024F\u2010-\u202F]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse MS Word (.docx, .doc) files
 */
export async function parseWordDocument(buffer: Buffer): Promise<OfficeParseResult> {
  // Check if file starts with standard ZIP signature (PK\x03\x04) -> DOCX
  const isZipDocx = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
  // Check if file starts with OLE Compound File signature (\xD0\xCF\x11\xE0) -> Legacy DOC
  const isOleDoc = buffer.length >= 4 && buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;

  if (isZipDocx) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = cleanExtractedText(result.value || '');
      if (text.length > 0) {
        return {
          text,
          summarySnippet: text.slice(0, 300),
        };
      }
    } catch {
      // If mammoth failed on docx, continue to wordExtractor fallback
    }
  }

  // Attempt extraction using WordExtractor (works for binary .doc and structured Word files)
  try {
    const extracted = await wordExtractor.extract(buffer);
    const body = extracted.getBody() || '';
    const headers = extracted.getHeaders() || '';
    const footers = extracted.getFooters() || '';
    const combined = cleanExtractedText(`${headers}\n${body}\n${footers}`);

    if (combined.length > 20) {
      return {
        text: combined,
        summarySnippet: combined.slice(0, 300),
      };
    }
  } catch {
    // Continue to fallback
  }

  // Clean ASCII/UTF-8 string extraction fallback
  const cleaned = cleanExtractedText(buffer.toString('utf-8'));
  return {
    text: cleaned.slice(0, 200000),
    summarySnippet: cleaned.slice(0, 300),
  };
}

/**
 * Parse MS Excel (.xlsx, .xls, .csv) files
 */
export async function parseExcelSpreadsheet(buffer: Buffer): Promise<OfficeParseResult> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames || [];
    let combinedText = '';
    const tables: string[] = [];

    for (const name of sheetNames) {
      const worksheet = workbook.Sheets[name];
      if (!worksheet) continue;

      const csvData = XLSX.utils.sheet_to_csv(worksheet);
      if (csvData && csvData.trim().length > 0) {
        combinedText += `\n### Sheet: ${name}\n\n${csvData}\n`;
        tables.push(`Sheet: ${name} (${csvData.split('\n').length} rows)`);
      }
    }

    const text = cleanExtractedText(combinedText);
    return {
      text,
      pageOrSheetCount: sheetNames.length,
      tables,
      summarySnippet: text.slice(0, 300),
    };
  } catch (err: any) {
    console.error('Failed to parse Excel spreadsheet:', err);
    throw new Error(`Excel parsing error: ${err.message}`);
  }
}

/**
 * Parse MS PowerPoint (.pptx) or general slide files
 */
export async function parsePowerPointPresentation(buffer: Buffer): Promise<OfficeParseResult> {
  try {
    const str = buffer.toString('utf-8');
    const matches = str.match(/<a:t>([^<]+)<\/a:t>/g) || [];
    if (matches.length > 0) {
      const slideText = matches.map(m => m.replace(/<\/?a:t>/g, '')).join(' ');
      const text = cleanExtractedText(slideText);
      return {
        text,
        summarySnippet: text.slice(0, 300),
      };
    }

    const fallback = cleanExtractedText(buffer.toString('utf-8'));
    return {
      text: fallback.slice(0, 100000),
      summarySnippet: fallback.slice(0, 300),
    };
  } catch (err: any) {
    console.error('Failed to parse PowerPoint:', err);
    throw new Error(`PowerPoint parsing error: ${err.message}`);
  }
}

/**
 * Parse PDF files
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<OfficeParseResult> {
  const uint8Data = new Uint8Array(buffer);
  const parser = new PDFParse({ data: uint8Data });
  try {
    const textResult = await parser.getText();
    const text = cleanExtractedText(textResult.text || '');
    return {
      text,
      summarySnippet: text.slice(0, 300),
    };
  } finally {
    await parser.destroy();
  }
}
