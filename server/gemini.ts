import { GoogleGenAI } from '@google/genai';
import { ParsedDoc } from './driveParser';
import { performLocalOCR } from './ocrEngine';

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is missing.');
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiInstance;
}

export interface AIConfig {
  provider: 'gemini' | 'custom';
  geminiModel?: string;
  customEndpoint?: string; // e.g. "http://localhost:11434/v1" or "http://192.168.1.50:8000/v1"
  customModelName?: string; // e.g. "llama3.3", "qwen2.5", "mistral"
  customApiKey?: string;
  temperature?: number;
}

export interface ChatQueryPayload {
  question: string;
  history: Array<{ role: 'user' | 'model'; content: string }>;
  documents: Array<ParsedDoc | { id: string; name: string; category?: string; content: string; summary?: string; folderPath?: string }>;
  filterCategory?: string;
  specificDocName?: string;
  aiConfig?: AIConfig;
}

export interface AIResponseOutput {
  answer: string;
  sources: Array<{
    fileId: string;
    fileName: string;
    category?: string;
    sectionOrClause?: string;
    snippet: string;
    folderPath?: string;
  }>;
  suggestedQuestions: string[];
}

/**
 * Call Private AI server using OpenAI-compatible /chat/completions standard.
 */
async function callCustomOpenAICompatibleServer(options: {
  endpoint: string;
  modelName: string;
  apiKey?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  responseFormatJson?: boolean;
  temperature?: number;
}): Promise<string> {
  let url = options.endpoint.trim();
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  if (!url.endsWith('/chat/completions')) {
    url = url.endsWith('/v1') ? `${url}/chat/completions` : `${url}/v1/chat/completions`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.apiKey && options.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${options.apiKey.trim()}`;
  }

  const payload: any = {
    model: options.modelName || 'llama3',
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
  };

  if (options.responseFormatJson) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Private AI server error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice || !choice.message) {
    throw new Error('Private AI server returned an empty or invalid response format.');
  }

  return choice.message.content || '';
}

/**
 * Unified generation function that routes to Gemini or Custom Private AI server.
 */
export async function generateContentWithFallback(options: {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
  aiConfig?: AIConfig;
}): Promise<string> {
  const config = options.aiConfig || { provider: 'gemini', geminiModel: 'gemini-3.7-flash' };

  if (config.provider === 'custom' && config.customEndpoint) {
    // Route to private AI server
    let promptContent = '';
    if (typeof options.contents === 'string') {
      promptContent = options.contents;
    } else if (Array.isArray(options.contents)) {
      promptContent = options.contents.map((c: any) => typeof c === 'string' ? c : JSON.stringify(c)).join('\n');
    } else if (options.contents?.parts) {
      promptContent = options.contents.parts
        .map((p: any) => p.text || '')
        .filter(Boolean)
        .join('\n');
    } else {
      promptContent = JSON.stringify(options.contents);
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: promptContent });

    return await callCustomOpenAICompatibleServer({
      endpoint: config.customEndpoint,
      modelName: config.customModelName || 'llama3',
      apiKey: config.customApiKey,
      messages,
      responseFormatJson: options.responseMimeType === 'application/json',
      temperature: options.temperature,
    });
  }

  // Otherwise route to Google Gemini
  const ai = getAI();
  const requestedModel = config.geminiModel || 'gemini-3.7-flash';
  
  // Supported Gemini candidate models
  const candidateModels = [
    requestedModel,
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-flash-latest',
  ].filter((v, i, a) => a.indexOf(v) === i);

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: {
          ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
          ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
          ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        },
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);

      // If prepayment credits are depleted or quota exhausted across the project, fail fast
      if (
        errMsg.includes('prepayment credits are depleted') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('Quota exceeded')
      ) {
        // Stop looping through other models on the same project since all will fail with 429
        throw new Error('Gemini API quota or credit limit reached (RESOURCE_EXHAUSTED).');
      }

      // If 404 / deprecated model, try next candidate
      if (errMsg.includes('404') || errMsg.includes('NOT_FOUND') || errMsg.includes('no longer available')) {
        continue;
      }

      // For other transient errors, try next model candidate
      continue;
    }
  }

  throw lastError || new Error('All Gemini candidate models failed to respond.');
}

export interface ExtractedImageData {
  title: string;
  category: 'bylaws' | 'minutes' | 'financials' | 'architectural' | 'rules' | 'general';
  textContent: string;
  summary: string;
  keyHighlights: string[];
  importantDatesOrAmounts: string[];
}

export async function extractTextAndDataFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  fileName: string = 'HOA Image Document.jpg',
  aiConfig?: AIConfig
): Promise<ExtractedImageData> {
  const cleanBase64 = imageBase64.includes(';base64,')
    ? imageBase64.split(';base64,')[1]
    : imageBase64;

  const imageBuffer = Buffer.from(cleanBase64, 'base64');

  // 1. Run local high-accuracy OCR directly on the image buffer
  console.log(`[OCR Engine] Performing OCR extraction on ${fileName} (${(imageBuffer.length / 1024).toFixed(1)} KB)...`);
  const ocrResult = await performLocalOCR(imageBuffer);
  const rawOcrText = ocrResult.rawText || '';
  console.log(`[OCR Engine] OCR completed for ${fileName}. Extracted ${rawOcrText.length} characters.`);

  // 2. Derive base category and title
  const lowerName = fileName.toLowerCase();
  let baseCategory: 'bylaws' | 'minutes' | 'financials' | 'architectural' | 'rules' | 'general' = 'general';
  if (lowerName.includes('minute') || lowerName.includes('meeting') || rawOcrText.toLowerCase().includes('minutes of') || rawOcrText.toLowerCase().includes('board meeting')) {
    baseCategory = 'minutes';
  } else if (lowerName.includes('budget') || lowerName.includes('finan') || lowerName.includes('balance sheet') || lowerName.includes('dues') || rawOcrText.toLowerCase().includes('income statement') || rawOcrText.toLowerCase().includes('balance sheet')) {
    baseCategory = 'financials';
  } else if (lowerName.includes('bylaw') || lowerName.includes('cc&r') || lowerName.includes('declaration')) {
    baseCategory = 'bylaws';
  } else if (lowerName.includes('arch') || lowerName.includes('arc') || lowerName.includes('design')) {
    baseCategory = 'architectural';
  } else if (lowerName.includes('rule') || lowerName.includes('regulation') || lowerName.includes('pool') || lowerName.includes('pet')) {
    baseCategory = 'rules';
  }

  // Extract dates and dollar amounts directly using regex
  const dollarMatches = (rawOcrText.match(/\$[\d,]+(?:\.\d{2})?/g) || []).slice(0, 8);
  const dateMatches = (rawOcrText.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}/gi) || []).slice(0, 8);
  const extractedDatesOrAmounts = Array.from(new Set([...dollarMatches, ...dateMatches]));

  // 3. If AI model is available (either Private LLM like Ollama or Gemini), let it structure the OCR text
  if (rawOcrText.length > 0) {
    try {
      const promptText = `You are an expert HOA records analyst and governance auditor.
Below is the raw text extracted via high-accuracy OCR from an HOA image record ("${fileName}"):

--- BEGIN OCR EXTRACTED TEXT ---
${rawOcrText}
--- END OCR EXTRACTED TEXT ---

Tasks:
1. Full Structure: Clean up, transcribe, and organize this text into structured GitHub Markdown (preserving all sections, tables, financial rows, names, decisions, and motions).
2. Categorization: Classify into one of: 'minutes', 'financials', 'bylaws', 'architectural', 'rules', 'general'.
3. Title: Create a professional title based on the content (e.g. "Board Meeting Minutes - Nov 2024").
4. Executive Summary: 2-3 sentence overview.
5. Key Highlights: 3-5 bullet points of actions, numbers, or rules.
6. Important Dates & Amounts: Specific dates and dollar figures.

Return ONLY valid JSON matching this schema:
{
  "title": "Descriptive Document Title",
  "category": "minutes" | "financials" | "bylaws" | "architectural" | "rules" | "general",
  "textContent": "# Document Title\\n\\nOrganized Markdown content with tables...",
  "summary": "2-3 sentence executive summary...",
  "keyHighlights": ["Highlight 1", "Highlight 2"],
  "importantDatesOrAmounts": ["$12,450 Reserve transfer", "Meeting held on October 14, 2024"]
}`;

      const text = await generateContentWithFallback({
        contents: promptText,
        responseMimeType: 'application/json',
        temperature: 0.1,
        aiConfig,
      });

      const cleanText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanText);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch {
            // ignore
          }
        }
      }

      if (parsed && (parsed.textContent || parsed.summary)) {
        const validCategories = ['bylaws', 'minutes', 'financials', 'architectural', 'rules', 'general'];
        const category = validCategories.includes(parsed.category) ? parsed.category : baseCategory;

        // Ensure that textContent contains the complete OCR transcript
        let finalContent = parsed.textContent || '';
        if (finalContent.length < rawOcrText.length * 0.5) {
          finalContent = `${finalContent}\n\n### Full OCR Document Transcript\n\n${rawOcrText}`;
        }

        return {
          title: parsed.title || fileName,
          category: category as any,
          textContent: finalContent || rawOcrText,
          summary: parsed.summary || `OCR extracted document from ${fileName}`,
          keyHighlights: Array.isArray(parsed.keyHighlights) && parsed.keyHighlights.length > 0 
            ? parsed.keyHighlights 
            : (ocrResult.lines.slice(0, 4)),
          importantDatesOrAmounts: Array.isArray(parsed.importantDatesOrAmounts) && parsed.importantDatesOrAmounts.length > 0
            ? parsed.importantDatesOrAmounts
            : extractedDatesOrAmounts,
        };
      }
    } catch (llmErr) {
      console.warn('[OCR Engine] LLM structure step had an error, using raw OCR text directly:', llmErr);
    }
  } else if (!aiConfig || aiConfig.provider === 'gemini') {
    // If local OCR produced no text but Gemini Vision is available, try Gemini Multimodal Vision
    try {
      const imagePart = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      };
      const promptText = `Extract and transcribe all text from this HOA image document "${fileName}". Convert tables to Markdown. Categorize into minutes, financials, bylaws, architectural, rules, general. Return JSON with title, category, textContent, summary, keyHighlights, importantDatesOrAmounts.`;

      const text = await generateContentWithFallback({
        contents: { parts: [imagePart, { text: promptText }] },
        responseMimeType: 'application/json',
        temperature: 0.1,
        aiConfig,
      });

      const cleanText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(cleanText || '{}');
      if (parsed.textContent) {
        return {
          title: parsed.title || fileName,
          category: parsed.category || baseCategory,
          textContent: parsed.textContent,
          summary: parsed.summary || `Extracted from ${fileName}`,
          keyHighlights: parsed.keyHighlights || [],
          importantDatesOrAmounts: parsed.importantDatesOrAmounts || [],
        };
      }
    } catch (gErr) {
      console.warn('[OCR Engine] Gemini Vision attempt failed:', gErr);
    }
  }

  // Fallback: If no LLM was used or LLM failed, format from raw OCR lines
  const cleanTitle = fileName.replace(/\.[^/.]+$/, '');
  const lines = ocrResult.lines;
  const topHighlights = lines.filter(l => l.length > 20).slice(0, 4);

  const formattedContent = rawOcrText.length > 0
    ? `# ${cleanTitle}\n\n**OCR Extracted Text from Image (${fileName}):**\n\n${rawOcrText}`
    : `# ${cleanTitle}\n\n[Image record uploaded. Text could not be detected automatically. Please ensure image is clear and legible.]`;

  return {
    title: fileName,
    category: baseCategory,
    textContent: formattedContent,
    summary: rawOcrText.length > 0 
      ? `OCR document (${fileName}) with ${lines.length} line(s) of text extracted.`
      : `Image file ${fileName} indexed for HOA library.`,
    keyHighlights: topHighlights.length > 0 ? topHighlights : ['Image document processed and indexed'],
    importantDatesOrAmounts: extractedDatesOrAmounts,
  };
}

/**
 * Intelligent Local Document Extraction Engine
 * Provides comprehensive, grounded answers directly from documents when cloud quota is limited.
 */
function localDocumentExtractionFallback(
  question: string,
  documents: Array<{ id: string; name: string; category?: string; content?: string; summary?: string; folderPath?: string }>,
  filterCategory?: string,
  noticeReason?: string
): AIResponseOutput {
  const qLower = question.toLowerCase();
  const keywords = qLower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length > 2 && !['what', 'when', 'where', 'which', 'who', 'how', 'does', 'have', 'from', 'this', 'that', 'with', 'about', 'our', 'the', 'and', 'for', 'are', 'can', 'should', 'would', 'could', 'tell'].includes(k));

  // Score documents based on keyword matching, category, and density
  const scoredDocs = documents.map(doc => {
    const content = doc.content || doc.summary || '';
    const contentLower = content.toLowerCase();
    const nameLower = doc.name.toLowerCase();

    let score = 0;
    const matchingSnippets: string[] = [];

    // Category boost
    if (filterCategory && filterCategory !== 'all' && doc.category === filterCategory) {
      score += 15;
    }

    // Name matching
    for (const kw of keywords) {
      if (nameLower.includes(kw)) {
        score += 20;
      }
    }

    // Highlights and dates matching
    const extraHighlights = ((doc as any).keyHighlights || []).concat((doc as any).importantDatesOrAmounts || []);
    for (const hl of extraHighlights) {
      if (typeof hl === 'string') {
        const hlLower = hl.toLowerCase();
        for (const kw of keywords) {
          if (hlLower.includes(kw)) {
            score += 12;
            matchingSnippets.push(hl);
          }
        }
      }
    }

    // Content sentence/paragraph extraction
    const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 20);
    for (const p of paragraphs) {
      const pLower = p.toLowerCase();
      let pScore = 0;
      for (const kw of keywords) {
        if (pLower.includes(kw)) {
          pScore += 5;
        }
      }
      if (pScore > 0) {
        score += pScore;
        matchingSnippets.push(p.trim());
      }
    }

    return {
      doc,
      score,
      snippets: matchingSnippets.slice(0, 4),
    };
  });

  scoredDocs.sort((a, b) => b.score - a.score);
  const topDocs = scoredDocs.filter(d => d.score > 0).slice(0, 4);
  const relevantDocs = topDocs.length > 0 ? topDocs : scoredDocs.slice(0, 3);

  // Extract key findings
  const findings: string[] = [];
  const sources: AIResponseOutput['sources'] = [];

  for (const item of relevantDocs) {
    const { doc, snippets } = item;
    const preview = snippets.length > 0 ? snippets.join('\n\n') : (doc.summary || (doc.content || '').slice(0, 350));
    
    findings.push(`#### 📄 ${doc.name} ${doc.folderPath ? `*(${doc.folderPath})*` : ''}\n${preview}`);

    sources.push({
      fileId: doc.id,
      fileName: doc.name,
      category: doc.category || 'general',
      sectionOrClause: 'Indexed Document Clause',
      folderPath: doc.folderPath,
      snippet: (snippets[0] || doc.summary || (doc.content || '').slice(0, 180)).slice(0, 200) + '...',
    });
  }

  const isQuota = noticeReason && (noticeReason.includes('quota') || noticeReason.includes('RESOURCE_EXHAUSTED') || noticeReason.includes('credits'));
  const quotaNotice = isQuota
    ? `> 💡 **Notice:** *Cloud AI credits/quota limit was reached. The response below was synthesized directly from your indexed documents using our local document matching engine. You can also connect a Private AI Server (Ollama / vLLM) in AI Settings.*`
    : '';

  const answer = `### HOA Records Analysis: "${question}"

${quotaNotice}

${findings.join('\n\n---\n\n')}

### Summary & Next Steps
- Clauses were located across your **${relevantDocs.length} matching HOA document${relevantDocs.length === 1 ? '' : 's'}**.
- Review the full text in your document viewer or confirm with the HOA Board of Directors / Property Management for formal applications.
`;

  return {
    answer,
    sources,
    suggestedQuestions: [
      `What are the late fee policies for assessments?`,
      `What are the short-term rental and leasing restrictions?`,
      `What is the procedure for submitting an architectural change (ARC)?`
    ],
  };
}

export async function askHOAChatbot(payload: ChatQueryPayload): Promise<AIResponseOutput> {
  if (!payload.documents || payload.documents.length === 0) {
    return {
      answer: "No HOA documents are currently indexed. Please connect Google Drive to select a folder, or upload Word, Excel, PDF, or image files.",
      sources: [],
      suggestedQuestions: [
        "How do I upload HOA documents?",
        "How do I connect Google Drive?",
        "What document formats are supported?"
      ]
    };
  }

  // Prepare context from available documents
  const docsContext = payload.documents.map((doc: any, idx: number) => {
    const truncatedContent = doc.content && doc.content.length > 50000 
      ? doc.content.slice(0, 50000) + '\n...[Content truncated for length]...'
      : (doc.content || doc.summary || '');

    const folderInfo = doc.folderPath ? ` | Location: ${doc.folderPath}` : '';

    return `=== DOCUMENT ${idx + 1}: ${doc.name} (ID: ${doc.id}, Category: ${doc.category || 'general'}${folderInfo}) ===\n${truncatedContent}\n=== END OF DOCUMENT ${idx + 1} ===\n`;
  }).join('\n\n');

  const systemInstruction = `You are the Official HOA Document AI Assistant. Your mission is to provide clear, reliable, and deeply grounded answers to homeowners, board members, tenants, and property managers regarding HOA governing documents, CC&Rs, bylaws, board meeting minutes, annual budgets, reserve studies, architectural guidelines (ARC), and community rules & regulations.

All provided documents have been parsed from the user's indexed Google Drive folder, MS Office files (Word/Excel/PowerPoint), PDFs, and OCR scans.

STRICT ACCURACY & CITATION RULES:
1. Ground your answer strictly in the provided indexed documents. If facts, rules, amounts, dates, or clauses exist in the text, quote or cite them explicitly (e.g., "[Bylaws Art. VI § 6.2]", "[June 2026 Minutes § 4.A]", "[2026 Budget Sheet 1]").
2. Format your response cleanly using GitHub-flavored Markdown:
   - Use bold key terms for scannability.
   - Use tables for financial breakdowns, spreadsheets, or schedules (e.g. dues amounts, budgets, fine tiers).
   - Use bullet points for checklists and steps.
   - Provide clear, direct "Bottom Line" conclusions first, followed by detailed document specifics and procedural requirements.
3. Distinguish clearly between mandatory rules (e.g. "Strictly prohibited", "Must submit written application") and recommendations or guidelines.
4. If a question cannot be definitively answered from the provided documents, state clearly what is known from the text, note what is missing, and recommend checking with the HOA Board of Directors or Property Management.
5. In addition to your main Markdown answer, you must provide structured source citations (with fileId, fileName, category, sectionOrClause, snippet, folderPath) and 3 highly relevant follow-up questions in the required JSON structure.`;

  const prompt = `Available HOA Documents:
${docsContext}

Previous Conversation History:
${payload.history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}

Current Question: "${payload.question}"
${payload.filterCategory && payload.filterCategory !== 'all' ? `(User specified category focus: ${payload.filterCategory})` : ''}
${payload.specificDocName ? `(Focused specifically on: ${payload.specificDocName})` : ''}

Respond with a JSON object matching this schema:
{
  "answer": "Your comprehensive, beautifully formatted Markdown answer with headings, tables, bullet points, and exact clause citations.",
  "sources": [
    {
      "fileId": "matching document id",
      "fileName": "matching document name",
      "category": "bylaws | minutes | financials | architectural | rules",
      "sectionOrClause": "e.g. Article VI, Section 6.2 or Meeting Minutes § 4.A",
      "folderPath": "subfolder or file location if known",
      "snippet": "exact or near-exact short excerpt from the document proving the answer"
    }
  ],
  "suggestedQuestions": [
    "Follow-up question 1",
    "Follow-up question 2",
    "Follow-up question 3"
  ]
}`;

  try {
    const text = await generateContentWithFallback({
      contents: prompt,
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: 0.2,
      aiConfig: payload.aiConfig,
    });

    const cleanText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    let parsed: any = null;
    try {
      parsed = JSON.parse(cleanText) as AIResponseOutput;
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]) as AIResponseOutput;
        } catch {
          // ignore
        }
      }
    }

    if (parsed && (parsed.answer || parsed.sources)) {
      return {
        answer: parsed.answer || cleanText,
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : [
          'What are the leasing rules for our HOA?',
          'What is the current monthly assessment dues amount?',
          'How do I submit an architectural change request?'
        ]
      };
    }

    // If private LLM outputted direct markdown text without JSON envelope, serve it directly!
    if (text && text.trim().length > 0 && !text.includes('RESOURCE_EXHAUSTED')) {
      const defaultSources = payload.documents.slice(0, 3).map((d: any) => ({
        fileId: d.id,
        fileName: d.name,
        category: d.category || 'general',
        sectionOrClause: 'HOA Document Reference',
        folderPath: d.folderPath,
        snippet: (d.content || d.summary || '').slice(0, 200) + '...',
      }));

      return {
        answer: text.trim(),
        sources: defaultSources,
        suggestedQuestions: [
          'What are the leasing rules for our HOA?',
          'What is the current monthly assessment dues amount?',
          'How do I submit an architectural change request?'
        ]
      };
    }

    return {
      answer: 'I could not find an answer in the provided documents.',
      sources: [],
      suggestedQuestions: [
        'What are the leasing rules for our HOA?',
        'What is the current monthly assessment dues amount?',
        'How do I submit an architectural change request?'
      ]
    };
  } catch (error: any) {
    return localDocumentExtractionFallback(
      payload.question,
      payload.documents as any,
      payload.filterCategory,
      error?.message || 'Quota rate limit'
    );
  }
}

export async function generateDocumentSummary(
  doc: { name: string; category?: string; content: string; summary?: string; folderPath?: string },
  aiConfig?: AIConfig
) {
  const truncatedContent = doc.content && doc.content.length > 30000 
    ? doc.content.slice(0, 30000) + '...' 
    : (doc.content || doc.summary || '');

  const folderInfo = (doc as any).folderPath ? `Location: ${(doc as any).folderPath}` : '';

  const prompt = `Analyze this HOA document:
Title: ${doc.name}
Category: ${doc.category || 'general'}
${folderInfo}
Content:
${truncatedContent}

Provide a concise executive summary formatted in JSON with:
{
  "executiveSummary": "2-3 sentence overview of what this document governs or records",
  "keyHighlights": ["Highlight 1 with section/number", "Highlight 2", "Highlight 3", "Highlight 4"],
  "importantDatesOrAmounts": ["e.g. Assessment: $325/mo", "Effective Date: ...", "Quorum: 33.3%"],
  "suggestedQueries": ["Question 1 you can ask about this doc", "Question 2", "Question 3"]
}`;

  try {
    const text = await generateContentWithFallback({
      contents: prompt,
      responseMimeType: 'application/json',
      temperature: 0.1,
      aiConfig,
    });

    const cleanText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(cleanText || '{}');
  } catch {
    // Extract numbers, dates, dollar amounts from content
    const content = doc.content || doc.summary || '';
    const dollarMatches = content.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
    const dateMatches = content.match(/(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}/g) || [];
    const datesAndAmounts = Array.from(new Set([...dollarMatches.slice(0, 4), ...dateMatches.slice(0, 4)]));

    // Extract first sentences/paragraphs
    const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 30);
    const keyHighlights = paragraphs.slice(0, 4).map(p => p.trim().slice(0, 160) + '...');

    return {
      executiveSummary: doc.summary || `Governance document (${doc.name}) covering HOA policies, operations, or finances in ${doc.folderPath || 'the library'}.`,
      keyHighlights: keyHighlights.length > 0 ? keyHighlights : [
        'Document indexed and available for search',
        `Category: ${doc.category || 'General HOA Record'}`,
        `Location: ${doc.folderPath || 'HOA Library'}`
      ],
      importantDatesOrAmounts: datesAndAmounts.length > 0 ? datesAndAmounts : ['See document text for specific figures'],
      suggestedQueries: [
        `What are the main rules in ${doc.name}?`,
        'What are the board requirements or voting procedures?',
        'What are the penalties or fees mentioned?'
      ]
    };
  }
}

/**
 * Test connectivity to a private AI server or Gemini model
 */
export async function testAIConnection(config: AIConfig): Promise<{ success: boolean; message: string; availableModels?: string[] }> {
  if (config.provider === 'custom') {
    if (!config.customEndpoint || !config.customEndpoint.trim()) {
      return { success: false, message: 'Please provide an HTTP address for your private AI server (e.g. http://localhost:11434/v1).' };
    }

    let baseUrl = config.customEndpoint.trim();
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    // Try fetching /models or /v1/models if supported
    let availableModels: string[] = [];
    const modelsUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
    const headers: Record<string, string> = {};
    if (config.customApiKey && config.customApiKey.trim()) {
      headers['Authorization'] = `Bearer ${config.customApiKey.trim()}`;
    }

    try {
      const modelRes = await fetch(modelsUrl, { headers, method: 'GET' });
      if (modelRes.ok) {
        const data = await modelRes.json();
        if (Array.isArray(data.data)) {
          availableModels = data.data.map((m: any) => m.id || m.name).filter(Boolean);
        }
      }
    } catch {
      // It's okay if /models is not supported, we will test chat completion
    }

    try {
      const testRes = await callCustomOpenAICompatibleServer({
        endpoint: baseUrl,
        modelName: config.customModelName || 'llama3',
        apiKey: config.customApiKey,
        messages: [{ role: 'user', content: 'Respond with the single word "ONLINE"' }],
        temperature: 0.1,
      });

      return {
        success: true,
        message: `Successfully connected to private AI server! Response: ${testRes.trim().slice(0, 100)}`,
        availableModels: availableModels.length > 0 ? availableModels : undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Connection failed: ${err.message || 'Could not reach server endpoint'}. Ensure the server is running and accessible.`,
      };
    }
  }

  // Gemini test
  try {
    const ai = getAI();
    const model = config.geminiModel || 'gemini-3.7-flash';
    const res = await ai.models.generateContent({
      model,
      contents: 'Say OK',
    });
    return {
      success: true,
      message: `Successfully connected to Google Gemini (${model})! Response: ${res.text || 'OK'}`,
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('prepayment')) {
      return {
        success: false,
        message: `Gemini API Quota/Credit limit reached (429 Resource Exhausted). You can configure a Private AI Server (e.g. Ollama, LM Studio) or try again later.`,
      };
    }
    return {
      success: false,
      message: `Gemini API error: ${errMsg}`,
    };
  }
}
