/* eslint-disable no-useless-escape, no-unused-vars, no-useless-assignment */
import { format } from 'date-fns';
import {
  DEGREE_ALIASES,
  COMPANY_HINTS,
  LOCATION_ALIASES,
  MONTH_ALIASES,
  PARSER_VERSION,
  SECTION_ALIASES,
  SKILL_ALIASES,
  TITLE_ALIASES,
} from './constants.js';

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /https?:\/\/[^\s)>\]}]+/gi;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9\-_%]+\/?/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9\-_%]+\/?/i;
const PHONE_RE = /(?:\+?\d{1,3}[\s\-().]*)?(?:\(?\d{2,4}\)?[\s\-().]*)?\d{3,4}[\s\-().]*\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,5})?/gi;
const YEAR_RE = /\b(19\d{2}|20\d{2})\b/;
const MONTH_TOKEN_RE = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?/i;
const DATE_SEPARATOR_RE = /(?:\s*(?:-|–|—|to|through|till|until)\s*)/i;

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanLine(value) {
  return normalizeText(value).replace(/^[•\-\u2022\u00b7\*]+\s*/g, '').trim();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lower(value) {
  return cleanLine(value).toLowerCase();
}

function splitLines(document) {
  return (document?.pages || []).flatMap((page) =>
    (page.lines || []).map((line) => ({
      ...line,
      text: cleanLine(line.text),
      page: line.page || page.page || 1,
    }))
  );
}

function createValueEntry(value, extras = {}) {
  if (value === undefined || value === null || value === '') {
    return {
      value: null,
      status: 'not_found',
      confidence: 0,
      confidenceLevel: 'not_found',
      evidence: '',
      source: null,
      ...extras,
    };
  }

  const confidence = typeof extras.confidence === 'number' ? extras.confidence : 0.8;
  return {
    value,
    status: 'found',
    confidence,
    confidenceLevel: confidence >= 0.9 ? 'high' : confidence >= 0.65 ? 'medium' : 'low',
    evidence: extras.evidence || '',
    source: extras.source || null,
    ...extras,
  };
}

function normalizeNameParts(name) {
  const compact = cleanLine(name).replace(/\s+/g, ' ');
  const parts = compact.split(' ').filter(Boolean);
  if (parts.length < 2) return { firstName: null, middleName: null, lastName: null, fullName: null };
  return {
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : null,
    lastName: parts[parts.length - 1],
    fullName: compact,
  };
}

function isSectionHeading(lineText) {
  const normalized = lower(lineText).replace(/[:\-]+$/, '');
  return Object.values(SECTION_ALIASES).some((aliases) =>
    aliases.some((alias) => normalized === alias || normalized.startsWith(`${alias} `))
  );
}

function getSectionForLine(lineText) {
  const normalized = lower(lineText).replace(/[:\-]+$/, '');
  for (const [section, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.some((alias) => normalized === alias || normalized.startsWith(`${alias} `))) {
      return section;
    }
  }
  return null;
}

function annotateSections(lines) {
  let currentSection = 'personal';
  return lines.map((line, index) => {
    if (index < 6 && !isSectionHeading(line.text)) {
      return { ...line, section: 'personal', isHeading: false };
    }

    const headingSection = getSectionForLine(line.text);
    if (headingSection) {
      currentSection = headingSection;
      return { ...line, section: headingSection, isHeading: true };
    }

    return { ...line, section: currentSection, isHeading: false };
  });
}

function getSectionLines(lines, section) {
  return lines.filter((line) => line.section === section && !line.isHeading);
}

function extractEmails(text) {
  return [...new Set((text.match(EMAIL_RE) || []).map((value) => value.toLowerCase()))];
}

function extractPhones(text) {
  const matches = text.match(PHONE_RE) || [];
  const normalized = matches
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => value.replace(/\D/g, '').length >= 7);
  return [...new Set(normalized)];
}

function normalizeUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value.replace(/\/$/, '');
  return `https://${value.replace(/\/$/, '')}`;
}

function extractLinks(text) {
  const urls = [...new Set((text.match(URL_RE) || []).map((value) => value.replace(/[),.]+$/, '')))];
  const linkedin = urls.find((url) => LINKEDIN_RE.test(url)) || (text.match(LINKEDIN_RE)?.[0] || null);
  const github = urls.find((url) => GITHUB_RE.test(url)) || (text.match(GITHUB_RE)?.[0] || null);
  const portfolio = urls.find((url) => !LINKEDIN_RE.test(url) && !GITHUB_RE.test(url)) || null;
  return {
    urls,
    linkedin: normalizeUrl(linkedin),
    github: normalizeUrl(github),
    portfolio: normalizeUrl(portfolio),
  };
}

function findFirstSectionHeadingIndex(lines, limit = 12) {
  const max = Math.min(lines.length, limit);
  for (let i = 0; i < max; i += 1) {
    if (isSectionHeading(lines[i].text)) return i;
  }
  return -1;
}

function isLocationText(text) {
  if (!text) return false;
  return findLocationMatches(text).length > 0;
}

function stripNoisyParentheticals(text) {
  let cleaned = cleanLine(text)
    .replace(/\s*\(([^()]*)\)\s*/g, (match, inner) => {
      if (/\b(client|linkedin|github|remote|india|usa|united states|uk|canada|australia|bangalore|bengaluru|bangaluru|delhi|hyderabad|pune|mumbai|chennai|kochi|thiruvananthapuram|california|location|onsite|hybrid|end client)\b/i.test(inner)) {
        return ' ';
      }
      return ` (${inner}) `;
    })
    .replace(/\s+/g, ' ')
    .trim();

  if (/\(/.test(cleaned) && !/\)/.test(cleaned)) {
    cleaned = cleaned.replace(/\s*\(.*/, '').trim();
  }

  return cleaned;
}

function tokenScoreForName(line) {
  const text = cleanLine(line.text || '');
  if (!text || text.length < 4 || text.length > 60) return 0;
  if (text.includes('@') || /\d/.test(text) || text.includes('://')) return 0;
  if (isSectionHeading(text)) return 0;
  if (isLocationText(text)) return 0;
  if (/\b(with|years?|experience|experienced|summary|profile|objective|skilled|proficient|hands[- ]on|seeking|passionate|strong|building|developing|designing|delivering|collaborating|working on|working with|responsible)\b/i.test(text)) return 0;
  if (/\b(experience|education|skills|projects|certification|summary|profile|objective|contact)\b/i.test(text)) return 0;
  const words = text.split(/\s+/);
  if (words.length < 2 || words.length > 4) return 0;
  const caps = words.filter((word) => /^[A-Z][a-zA-Z'.-]+$/.test(word) || /^[A-Z]\.?$/.test(word)).length;
  if (caps < words.length - 1) return 0;
  return words.length === 2 ? 1 : 0.8;
}

function extractName(lines) {
  const headingIndex = findFirstSectionHeadingIndex(lines, 12);
  const headerLimit = headingIndex >= 0 ? headingIndex : Math.min(lines.length, 10);
  const candidates = lines.slice(0, headerLimit).map((line, index) => ({
    line,
    index,
    score: tokenScoreForName(line),
  })).filter((candidate) => candidate.score > 0).map((candidate) => ({
    ...candidate,
    score: candidate.score + Math.max(0, (headerLimit - candidate.index) * 0.03),
  }));

  if (candidates.length === 0) {
    return createValueEntry(null, { confidence: 0, confidenceLevel: 'not_found' });
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  const parts = normalizeNameParts(best.line.text);
  return createValueEntry(parts.fullName, {
    confidence: 0.92,
    evidence: best.line.text,
    source: { page: best.line.page, section: 'personal', lineIndex: best.index },
    firstName: parts.firstName,
    middleName: parts.middleName,
    lastName: parts.lastName,
    lineIndex: best.index,
  });
}

function extractHeadline(lines, nameEntry) {
  const nameLineIndex = typeof nameEntry?.lineIndex === 'number' ? nameEntry.lineIndex : -1;
  const headerEnd = findFirstSectionHeadingIndex(lines, 12);
  const endIndex = headerEnd >= 0 ? headerEnd : Math.min(lines.length, 10);
  const header = lines.slice(Math.max(0, nameLineIndex + 1), endIndex)
    .map((line) => cleanLine(line.text))
    .filter(Boolean)
    .filter((line) => line !== nameEntry?.value)
    .filter((line) => !isLocationText(line));
  const headline = header.find((line) => extractTitleCandidate(line));
  return headline ? createValueEntry(headline, { confidence: 0.7, evidence: headline, source: { page: lines[0]?.page || 1, section: 'personal' } }) : createValueEntry(null);
}

function extractSummary(lines) {
  const summaryLines = getSectionLines(lines, 'personal').slice(0, 8)
    .filter((line) => !tokenScoreForName(line))
    .map((line) => cleanLine(line.text))
    .filter((line) => line && !/@/.test(line) && !/^(?:linkedin|github|portfolio|website)/i.test(line));
  const text = summaryLines.join(' ');
  if (text.length < 50) return createValueEntry(null);
  return createValueEntry(text, {
    confidence: 0.68,
    evidence: summaryLines[0] || text.slice(0, 120),
    source: { page: lines[0]?.page || 1, section: 'personal' },
  });
}

function findLocationMatches(text) {
  const matches = [];
  const compact = cleanLine(text).replace(/\s+/g, ' ');
  const normalized = compact.toLowerCase();

  for (const [needle, canonical] of LOCATION_ALIASES) {
    const escaped = escapeRegExp(needle);
    const re = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i');
    if (re.test(normalized)) {
      matches.push({
        raw: compact.match(new RegExp(escaped, 'i'))?.[0] || canonical,
        canonical,
      });
    }
  }

  if (/\bremote\b/i.test(compact)) {
    matches.push({ raw: compact.match(/\bremote[^\n,|]*/i)?.[0] || 'Remote', canonical: 'Remote' });
  }

  if (!matches.length) {
    const genericLocation = compact.match(
      /^[A-Za-z][A-Za-z.'’&\- ]{1,40}(?:,\s*[A-Za-z][A-Za-z.'’&\- ]{1,40}){1,2}(?:\s*-\s*\d{2,6})?$|^[A-Za-z][A-Za-z.'’&\- ]{1,40}\s*-\s*(?:India|USA|United States|UK|UAE|Canada|Australia|Singapore)$/i
    );
    if (genericLocation) {
      const segments = compact.split(/,\s*|\s+-\s+/).map((part) => part.trim()).filter(Boolean);
      const hasLocationSignal = segments.some((segment) =>
        /^(?:india|usa|united states|uk|united kingdom|uae|canada|australia|singapore)$/i.test(segment) ||
        INDIA_STATES.has(segment.replace(/\s*-\s*\d{2,6}$/, '').trim()) ||
        LOCATION_ALIASES.some(([alias]) => segment.toLowerCase().includes(alias))
      );
      const tooWordy = segments.some((segment) => segment.split(/\s+/).filter(Boolean).length > 3);
      if (hasLocationSignal && !tooWordy) {
        matches.push({
          raw: compact,
          canonical: compact,
        });
      }
    }
  }

  return matches;
}

const INDIA_STATES = new Set([
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi',
  'Jammu and Kashmir', 'Puducherry',
]);

function normalizeLocation(raw) {
  if (!raw) return null;
  const compact = cleanLine(raw).replace(/\s+/g, ' ');
  const aliasedInput = compact.replace(/\s+-\s+/g, ', ');
  const matchedAlias = LOCATION_ALIASES.find(([alias]) => aliasedInput.toLowerCase() === alias || aliasedInput.toLowerCase().includes(alias));
  const normalized = matchedAlias ? matchedAlias[1] : aliasedInput.replace(/\s*-\s*(?=\d{2,6}$)/, ', ');
  const segments = normalized.split(',').map((part) => part.trim()).filter(Boolean);

  let city = segments[0] || normalized;
  let state = null;
  let country = null;

  if (segments.length >= 2) {
    const second = segments[1].replace(/\s*-\s*\d{2,6}$/, '').trim();
    if (/^(india|usa|united states|uk|united kingdom|uae|canada|australia|singapore)$/i.test(second)) {
      country = second.replace(/^usa$/i, 'USA').replace(/^uk$/i, 'UK').replace(/^uae$/i, 'UAE');
    } else {
      state = second;
    }
  }
  if (segments.length >= 3) {
    country = segments[2];
  }

  if (!state && INDIA_STATES.has(city) && /india/i.test(normalized)) {
    country = 'India';
  }

  if (!state && /new delhi/i.test(normalized)) {
    city = 'New Delhi';
    state = 'Delhi';
    country = country || 'India';
  }

  if (!country && (/[,\s]India$/i.test(normalized) || /delhi ncr/i.test(normalized))) {
    country = 'India';
  }

  if (/remote/i.test(normalized) && !country && /india/i.test(normalized)) {
    country = 'India';
  }

  if (!country && state && INDIA_STATES.has(state)) {
    country = 'India';
  }

  if (state) {
    state = state.replace(/\s*-\s*\d{2,6}$/, '').trim();
  }

  return {
    raw: compact,
    normalized,
    city,
    state,
    country,
  };
}

function collectLocationMatches(lines) {
  const matches = [];
  const seen = new Set();

  for (const line of lines) {
    const lineMatches = findLocationMatches(line.text || '');
    for (const match of lineMatches) {
      const normalized = normalizeLocation(match.raw || match.canonical || '');
      const display = normalized?.normalized || normalized?.raw || match.canonical || match.raw || '';
      const key = display.toLowerCase();
      if (!display || seen.has(key)) continue;
      seen.add(key);
      matches.push({
        ...normalized,
        raw: match.raw || normalized?.raw || display,
        canonical: match.canonical || normalized?.normalized || display,
        display,
        source: { page: line.page || 1, section: line.section || 'personal' },
      });
    }
  }

  return matches;
}

function looksLikeTitleText(text) {
  const compact = cleanLine(text).replace(/\s+/g, ' ');
  if (!compact) return false;
  if (isLocationText(compact) || parseDateRange(compact)) return false;
  if (compact.includes('@') || compact.includes('://')) return false;
  if (/\b(with|years?|experience|experienced|summary|profile|objective|skilled|proficient|hands[- ]on|seeking|passionate|strong|building|developing|designing|delivering|collaborating|working on|working with|responsible|application development|maintenance|expertise)\b/i.test(compact)) {
    return false;
  }

  const positive = /\b(engineer|developer|designer|manager|analyst|architect|consultant|specialist|associate|lead|director|scientist|administrator|tester|qa|devops|product owner|scrum master|principal|staff|intern|trainee|full stack|frontend|front end|backend|back end|software engineer|software developer|mobile|web|data)\b/i.test(compact);
  if (positive) return true;

  return false;
}

function looksLikeCompanyText(text) {
  const compact = cleanLine(text).replace(/\s+/g, ' ');
  if (!compact) return false;
  if (isLocationText(compact) || parseDateRange(compact) || looksLikeTitleText(compact)) return false;
  if (/^\s*(project|role|responsibility|responsibilities|summary|overview|achievement|achievements)\s*[:\-]/i.test(compact)) return false;
  if (/\b(with|years?|experience|experienced|summary|profile|objective|skilled|proficient|hands[- ]on|seeking|passionate|strong|building|developing|designing|delivering|collaborating|working on|working with|responsible|application development|maintenance|expertise|leader(ship)?|collaboration|project|role|responsibility|responsibilities|key result areas?|key results)\b/i.test(compact)) {
    return false;
  }

  const lowerText = lower(compact);
  const wordCount = compact.split(/\s+/).filter(Boolean).length;
  const capitalizedTokens = compact.split(/\s+/).filter((word) => /^[A-Z][a-zA-Z0-9&'.-]*$/.test(word) || /^[A-Z]{2,}$/.test(word)).length;
  return COMPANY_HINTS.some((hint) => lowerText.includes(hint)) ||
    /\b(llp|l\.l\.p\.|ltd|inc|corp|co\.?|company|group|labs|solutions|systems|services|technologies|technology|consulting|ventures|partners|studio|capital|holdings|global)\b/i.test(compact) ||
    (capitalizedTokens >= 2 && wordCount >= 2 && wordCount <= 7 && !/\b(university|college|school|institute|academy)\b/i.test(compact));
}

function extractTitleCandidate(text) {
  const compact = cleanLine(text).replace(/\s+/g, ' ');
  if (!looksLikeTitleText(compact)) return null;

  const colonIndex = compact.indexOf(':');
  if (colonIndex > 0) {
    const prefix = compact.slice(0, colonIndex).trim();
    const suffix = compact.slice(colonIndex + 1).trim();
    if (parseDateRange(prefix) && looksLikeTitleText(suffix)) {
      return suffix;
    }
    if (looksLikeTitleText(prefix) && !looksLikeCompanyText(suffix) && !isLocationText(suffix)) {
      return prefix;
    }
  }

  const commaSegments = compact.split(/,(?![^()]*\))/).map((part) => cleanLine(part)).filter(Boolean);
  if (commaSegments.length > 1) {
    for (const segment of commaSegments) {
      if (looksLikeTitleText(segment)) {
        return segment;
      }
    }
  }

  return compact;
}

function extractCompanyCandidate(text) {
  const compact = stripNoisyParentheticals(cleanLine(text).replace(/\s+/g, ' '));
  if (!compact || parseDateRange(compact) || isLocationText(compact) || looksLikeTitleText(compact)) return null;

  const segments = compact.split(/,(?![^()]*\))/).map((part) => stripNoisyParentheticals(part)).filter(Boolean);
  for (const segment of segments) {
    if (!segment || parseDateRange(segment) || isLocationText(segment) || looksLikeTitleText(segment)) continue;
    if (looksLikeCompanyText(segment)) return segment;
  }

  return looksLikeCompanyText(compact) ? compact : null;
}

function extractLocationField(lines, locationMatches = collectLocationMatches(lines)) {
  if (locationMatches.length > 0) {
    const best = locationMatches[0];
    return createValueEntry({
      ...best,
    }, {
      confidence: 0.9,
      evidence: best.raw,
      source: best.source,
      locationOptions: locationMatches.map((item) => item.display),
    });
  }

  const explicit = lines.find((line) => /\b(based in|located in|current location|present location|open to relocate|relocation)\b/i.test(line.text) && findLocationMatches(line.text).length);
  if (explicit) {
    const match = findLocationMatches(explicit.text)[0];
    return createValueEntry(normalizeLocation(match.raw), {
      confidence: 0.86,
      evidence: explicit.text,
      source: { page: explicit.page, section: explicit.section },
    });
  }

  return createValueEntry(null);
}

function sectionText(lines, section) {
  return getSectionLines(lines, section).map((line) => line.text).join('\n');
}

function aliasMatches(text) {
  const lowerText = text.toLowerCase();
  const found = [];
  for (const skill of SKILL_ALIASES) {
    for (const alias of skill.aliases) {
      const needle = alias.toLowerCase();
      const escaped = escapeRegExp(needle);
      const boundary = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      if (boundary.test(lowerText)) {
        found.push({
          canonical: skill.canonical,
          category: skill.category,
          raw: text.match(new RegExp(escaped, 'i'))?.[0] || skill.canonical,
          alias,
        });
        break;
      }
    }
  }
  return found;
}

function extractSkills(lines, documentText) {
  const sourceCandidates = [
    { section: 'skills', text: sectionText(lines, 'skills'), weight: 1 },
    { section: 'experience', text: sectionText(lines, 'experience'), weight: 0.75 },
    { section: 'projects', text: sectionText(lines, 'projects'), weight: 0.8 },
    { section: 'certifications', text: sectionText(lines, 'certifications'), weight: 0.55 },
    { section: 'personal', text: documentText, weight: 0.35 },
  ];

  const map = new Map();
  for (const source of sourceCandidates) {
    const matches = aliasMatches(source.text);
    for (const match of matches) {
      const current = map.get(match.canonical);
      const confidence = Math.min(0.99, (current?.confidence || 0) + source.weight * 0.25);
      map.set(match.canonical, {
        raw: current?.raw || match.raw,
        canonical: match.canonical,
        category: match.category,
        confidence,
        confidenceLevel: confidence >= 0.9 ? 'high' : confidence >= 0.65 ? 'medium' : 'low',
        evidence: current?.evidence || match.raw,
        sources: [...new Set([...(current?.sources || []), source.section])],
      });
    }
  }

  return [...map.values()].sort((a, b) => b.confidence - a.confidence);
}

function parseMonthToken(token) {
  if (!token) return null;
  const normalized = token.toLowerCase().replace(/\./g, '');
  if (MONTH_ALIASES[normalized] !== undefined) return MONTH_ALIASES[normalized];
  return null;
}

function parseDateToken(token, role = 'start') {
  const text = cleanLine(token || '').replace(/[()]/g, '');
  if (!text) return null;
  if (/present|current|ongoing|till date|till now|now/i.test(text)) {
    return { text, ongoing: true, precision: 'open', sortKey: Number.POSITIVE_INFINITY };
  }

  const slash = text.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (slash) {
    const month = Number(slash[1]) - 1;
    const year = Number(slash[2]);
    const date = new Date(Date.UTC(year, month, role === 'end' ? 28 : 1));
    return {
      text,
      year,
      month,
      precision: 'month',
      date,
      sortKey: date.getTime(),
    };
  }

  const mmyyyy = text.match(/^(\d{1,2})[\/\-](\d{2,4})$/);
  if (mmyyyy && Number(mmyyyy[2]) > 31) {
    const month = Number(mmyyyy[1]) - 1;
    let year = Number(mmyyyy[2]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const date = new Date(Date.UTC(year, month, role === 'end' ? 28 : 1));
    return { text, year, month, precision: 'month', date, sortKey: date.getTime() };
  }

  const monthYear = text.match(MONTH_TOKEN_RE);
  const yearMatch = text.match(YEAR_RE);
  if (monthYear && yearMatch) {
    const month = parseMonthToken(monthYear[1]);
    const year = Number(yearMatch[1]);
    const date = new Date(Date.UTC(year, month ?? 0, role === 'end' ? 28 : 1));
    return {
      text,
      year,
      month: month ?? null,
      precision: month === null ? 'year' : 'month',
      date,
      sortKey: date.getTime(),
    };
  }

  if (yearMatch) {
    const year = Number(yearMatch[1]);
    const date = new Date(Date.UTC(year, role === 'end' ? 11 : 0, role === 'end' ? 31 : 1));
    return { text, year, month: null, precision: 'year', date, sortKey: date.getTime() };
  }

  return null;
}

function parseDateRange(text) {
  const normalized = cleanLine(text).replace(/\s+/g, ' ');
  if (!normalized) return null;

  const separatorMatch = normalized.match(DATE_SEPARATOR_RE);
  if (separatorMatch) {
    const parts = normalized.split(DATE_SEPARATOR_RE).map((part) => part.trim()).filter(Boolean);
    const startToken = parts[0];
    const endToken = parts.slice(1).join(' ').trim();
    const start = parseDateToken(startToken, 'start');
    const end = parseDateToken(endToken, 'end');
    if (start || end) {
      return {
        raw: normalized,
        start,
        end: end?.ongoing ? null : end,
        current: Boolean(end?.ongoing),
        confidence: start && end ? 0.9 : 0.72,
      };
    }
  }

  const rangeMatch = normalized.match(/(.+?)\s*(?:-|–|—)\s*(.+)/);
  if (rangeMatch) {
    const start = parseDateToken(rangeMatch[1], 'start');
    const end = parseDateToken(rangeMatch[2], 'end');
    if (start || end) {
      return {
        raw: normalized,
        start,
        end: end?.ongoing ? null : end,
        current: Boolean(end?.ongoing),
        confidence: start && end ? 0.9 : 0.72,
      };
    }
  }

  const standalone = parseDateToken(normalized, 'start');
  if (standalone) {
    return {
      raw: normalized,
      start: standalone,
      end: standalone.ongoing ? null : null,
      current: Boolean(standalone.ongoing),
      confidence: standalone.precision === 'year' ? 0.56 : 0.68,
    };
  }

  return null;
}

function formatDateToken(token) {
  if (!token) return null;
  if (token.ongoing) return 'Present';
  if (token.precision === 'month' && typeof token.year === 'number' && typeof token.month === 'number') {
    return format(new Date(Date.UTC(token.year, token.month, 1)), 'yyyy-MM');
  }
  if (typeof token.year === 'number') {
    return String(token.year);
  }
  return token.text || null;
}

function lineLooksLikeCompany(text) {
  return Boolean(extractCompanyCandidate(text));
}

function lineLooksLikeTitle(text) {
  return Boolean(extractTitleCandidate(text));
}

function lineLooksLikeLocation(text) {
  return isLocationText(text) || /\b(remote|hybrid|onsite|onsite\/remote)\b/i.test(text);
}

function normalizeCompanyCandidate(text) {
  if (!text) return null;
  const compact = stripNoisyParentheticals(cleanLine(text).replace(/\s+/g, ' '));
  const segments = compact.split(/,(?![^()]*\))/).map((part) => stripNoisyParentheticals(part)).filter(Boolean);
  if (segments.length > 1) {
    for (const segment of segments) {
      if (segment && !lineLooksLikeLocation(segment) && !lineLooksLikeTitle(segment) && looksLikeCompanyText(segment)) {
        return segment;
      }
    }
    const first = segments[0];
    if (first && looksLikeCompanyText(first)) return first;
  }
  return looksLikeCompanyText(compact) ? compact : null;
}

function splitCandidateRow(text) {
  return text.split(/\s*[|•·]\s*|\s+\-\s+/).map((part) => cleanLine(part)).filter(Boolean);
}

function splitExperienceFragments(text) {
  return cleanLine(text)
    .split(/,(?![^()]*\))/)
    .map((part) => cleanLine(part))
    .filter(Boolean);
}

const TECH_NOISE_RE = /\b(api gateway|lambda functions?|aws|azure|gcp|cloud|react|node(?:\.js)?|javascript|typescript|microservices?|graphql|spring boot|sql|mysql|postgres(?:ql)?|kafka|docker|kubernetes|functions?|monitoring|scanning|documentation|optimization|architecture|platform|services?)\b/i;

function scoreTitleValue(text) {
  const candidate = extractTitleCandidate(text || '');
  if (!candidate) return Number.NEGATIVE_INFINITY;
  let score = candidate.length / 10;
  if (/\b(engineer|developer|designer|manager|analyst|architect|consultant|specialist|associate|lead|director|scientist|administrator|tester|qa|devops|product owner|scrum master|principal|staff|intern|trainee|full stack|frontend|front end|backend|back end|software engineer|software developer|mobile|web|data)\b/i.test(candidate)) {
    score += 5;
  }
  if (/[A-Z]{2,}/.test(candidate)) {
    score += 0.5;
  }
  if (TECH_NOISE_RE.test(candidate)) {
    score -= 6;
  }
  return score;
}

function scoreCompanyValue(text) {
  const candidate = extractCompanyCandidate(text || '');
  if (!candidate) return Number.NEGATIVE_INFINITY;
  let score = candidate.length / 12;
  const lowerText = lower(candidate);
  if (COMPANY_HINTS.some((hint) => lowerText.includes(hint))) score += 5;
  if (/\b(llp|l\.l\.p\.|ltd|inc|corp|co\.?|company|group|labs|solutions|systems|services|technologies|technology|consulting|ventures|partners|studio|capital|holdings|global|research|service centre|service center)\b/i.test(candidate)) {
    score += 4;
  }
  if (TECH_NOISE_RE.test(candidate)) {
    score -= 8;
  }
  const capitalizedTokens = candidate.split(/\s+/).filter((word) => /^[A-Z][a-zA-Z0-9&'.-]*$/.test(word) || /^[A-Z]{2,}$/.test(word)).length;
  if (capitalizedTokens >= 2) score += 4;
  return score;
}

function scoreExperienceLine(line) {
  const text = cleanLine(line.text);
  if (!text) return 0;
  let score = 0;
  if (parseDateRange(text)) score += 5;
  if (lineLooksLikeCompany(text)) score += 2;
  if (lineLooksLikeTitle(text)) score += 2;
  if (lineLooksLikeLocation(text)) score += 1;
  if (/^\s*[-*•]/.test(text)) score -= 1;
  return score;
}

function extractExperience(lines, documentText) {
  const sectionLines = getSectionLines(lines, 'experience');
  const sourceLines = sectionLines.length > 0 ? sectionLines : lines;
  const records = [];
  const seen = new Set();

  for (let i = 0; i < sourceLines.length; i += 1) {
    const line = sourceLines[i];
    const dateRange = parseDateRange(line.text);
    if (!dateRange) continue;

    const window = sourceLines.slice(Math.max(0, i - 3), Math.min(sourceLines.length, i + 4));
    const before = sourceLines.slice(Math.max(0, i - 5), i);
    const after = sourceLines.slice(i + 1, i + 4);
    const candidateTexts = [
      ...before.map((l) => l.text),
      line.text,
    ];
    const surroundingTexts = [...before.map((l) => l.text), line.text, ...after.map((l) => l.text)];
    if (surroundingTexts.some((txt) => degreeCanonical(txt) || /\b(university|college|school|institute|academy)\b/i.test(txt))) {
      continue;
    }

    const pipePieces = candidateTexts.flatMap(splitCandidateRow).flatMap(splitExperienceFragments);
    let company = null;
    let title = null;
    let location = null;

    for (const piece of pipePieces) {
      const titleCandidate = extractTitleCandidate(piece);
      const companyCandidate = extractCompanyCandidate(piece);
      if (!title && titleCandidate) {
        title = titleCandidate;
      }
      if (!company && companyCandidate && companyCandidate !== title) {
        company = companyCandidate;
      }
      if (!location && lineLooksLikeLocation(piece)) {
        location = normalizeLocation(piece);
      }
    }

    if (!title) {
      title = before.slice().reverse().map((item) => extractTitleCandidate(item.text)).find(Boolean) || null;
    }
    if (!company) {
      company = before.slice().reverse().map((item) => extractCompanyCandidate(item.text)).find(Boolean) || null;
    }
    if (!location) {
      const locLine = [...before, ...after].find((item) => lineLooksLikeLocation(item.text));
      location = locLine ? normalizeLocation(locLine.text) : null;
    }

    company = normalizeCompanyCandidate(company);

    const descriptionLines = [];
    for (const item of after) {
      const txt = cleanLine(item.text);
      if (!txt) continue;
      if (parseDateRange(txt)) break;
      if (isSectionHeading(txt)) break;
      if (lineLooksLikeCompany(txt) && txt === company) continue;
      if (lineLooksLikeTitle(txt) && txt === title) continue;
      descriptionLines.push(txt);
    }

    const technologies = [...new Set(aliasMatches(descriptionLines.join(' ')).map((skill) => skill.canonical))];
    const key = [
      company || '',
      title || '',
      formatDateToken(dateRange.start) || '',
      formatDateToken(dateRange.end) || (dateRange.current ? 'Present' : ''),
    ].join('|').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    records.push({
      company: createValueEntry(company, {
        confidence: company ? 0.74 : 0,
        evidence: company || '',
        source: { page: line.page, section: 'experience' },
      }),
      title: createValueEntry(title, {
        confidence: title ? 0.78 : 0,
        evidence: title || '',
        source: { page: line.page, section: 'experience' },
      }),
      location: createValueEntry(location, {
        confidence: location ? 0.72 : 0,
        evidence: location?.raw || '',
        source: { page: line.page, section: 'experience' },
      }),
      startDate: createValueEntry(formatDateToken(dateRange.start), {
        confidence: dateRange.start?.precision === 'month' ? 0.9 : 0.62,
        evidence: dateRange.raw,
        source: { page: line.page, section: 'experience' },
        precision: dateRange.start?.precision || null,
      }),
      endDate: createValueEntry(formatDateToken(dateRange.end), {
        confidence: dateRange.end?.precision === 'month' ? 0.9 : 0.62,
        evidence: dateRange.raw,
        source: { page: line.page, section: 'experience' },
        precision: dateRange.end?.precision || null,
      }),
      current: Boolean(dateRange.current),
      description: createValueEntry(descriptionLines.join(' '), {
        confidence: descriptionLines.length > 0 ? 0.66 : 0.3,
        evidence: descriptionLines[0] || line.text,
        source: { page: line.page, section: 'experience' },
      }),
      responsibilities: descriptionLines.filter((item) => /^[-*•]/.test(item)).map((item) => item.replace(/^[-*•]\s*/, '')),
      achievements: descriptionLines.filter((item) => /\b(achieved|improved|reduced|increased|delivered|launched|awarded|promoted|saved)\b/i.test(item)),
      technologies,
      evidence: candidateTexts.join(' | '),
      confidence: Math.min(0.95, 0.62 + (title ? 0.12 : 0) + (company ? 0.12 : 0) + (descriptionLines.length > 0 ? 0.08 : 0)),
    });
  }

  records.sort((a, b) => {
    const aToken = a.startDate?.value;
    const bToken = b.startDate?.value;
    return String(bToken || '').localeCompare(String(aToken || ''));
  });

  return records;
}

function degreeCanonical(text) {
  const lowerText = lower(text);
  for (const [alias, canonical] of DEGREE_ALIASES) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i');
    if (re.test(lowerText)) return canonical;
  }
  return null;
}

function extractGpa(text) {
  const match = text.match(/\b(?:gpa|cgpa|score|percentage)\b[^0-9]{0,8}(\d{1,2}(?:\.\d{1,2})?)(?:\s*\/\s*10|\s*%|\s*out of 10)?/i);
  return match ? match[1] : null;
}

function extractEducation(lines) {
  const sectionLines = getSectionLines(lines, 'education');
  const sourceLines = sectionLines.length > 0 ? sectionLines : lines;
  const records = [];

  for (let i = 0; i < sourceLines.length; i += 1) {
    const line = sourceLines[i];
    const degree = degreeCanonical(line.text) || (/\b(bachelor|master|b\.tech|b\.e\.|m\.tech|m\.e\.|mca|mba|ph\.d|doctorate)\b/i.test(line.text) ? line.text : null);
    if (!degree) continue;

    const nearby = sourceLines.slice(i, Math.min(sourceLines.length, i + 4));
    const institutionLine = nearby.slice(1).find((item) => !degreeCanonical(item.text) && !/\b(19|20)\d{2}\b/.test(item.text) && !/\b(gpa|cgpa|percentage|marks)\b/i.test(item.text));
    const yearMatch = nearby.flatMap((item) => item.text.match(/\b(19\d{2}|20\d{2})\b/g) || []);
    const gpa = nearby.map((item) => extractGpa(item.text)).find(Boolean) || null;
    const locationLine = nearby.find((item) => lineLooksLikeLocation(item.text));

    const fieldMatch = line.text.match(/(?:in|of)\s+(.+)$/i);
    const field = fieldMatch ? fieldMatch[1].replace(/[,;].*$/, '').trim() : null;

    records.push({
      degree: createValueEntry(degreeCanonical(line.text) || line.text, {
        confidence: 0.82,
        evidence: line.text,
        source: { page: line.page, section: 'education' },
      }),
      field: createValueEntry(field, {
        confidence: field ? 0.55 : 0,
        evidence: field || '',
        source: { page: line.page, section: 'education' },
      }),
      institution: createValueEntry(institutionLine?.text || null, {
        confidence: institutionLine ? 0.74 : 0,
        evidence: institutionLine?.text || '',
        source: { page: institutionLine?.page || line.page, section: 'education' },
      }),
      location: createValueEntry(locationLine ? normalizeLocation(locationLine.text) : null, {
        confidence: locationLine ? 0.65 : 0,
        evidence: locationLine?.text || '',
        source: { page: locationLine?.page || line.page, section: 'education' },
      }),
      startDate: createValueEntry(null, { confidence: 0, status: 'not_found', confidenceLevel: 'not_found' }),
      endDate: createValueEntry(yearMatch[yearMatch.length - 1] || null, {
        confidence: yearMatch.length ? 0.6 : 0,
        evidence: line.text,
        source: { page: line.page, section: 'education' },
      }),
      graduationYear: createValueEntry(yearMatch[yearMatch.length - 1] || null, {
        confidence: yearMatch.length ? 0.6 : 0,
        evidence: line.text,
        source: { page: line.page, section: 'education' },
      }),
      gpa: createValueEntry(gpa, {
        confidence: gpa ? 0.72 : 0,
        evidence: gpa ? nearby.map((item) => item.text).join(' | ') : '',
        source: { page: line.page, section: 'education' },
      }),
      evidence: nearby.map((item) => item.text).join(' | '),
      confidence: 0.68,
    });
  }

  return records;
}

function extractProjects(lines) {
  const sectionLines = getSectionLines(lines, 'projects');
  const sourceLines = sectionLines.length > 0 ? sectionLines : [];
  const records = [];

  let current = null;
  for (const line of sourceLines) {
    const text = cleanLine(line.text);
    if (!text) continue;

    const hasUrl = /https?:\/\//i.test(text);
    const looksLikeTitle = text.length < 80 && !text.endsWith('.') && !/^\d/.test(text);
    if (looksLikeTitle && !text.startsWith('-')) {
      if (current) records.push(current);
      current = {
        name: createValueEntry(text, { confidence: 0.7, evidence: text, source: { page: line.page, section: 'projects' } }),
        description: createValueEntry(null),
        technologies: [],
        url: createValueEntry(hasUrl ? normalizeUrl((text.match(URL_RE) || [])[0]) : null, { confidence: hasUrl ? 0.9 : 0 }),
        role: createValueEntry(null),
        dates: createValueEntry(null),
        evidence: text,
        confidence: 0.55,
      };
      continue;
    }

    if (!current) {
      current = {
        name: createValueEntry(text, { confidence: 0.5, evidence: text, source: { page: line.page, section: 'projects' } }),
        description: createValueEntry(null),
        technologies: [],
        url: createValueEntry(hasUrl ? normalizeUrl((text.match(URL_RE) || [])[0]) : null, { confidence: hasUrl ? 0.9 : 0 }),
        role: createValueEntry(null),
        dates: createValueEntry(null),
        evidence: text,
        confidence: 0.45,
      };
      continue;
    }

    current.description = createValueEntry(
      current.description?.value ? `${current.description.value} ${text}` : text,
      { confidence: 0.55, evidence: text, source: { page: line.page, section: 'projects' } }
    );
    current.technologies = [...new Set([...current.technologies, ...aliasMatches(text).map((match) => match.canonical)])];
    if (hasUrl && !current.url?.value) {
      current.url = createValueEntry(normalizeUrl((text.match(URL_RE) || [])[0]), { confidence: 0.88, evidence: text });
    }
    current.evidence = `${current.evidence} | ${text}`;
  }

  if (current) records.push(current);
  return records.filter((record) => record.name?.value);
}

function extractCertifications(lines) {
  const sectionLines = getSectionLines(lines, 'certifications');
  const sourceLines = sectionLines.length > 0 ? sectionLines : [];
  const records = [];

  for (const line of sourceLines) {
    const text = cleanLine(line.text);
    if (!text) continue;
    const hasCertKeyword = /\b(certified|certification|certificate|credential)\b/i.test(text);
    if (!hasCertKeyword && text.length < 20) continue;
    const url = (text.match(URL_RE) || [])[0] || null;
    const issuer = text.match(/\b(by|from|issued by)\s+(.+)$/i)?.[2] || null;
    const date = text.match(/\b(19\d{2}|20\d{2})\b/g)?.at(-1) || null;
    const credentialId = text.match(/\b(?:credential id|id|license)\s*[:#-]?\s*([A-Z0-9\-]+)/i)?.[1] || null;

    records.push({
      name: createValueEntry(text, { confidence: 0.7, evidence: text, source: { page: line.page, section: 'certifications' } }),
      issuingOrganization: createValueEntry(issuer, { confidence: issuer ? 0.55 : 0, evidence: text, source: { page: line.page, section: 'certifications' } }),
      date: createValueEntry(date, { confidence: date ? 0.5 : 0, evidence: text, source: { page: line.page, section: 'certifications' } }),
      expiryDate: createValueEntry(null, { confidence: 0, confidenceLevel: 'not_found' }),
      credentialId: createValueEntry(credentialId, { confidence: credentialId ? 0.78 : 0, evidence: text, source: { page: line.page, section: 'certifications' } }),
      url: createValueEntry(url ? normalizeUrl(url) : null, { confidence: url ? 0.82 : 0, evidence: text, source: { page: line.page, section: 'certifications' } }),
      evidence: text,
      confidence: 0.65,
    });
  }

  return records;
}

function extractLanguages(lines) {
  const sectionLines = getSectionLines(lines, 'languages');
  const text = sectionLines.map((line) => line.text).join(' ');
  if (!text) return [];
  return text
    .split(/[•,|/]/)
    .map((value) => cleanLine(value))
    .filter(Boolean)
    .map((value) => createValueEntry(value, { confidence: 0.58, evidence: text, source: { page: sectionLines[0]?.page || 1, section: 'languages' } }));
}

function calculateTotalExperienceMonths(experience) {
  const intervals = experience
    .map((item) => {
      const startToken = item.startDate;
      const endToken = item.endDate?.value ? item.endDate : (item.current ? { ongoing: true } : null);
      const startText = String(startToken?.value || '');
      const endText = String(endToken?.value || '');

      let startMonth = null;
      let endMonth = null;

      if (startToken?.precision === 'month' && /^\d{4}-\d{2}$/.test(startText)) {
        const [year, month] = startText.split('-').map(Number);
        startMonth = year * 12 + (month - 1);
      } else if (startToken?.precision === 'year' && /^\d{4}$/.test(startText)) {
        startMonth = Number(startText) * 12;
      }

      if (endToken?.ongoing) {
        const now = new Date();
        endMonth = now.getFullYear() * 12 + now.getMonth();
      } else if (endToken?.precision === 'month' && /^\d{4}-\d{2}$/.test(endText)) {
        const [year, month] = endText.split('-').map(Number);
        endMonth = year * 12 + (month - 1);
      } else if (endToken?.precision === 'year' && /^\d{4}$/.test(endText)) {
        endMonth = (Number(endText) * 12) + 11;
      } else if (item.current) {
        const now = new Date();
        endMonth = now.getFullYear() * 12 + now.getMonth();
      } else {
        endMonth = startMonth;
      }

      if (startMonth === null || endMonth === null) return null;
      if (endMonth < startMonth) return null;
      return [startMonth, endMonth];
    })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval[0] > last[1] + 1) {
      merged.push([...interval]);
    } else {
      last[1] = Math.max(last[1], interval[1]);
    }
  }

  const totalMonths = merged.reduce((sum, [start, end]) => sum + Math.max(0, end - start + 1), 0);
  return { totalMonths, merged };
}

function calculateTotalExperienceYears(experience) {
  const { totalMonths } = calculateTotalExperienceMonths(experience);
  return Number((totalMonths / 12).toFixed(1));
}

function extractCurrentTitle(experience, headline) {
  const currentTitles = experience
    .filter((item) => item.current)
    .map((item) => ({
      value: extractTitleCandidate(item?.title?.value || '') || null,
      score: scoreTitleValue(item?.title?.value || ''),
      source: item?.title?.source || null,
      evidence: item?.title?.evidence || '',
    }))
    .filter((item) => item.value);

  const bestRecord = currentTitles.sort((a, b) => b.score - a.score)[0] || null;
  const headlineTitle = extractTitleCandidate(headline?.value || '');
  const value = bestRecord?.value || headlineTitle || null;
  return createValueEntry(value, {
    confidence: bestRecord?.value ? 0.85 : headlineTitle ? 0.62 : 0,
    evidence: bestRecord?.evidence || headline?.evidence || '',
    source: bestRecord?.source || headline?.source || null,
  });
}

function extractCurrentCompany(experience, location) {
  const currentCompanies = experience
    .filter((item) => item.current)
    .map((item) => ({
      value: extractCompanyCandidate(item?.company?.value || '') || null,
      score: scoreCompanyValue(item?.company?.value || ''),
      source: item?.company?.source || null,
      evidence: item?.company?.evidence || '',
    }))
    .filter((item) => item.value);

  const bestRecord = currentCompanies.sort((a, b) => b.score - a.score)[0] || null;
  const candidate = bestRecord?.value || '';
  const wordCount = candidate.split(/\s+/).filter(Boolean).length;
  const capitalizedTokens = candidate.split(/\s+/).filter((word) => /^[A-Z][a-zA-Z0-9&'.-]*$/.test(word) || /^[A-Z]{2,}$/.test(word)).length;
  const hasStrongCompanySignal = COMPANY_HINTS.some((hint) => lower(candidate).includes(hint)) ||
    /\b(llp|l\.l\.p\.|ltd|inc|corp|co\.?|company|group|labs|solutions|systems|services|technologies|technology|consulting|ventures|partners|studio|capital|holdings|global|research|service centre|service center)\b/i.test(candidate);
  const value = bestRecord && (
    (bestRecord.score >= 4 && (hasStrongCompanySignal || wordCount <= 4 || capitalizedTokens >= 4)) ||
    (hasStrongCompanySignal && bestRecord.score >= 3.25)
  ) ? candidate : null;
  return createValueEntry(value, {
    confidence: value ? 0.86 : 0,
    evidence: bestRecord?.evidence || '',
    source: bestRecord?.source || location?.source || null,
  });
}

function buildCurrentLocation(locationField, experience) {
  if (locationField?.value) return locationField;
  const workLocation = experience.find((item) => item.location?.value)?.location;
  return createValueEntry(workLocation?.value || null, {
    confidence: workLocation?.value ? 0.48 : 0,
    evidence: workLocation?.evidence || '',
    source: workLocation?.source || null,
  });
}

function validateExtraction(extraction) {
  const warnings = [];
  const { experience, education, personal } = extraction;

  for (const item of experience) {
    if (item.startDate?.value && item.endDate?.value && String(item.startDate.value) > String(item.endDate.value) && !item.current) {
      warnings.push(`Experience date order looks inconsistent for ${item.company?.value || item.title?.value || 'an entry'}.`);
    }
  }

  if (!personal.email?.value) warnings.push('Email was not found.');
  if (!personal.name?.value) warnings.push('Candidate name was not confidently detected.');
  if (!experience.length) warnings.push('No employment history records were confidently extracted.');
  if (!education.length) warnings.push('No education records were confidently extracted.');

  const layout = extraction.document?.layout?.type;
  if (layout === 'two-column' && extraction.document?.type === 'pdf') {
    warnings.push('Two-column layout detected; reading order was reconstructed heuristically.');
  }

  return warnings;
}

function buildCandidateProfile(extraction) {
  const firstName = extraction.personal.name?.firstName || '';
  const lastName = extraction.personal.name?.lastName || '';
  const currentRole = extraction.professional.currentTitle?.value || '';
  const currentCompany = extraction.professional.currentCompany?.value || '';
  const location = extraction.personal.location?.value?.normalized || extraction.personal.location?.value?.raw || '';
  const skills = extraction.skills.map((skill) => skill.canonical);
  const locationOptions = extraction.preferences.preferredLocations || [];

  const workHistory = extraction.experience.map((item) => ({
    company: item.company?.value || '',
    role: item.title?.value || '',
    from: item.startDate?.value || '',
    to: item.current ? 'Present' : (item.endDate?.value || ''),
    description: item.description?.value || '',
  }));

  const education = extraction.education.map((item) => ({
    degree: item.degree?.value || '',
    institution: item.institution?.value || '',
    year: item.graduationYear?.value ? Number(item.graduationYear.value) || item.graduationYear.value : '',
  }));

  return {
    firstName,
    lastName,
    email: extraction.personal.email?.value || '',
    phone: extraction.personal.phone?.value || '',
    location,
    noticePeriod: extraction.preferences.noticePeriod?.value || '2 weeks',
    currentRole,
    currentCompany,
    totalExperience: extraction.professional.totalExperience?.value ?? 0,
    primarySkill: skills[0] || '',
    secondarySkill: skills[1] || '',
    skills,
    education,
    workHistory,
    notes: extraction.personal.summary?.value || extraction.professional.headline?.value || '',
    linkedIn: extraction.personal.links?.linkedin?.value || '',
    locationOptions,
  };
}

export function extractResumeStructure(document, fileMeta = {}) {
  const lines = annotateSections(splitLines(document));
  const rawText = normalizeText(document?.rawText || lines.map((line) => line.text).join('\n'));
  const textLength = rawText.length;

  const name = extractName(lines);
  const headline = extractHeadline(lines, name.value);
  const summary = extractSummary(lines);
  const emailList = extractEmails(rawText);
  const phones = extractPhones(rawText);
  const links = extractLinks(rawText);
  const locationMatches = collectLocationMatches(lines);
  const location = extractLocationField(lines, locationMatches);
  const skills = extractSkills(lines, rawText);
  const experience = extractExperience(lines, rawText);
  const education = extractEducation(lines);
  const projects = extractProjects(lines);
  const certifications = extractCertifications(lines);
  const languages = extractLanguages(lines);

  const currentTitle = extractCurrentTitle(experience, headline);
  const currentCompany = extractCurrentCompany(experience, location);
  const currentLocation = buildCurrentLocation(location, experience);
  const totalExperienceYears = calculateTotalExperienceYears(experience);

  const personal = {
    name,
    firstName: createValueEntry(name.firstName || null, {
      confidence: name.firstName ? 0.95 : 0,
      evidence: name.evidence || name.value || '',
      source: name.source || null,
    }),
    middleName: createValueEntry(name.middleName || null, {
      confidence: name.middleName ? 0.72 : 0,
      evidence: name.evidence || '',
      source: name.source || null,
    }),
    lastName: createValueEntry(name.lastName || null, {
      confidence: name.lastName ? 0.95 : 0,
      evidence: name.evidence || name.value || '',
      source: name.source || null,
    }),
    email: createValueEntry(emailList[0] || null, {
      confidence: emailList[0] ? 0.98 : 0,
      evidence: emailList[0] || '',
      source: lines.find((line) => (line.text || '').includes(emailList[0])) ? {
        page: lines.find((line) => (line.text || '').includes(emailList[0]))?.page || 1,
        section: lines.find((line) => (line.text || '').includes(emailList[0]))?.section || 'personal',
      } : null,
    }),
    alternatePhone: createValueEntry(phones[1] || null, {
      confidence: phones[1] ? 0.9 : 0,
      evidence: phones[1] || '',
      source: phones[1] ? { page: 1, section: 'personal' } : null,
    }),
    phone: createValueEntry(phones[0] || null, {
      confidence: phones[0] ? 0.96 : 0,
      evidence: phones[0] || '',
      source: phones[0] ? { page: 1, section: 'personal' } : null,
    }),
    location: currentLocation,
    headline,
    summary,
    links: {
      linkedin: createValueEntry(links.linkedin, { confidence: links.linkedin ? 0.96 : 0, evidence: links.linkedin || links.urls[0] || '', source: links.linkedin ? { page: 1, section: 'personal' } : null }),
      github: createValueEntry(links.github, { confidence: links.github ? 0.94 : 0, evidence: links.github || '', source: links.github ? { page: 1, section: 'personal' } : null }),
      portfolio: createValueEntry(links.portfolio, { confidence: links.portfolio ? 0.72 : 0, evidence: links.portfolio || '', source: links.portfolio ? { page: 1, section: 'personal' } : null }),
      website: createValueEntry(
        links.urls.find((url) => !LINKEDIN_RE.test(url) && !GITHUB_RE.test(url)) || null,
        { confidence: links.urls.length > 0 ? 0.66 : 0, evidence: links.urls[0] || '', source: links.urls.length > 0 ? { page: 1, section: 'personal' } : null }
      ),
      urls: links.urls,
    },
  };

  const professional = {
    headline,
    summary,
    currentTitle,
    currentCompany,
    totalExperience: createValueEntry(totalExperienceYears, {
      confidence: experience.length ? 0.8 : 0.42,
      evidence: experience.map((item) => item.evidence).join(' | '),
      source: experience[0]?.title?.source || null,
      mergedIntervals: calculateTotalExperienceMonths(experience).merged,
    }),
  };

  const preferences = {
    noticePeriod: createValueEntry(/immediate/i.test(rawText) ? 'Immediate' : null, {
      confidence: /immediate/i.test(rawText) ? 0.68 : 0,
      evidence: /immediate/i.test(rawText) ? 'Immediate availability' : '',
      source: { page: 1, section: 'personal' },
    }),
    preferredLocations: [],
    workMode: createValueEntry(/\b(remote|hybrid|onsite)\b/i.exec(rawText)?.[0] || null, {
      confidence: /\b(remote|hybrid|onsite)\b/i.test(rawText) ? 0.55 : 0,
      evidence: rawText,
      source: { page: 1, section: 'personal' },
    }),
    relocation: createValueEntry(/\b(relocat(?:e|ion)|open to move)\b/i.exec(rawText)?.[0] || null, {
      confidence: /\b(relocat(?:e|ion)|open to move)\b/i.test(rawText) ? 0.55 : 0,
      evidence: rawText,
      source: { page: 1, section: 'personal' },
    }),
  };

  const extraction = {
    schemaVersion: PARSER_VERSION,
    document: {
      type: document?.type || 'unknown',
      pages: document?.pages?.length || 0,
      layout: document?.layout || { type: 'unknown', columns: 1, confidence: 0 },
      source: fileMeta.originalname || document?.source || null,
      textLength,
    },
    personal,
    professional,
    experience,
    education,
    skills,
    projects,
    certifications,
    languages,
    links: personal.links,
    preferences,
    metadata: {
      parserVersion: PARSER_VERSION,
      source: {
        fileName: fileMeta.originalname || document?.source || null,
        mimeType: fileMeta.mimetype || null,
      },
      warnings: [],
      status: 'complete',
      confidence: {
        name: name.confidence,
        email: personal.email.confidence,
        phone: personal.phone.confidence,
        location: personal.location.confidence,
        currentCompany: professional.currentCompany.confidence,
        currentTitle: professional.currentTitle.confidence,
        experience: professional.totalExperience.confidence,
        education: education.length ? 0.72 : 0,
        skills: skills.length ? 0.88 : 0,
      },
    },
  };
  extraction.preferences.preferredLocations = locationMatches.length > 0
    ? locationMatches.map((item) => item.display)
    : (location?.value ? [location.value.normalized || location.value.raw || location.value.display || ''].filter(Boolean) : []);

  const warnings = validateExtraction(extraction);
  extraction.metadata.warnings = warnings;
  extraction.metadata.status = warnings.some((warning) => /OCR|layout|No employment|No education|not found/i.test(warning)) ? 'partial' : 'complete';
  extraction.metadata.confidence.overall = Number((
    [
      personal.name.confidence,
      personal.email.confidence,
      personal.phone.confidence,
      personal.location.confidence,
      professional.currentTitle.confidence,
      professional.currentCompany.confidence,
      professional.totalExperience.confidence,
      skills.length ? 0.8 : 0.2,
      education.length ? 0.7 : 0.2,
    ].reduce((sum, score) => sum + score, 0) / 9
  ).toFixed(2));

  extraction.candidateProfile = buildCandidateProfile(extraction);
  extraction.document.layout = document?.layout || extraction.document.layout;

  return extraction;
}

export function toCandidateFormPayload(extraction) {
  const profile = extraction?.candidateProfile || {};
  return {
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    email: profile.email || '',
    phone: profile.phone || '',
    location: profile.location || '',
    noticePeriod: profile.noticePeriod || '2 weeks',
    currentRole: profile.currentRole || '',
    currentCompany: profile.currentCompany || '',
    totalExperience: profile.totalExperience || 0,
    primarySkill: profile.primarySkill || '',
    secondarySkill: profile.secondarySkill || '',
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    education: Array.isArray(profile.education) ? profile.education : [],
    workHistory: Array.isArray(profile.workHistory) ? profile.workHistory : [],
    notes: profile.notes || '',
    linkedIn: profile.linkedIn || '',
    locationOptions: Array.isArray(profile.locationOptions) ? profile.locationOptions : [],
    _resumeUploaded: true,
    _resumeFileName: extraction?.metadata?.source?.fileName || '',
    _resumeExtractionStatus: extraction?.metadata?.status || 'partial',
    _resumeWarnings: extraction?.metadata?.warnings || [],
    _resumeConfidence: extraction?.metadata?.confidence || {},
    _resumeStructured: extraction || null,
  };
}

export function summarizeExtraction(extraction) {
  return {
    success: true,
    extraction,
    warnings: extraction?.metadata?.warnings || [],
    metadata: {
      parserVersion: extraction?.schemaVersion || PARSER_VERSION,
      status: extraction?.metadata?.status || 'partial',
      confidence: extraction?.metadata?.confidence || {},
    },
  };
}
