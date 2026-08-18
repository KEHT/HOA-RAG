import { GoogleGenAI } from '@google/genai';
import { StoredDocument } from './sampleDocuments';
import { ParsedDoc } from './driveParser';

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

export interface ChatQueryPayload {
  question: string;
  history: Array<{ role: 'user' | 'model'; content: string }>;
  documents: Array<StoredDocument | ParsedDoc>;
  filterCategory?: string;
  specificDocName?: string;
}

export interface AIResponseOutput {
  answer: string;
  sources: Array<{
    fileId: string;
    fileName: string;
    category?: string;
    sectionOrClause?: string;
    snippet: string;
  }>;
  suggestedQuestions: string[];
}

// Helper to generate content with model fallback and retry for high-demand spikes
async function generateContentWithFallback(options: {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
}): Promise<string> {
  const ai = getAI();
  const candidateModels = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
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
        const isTransient = errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('RESOURCE_EXHAUSTED');
        
        console.warn(`[Gemini API] Call to model ${model} (attempt ${attempt + 1}) failed:`, errMsg);

        if (isTransient && attempt === 0) {
          // Short backoff before retrying same model
          await new Promise((resolve) => setTimeout(resolve, 800));
        } else {
          // Break to next candidate model
          break;
        }
      }
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
  fileName: string = 'HOA Image Document.jpg'
): Promise<ExtractedImageData> {
  const cleanBase64 = imageBase64.includes(';base64,')
    ? imageBase64.split(';base64,')[1]
    : imageBase64;

  const imagePart = {
    inlineData: {
      mimeType: mimeType || 'image/jpeg',
      data: cleanBase64,
    },
  };

  const promptText = `You are an expert HOA records analyst, OCR engine, and financial auditor.
Analyze this photo/scan of an HOA record (e.g. board meeting minutes notes, balance sheet, financial audit, ARC architectural form, dues notice, or vendor invoice).

File name: "${fileName}".

Tasks:
1. Full OCR & Structure: Extract all printed or handwritten text with maximum accuracy. Convert financial figures, tables, and agendas into clean GitHub Markdown tables or formatted lists.
2. Categorization: Classify into one of: 'minutes', 'financials', 'bylaws', 'architectural', 'rules', 'general'.
3. Title: Create a professional, descriptive title (e.g. "Board Meeting Minutes - Nov 2024" or "2026 Operating Budget Balance Sheet").
4. Executive Summary: 2-3 sentence overview of what is documented.
5. Key Highlights: 3-5 bullet points of motions passed, policies approved, or amounts stated.
6. Important Dates & Amounts: Specific dates, deadlines, dollar figures, and account balances found.

Return ONLY valid JSON matching this schema:
{
  "title": "Descriptive Document Title",
  "category": "minutes" | "financials" | "bylaws" | "architectural" | "rules" | "general",
  "textContent": "# Document Title\\n\\nTranscribed markdown content with tables and sections...",
  "summary": "2-3 sentence summary of the image document...",
  "keyHighlights": ["Highlight 1", "Highlight 2"],
  "importantDatesOrAmounts": ["$12,450 Reserve transfer", "Meeting held on October 14, 2024"]
}`;

  try {
    const text = await generateContentWithFallback({
      contents: {
        parts: [imagePart, { text: promptText }],
      },
      responseMimeType: 'application/json',
      temperature: 0.1,
    });

    const parsed = JSON.parse(text || '{}');
    const validCategories = ['bylaws', 'minutes', 'financials', 'architectural', 'rules', 'general'];
    const category = validCategories.includes(parsed.category) ? parsed.category : 'general';

    return {
      title: parsed.title || fileName || 'Parsed HOA Image Document',
      category: category as any,
      textContent: parsed.textContent || `[Extracted text from ${fileName}]`,
      summary: parsed.summary || `Image document parsed from ${fileName}`,
      keyHighlights: Array.isArray(parsed.keyHighlights) ? parsed.keyHighlights : ['Transcribed from image record'],
      importantDatesOrAmounts: Array.isArray(parsed.importantDatesOrAmounts) ? parsed.importantDatesOrAmounts : [],
    };
  } catch (err: any) {
    console.error(`Error in extractTextAndDataFromImage for ${fileName}:`, err);
    return {
      title: fileName || 'HOA Image Document',
      category: fileName.toLowerCase().includes('minute') ? 'minutes' : (fileName.toLowerCase().includes('budget') || fileName.toLowerCase().includes('finan') ? 'financials' : 'general'),
      textContent: `## Document: ${fileName}\n\n[Note: Image OCR processing encountered a transient error: ${err.message || 'Unknown'}. Document added to index.]`,
      summary: `Image file ${fileName} uploaded and indexed for HOA queries.`,
      keyHighlights: ['Image document uploaded to HOA library'],
      importantDatesOrAmounts: [],
    };
  }
}

export async function askHOAChatbot(payload: ChatQueryPayload): Promise<AIResponseOutput> {
  // Prepare context from available documents
  const docsContext = payload.documents.map((doc, idx) => {
    // Truncate document if exceedingly large to fit comfortably in token budget
    const truncatedContent = doc.content.length > 50000 
      ? doc.content.slice(0, 50000) + '\n...[Content truncated for length]...'
      : doc.content;

    return `=== DOCUMENT ${idx + 1}: ${doc.name} (ID: ${doc.id}, Category: ${doc.category || 'general'}) ===\n${truncatedContent}\n=== END OF DOCUMENT ${idx + 1} ===\n`;
  }).join('\n\n');

  const systemInstruction = `You are the Official HOA Document AI Assistant. Your mission is to provide clear, reliable, and deeply grounded answers to homeowners, board members, tenants, and property managers regarding HOA governing documents, CC&Rs, bylaws, board meeting minutes, annual budgets, reserve studies, architectural guidelines (ARC), and community rules & regulations.

STRICT ACCURACY & CITATION RULES:
1. Ground your answer in the provided documents. If facts, rules, amounts, dates, or clauses exist in the text, quote or cite them explicitly (e.g., "[Bylaws Art. VI § 6.2]", "[June 2026 Minutes § 4.A]", "[2026 Budget Section 2]").
2. Format your response cleanly using GitHub-flavored Markdown:
   - Use bold key terms for scannability.
   - Use tables for financial breakdowns or schedules (e.g. dues amounts, budgets, fine tiers).
   - Use bullet points for checklists and steps.
   - Provide clear, direct "Bottom Line" conclusions first, followed by detailed document specifics and procedural requirements.
3. Distinguish clearly between mandatory rules (e.g. "Strictly prohibited", "Must submit written application") and recommendations or guidelines.
4. If a question cannot be definitively answered from the provided documents, state clearly what is known from the text, note what is missing, and recommend checking with the HOA Board of Directors or Property Management.
5. In addition to your main Markdown answer, you must provide structured source citations and 3 highly relevant follow-up questions in the required JSON structure.`;

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
    });

    const parsed = JSON.parse(text) as AIResponseOutput;
    return {
      answer: parsed.answer || 'I could not find an answer in the provided documents.',
      sources: parsed.sources || [],
      suggestedQuestions: parsed.suggestedQuestions || [
        'What are the leasing rules for our HOA?',
        'What is the current monthly assessment dues amount?',
        'How do I submit an architectural change request?'
      ]
    };
  } catch (error: any) {
    console.error('Gemini API Error in askHOAChatbot after fallbacks:', error);
    
    // Find matching document keywords in local context for an informative grounded answer
    const qLower = payload.question.toLowerCase();
    const matchingDocs = payload.documents.filter(d => 
      d.name.toLowerCase().includes(qLower) || 
      d.content.toLowerCase().includes(qLower) ||
      (d.category && qLower.includes(d.category.toLowerCase()))
    );

    const relevantDocs = matchingDocs.length > 0 ? matchingDocs : payload.documents.slice(0, 3);
    
    return {
      answer: `### HOA Document Query: "${payload.question}"\n\n*The AI model is currently under high peak traffic. Here is a summary based on your indexed governing documents:*\n\n` +
        relevantDocs.map(d => `**${d.name}**:\n${d.summary || d.content.slice(0, 200)}...`).join('\n\n') +
        `\n\n*Please retry your question in a few moments for full semantic synthesis.*`,
      sources: relevantDocs.map(d => ({
        fileId: d.id,
        fileName: d.name,
        category: d.category || 'general',
        sectionOrClause: 'Relevant Section',
        snippet: d.summary || d.content.slice(0, 160) + '...'
      })),
      suggestedQuestions: [
        'What are the leasing and rental restrictions?',
        'What did the board discuss in the latest meeting?',
        'What is the 2026 annual budget breakdown?'
      ]
    };
  }
}

export async function generateDocumentSummary(doc: StoredDocument | ParsedDoc) {
  const truncatedContent = doc.content.length > 30000 
    ? doc.content.slice(0, 30000) + '...' 
    : doc.content;

  const prompt = `Analyze this HOA document:
Title: ${doc.name}
Category: ${doc.category || 'general'}
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
    });

    return JSON.parse(text || '{}');
  } catch (err) {
    console.error('Error generating document summary after fallbacks:', err);
    return {
      executiveSummary: doc.summary || `Executive summary of ${doc.name}`,
      keyHighlights: [
        'Official HOA governance record',
        `Document category: ${doc.category || 'General'}`,
        `File size: ${doc.content.length} characters parsed`
      ],
      importantDatesOrAmounts: [],
      suggestedQueries: [
        `What are the main rules in ${doc.name}?`,
        'What are the board requirements or voting procedures?',
        'What are the penalties or fees mentioned?'
      ]
    };
  }
}
