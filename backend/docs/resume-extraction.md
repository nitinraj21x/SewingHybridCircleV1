# Resume Extraction

## Overview

The portal now sends uploads to a backend extraction service instead of parsing resumes only in the browser.

Pipeline:

1. Upload file from the candidate form.
2. `POST /api/resumes/extract` accepts multipart input.
3. Backend ingests the document into a layout-aware intermediate model.
4. Extraction normalizes personal, experience, education, skill, project, and certification data.
5. The portal receives a candidate-form payload plus the structured extraction metadata.

## Supported Inputs

- PDF
- DOCX
- TXT
- Legacy DOC files with best-effort printable-text recovery
- Image uploads are accepted, but OCR is not configured in this workspace, so they return a partial result with warnings

## Canonical Output

The backend returns:

- `extraction`: canonical resume model with evidence, confidence, warnings, and layout metadata
- `payload`: portal-ready fields mapped to the current candidate form
- `metadata`: parser version, processing time, status, and confidence summary

## API

`POST /api/resumes/extract`

Form field:

- `resume`: the uploaded file

Authentication:

- Recruiter-only access via the existing JWT auth middleware

## Local Commands

```bash
npm run test:resume
npm run lint
npm run build
```

## Extending The Parser

- Add skill aliases in `backend/src/utils/resume/constants.js`
- Add location aliases in `backend/src/utils/resume/constants.js`
- Tune document ingestion in `backend/src/utils/resume/ingest.js`
- Tune entity extraction in `backend/src/utils/resume/extract.js`

## Known Limitations

- OCR is not implemented in this workspace
- Legacy `.doc` support is best-effort
- Some ambiguous resumes still require manual review
- Layout reconstruction is heuristic, not a full visual parser

