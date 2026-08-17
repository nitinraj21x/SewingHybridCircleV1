import { ingestResumeDocument, extractPlainTextFromDocument } from './ingest.js';
import { extractResumeStructure, summarizeExtraction, toCandidateFormPayload } from './extract.js';

export async function parseResumeUpload(file) {
  const document = await ingestResumeDocument(file);
  const extraction = extractResumeStructure(document, {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  });

  return {
    document,
    extraction,
    payload: toCandidateFormPayload(extraction),
    summary: summarizeExtraction(extraction),
    rawText: extractPlainTextFromDocument(document),
  };
}

export { ingestResumeDocument, extractResumeStructure, toCandidateFormPayload, summarizeExtraction };

