#!/usr/bin/env node
/**
 * build-vocab.mjs — 可复现的 DictionaryData -> 静态词库转换器。
 *
 * 数据来源（只读）: DictionaryData 仓库的 word.csv / word_translation.csv / book.csv / relation_book_word.zip
 * 种子数据: data/vocab_seed.json（mock 词表）+ scripts/vocab/enrichment/seed-*.json（AI 精校 senses/grammar）
 * 输出: data/vocab/（主副本）与 public/data/vocab/（镜像）
 *
 * 用法:
 *   node scripts/vocab/build-vocab.mjs \
 *     --dict D:/mo/dshweb/DictionaryData \
 *     --book 9fc3d7152ba9336a670e36d0 \
 *     --out data/vocab --mirror public/data/vocab \
 *     --seed data/vocab_seed.json
 *
 * 可重复性: 确定性排序、无时间戳；books.json 记录源文件行数作为指纹。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ---------- CLI ----------
function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { a[key] = next; i++; }
      else a[key] = true;
    } else a._.push(t);
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
const DICT = args.dict ?? 'D:/mo/dshweb/DictionaryData';
const SEED = args.seed ?? 'data/vocab_seed.json';
const OUT = args.out ?? 'data/vocab';
const MIRROR = args.mirror ?? 'public/data/vocab';
const ENRICH = args.enrichment ?? 'scripts/vocab/enrichment';
const CHUNK_SIZE = Number(args['chunk-size'] ?? 500);
if (!fs.existsSync(DICT)) { console.error('FAIL: dictionary repo not found: ' + DICT); process.exit(1); }
const repoRoot = path.resolve(import.meta.dirname ?? '.', '..', '..');

function outPath(...p) { return path.join(repoRoot, ...p); }

// ---------- 解析器 ----------
// word.csv / relation_book_word.csv: '>' 分隔
function parseGtCsv(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const t = line.replace(/\r$/, '');
    if (!t) continue;
    rows.push(t.split('>').map(s => { s = s.trim(); return (s.startsWith('"') && s.endsWith('"')) ? s.slice(1, -1) : s; }));
  }
  return rows;
}
// book.csv: 每行整体加引号，字段以 > 分隔（bk_id>...>bk_name>...）
function parseQuotedCsv(text) {
  const rows = [];
  let field = [], row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field.push('"'); i++; } else inQ = false; }
      else field.push(c);
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field.join('')); field = []; }
    else if (c === '\n') { row.push(field.join('')); field = []; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else if (c !== '\r') field.push(c);
  }
  if (field.length || row.length) { row.push(field.join('')); if (row.some(x => x !== '')) rows.push(row); }
  return rows;
}
// word_translation.csv: 行内每条记录是 "word","translation"，可能有引号转义与坏行
function parseTranslationCsv(text) {
  const map = new Map();
  let bad = 0, lineStart = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      const line = text.slice(lineStart, i).replace(/\r$/, '');
      lineStart = i + 1;
      if (!line.trim()) continue;
      const m = /^"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"$/.exec(line);
      if (!m) { bad++; continue; }
      const word = m[1].replace(/""/g, '"');
      const tr = m[2].replace(/""/g, '"');
      if (!map.has(word)) map.set(word, tr);
    }
  }
  return { map, bad };
}
// relation_book_word.zip（zip 只有一个 csv 条目）：纯 Node 读取（store 或 deflate）
function readZipEntry(zipPath, entryName) {
  const buf = fs.readFileSync(zipPath);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip EOCD not found in ' + zipPath);
  const entryCount = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  for (let e = 0; e < entryCount; e++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const cmtLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    if (name === entryName) {
      if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error('bad local header');
      const lnLen = buf.readUInt16LE(localOff + 26);
      const lexLen = buf.readUInt16LE(localOff + 28);
      const data = buf.subarray(localOff + 30 + lnLen + lexLen, localOff + 30 + lnLen + lexLen + compSize);
      if (method === 8) return zlib.inflateRawSync(data).toString('utf8');
      if (method === 0) return data.toString('utf8');
      throw new Error('unsupported zip method: ' + method);
    }
    ptr += 46 + nameLen + extraLen + cmtLen;
  }
  throw new Error('zip entry not found: ' + entryName);
}

// ---------- 词性/语法切分 ----------
const POS_RE = /(?:^|[;\s；])(n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|interj|abbr|aux|modal|pl)\./g;
function parseSenses(raw) {
  const clean = raw.trim();
  if (!clean) return { senses: [], parseKind: 'empty' };
  POS_RE.lastIndex = 0;
  const marks = [];
  let m;
  while ((m = POS_RE.exec(clean)) !== null) marks.push({ pos: m[1] + '.', start: m.index + m[0].length, end: m.index + m[0].length });
  if (marks.length === 0) return { senses: [{ pos: null, zh: clean }], parseKind: 'no-pos' };
  const senses = [];
  for (let i = 0; i < marks.length; i++) {
    const from = marks[i].start;
    const to = i + 1 < marks.length ? clean.lastIndexOf(';', marks[i + 1].index) : clean.length;
    let zh = (from <= to ? clean.slice(from, to) : '').trim();
    zh = zh.replace(/^[;；,，\s]+|[;；,，\s]+$/g, '');
    if (zh) senses.push({ pos: marks[i].pos, zh });
  }
  if (senses.length === 0) return { senses: [{ pos: null, zh: clean }], parseKind: 'no-pos' };
  return { senses, parseKind: marks.length > 1 ? 'multi' : 'single' };
}

// ---------- 屈折规则（种子书专用） ----------
const IRREG_VERB = {
  bid: { past: 'bid', pastParticiple: 'bid' },
};
const IRREG_NOUN = { crisis: 'crises' };
const NO_DOUBLE = new Set(['develop', 'benefit']);
const FORCE_DOUBLE = new Set(['admit', 'commit']);
function syllables(w) { return Math.max(1, (w.match(/[aeiouy]+/g) ?? []).length); }
function needsDouble(w) {
  if (!/[bcdfgklmnprstvwz]$/.test(w) || !/[aeiou][bcdfgklmnprstvwz]$/.test(w)) return false;
  if (FORCE_DOUBLE.has(w)) return true;
  if (NO_DOUBLE.has(w)) return false;
  const last3 = w.slice(-3);
  if (/^(?:[aeiou]{2}|[aeio]r|[aeio]l)[bcdfgklmnprstvwz]$/.test(last3)) return false;
  return true;
}
function deriveForms(word, pos, formsSourceRef) {
  const w = word.toLowerCase();
  const forms = {};
  if (IRREG_VERB[w]) { forms.past = IRREG_VERB[w].past; forms.pp = IRREG_VERB[w].pp; forms.presentParticiple = w + (needsDouble(w) ? w.slice(-1) : '') + 'ing'; forms.thirdPerson = w + 's'; formsSourceRef.v = 'irregular-table-v1'; return forms; }
  if (IRREG_NOUN[w]) { forms.plural = IRREG_NOUN[w]; formsSourceRef.v = 'irregular-table-v1'; return forms; }
  const isVerb = /^v(?:t|t\.|i|i\.)?$/.test((pos ?? '').replace(/\./g, '')) || /^(v|vt|vi)\./.test(pos ?? '');
  const isNoun = (pos ?? '').startsWith('n');
  const isAdj = (pos ?? '').startsWith('adj');
  const isAdv = (pos ?? '').startsWith('adv');
  if (isVerb) {
    const base = w;
    forms.thirdPerson = base + (/(?:s|x|z|ch|sh)$/.test(base) ? 'es' : base.endsWith('y') && !/[aeiou]y$/.test(base) ? 'ies' : 's');
    forms.past = base.endsWith('e') ? base + 'd' : needsDouble(base) ? base + base.slice(-1) + 'ed' : base.endsWith('y') && !/[aeiou]y$/.test(base) ? base.slice(0, -1) + 'ied' : base + 'ed';
    forms.ing = base.endsWith('e') && !base.endsWith('ee') ? base.slice(0, -1) + 'ing' : needsDouble(base) ? base + base.slice(-1) + 'ing' : base + 'ing';
    forms.pastParticiple = forms.past;
    formsSourceRef.v = 'rule-morph-v1';
  } else if (isNoun) {
    forms.plural = /(?:s|x|z|ch|sh)$/.test(w) ? w + 'es' : w.endsWith('y') && !/[aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /f$/.test(w) ? w.slice(0, -1) + 'ves' : /fe$/.test(w) ? w.slice(0, -2) + 'ves' : w + 's';
    formsSourceRef.v = 'rule-morph-v1';
  } else if (isAdj || isAdv) {
    if ((isAdv || w.endsWith('ly')) && isAdv) { /* -ly 副词: more/most */ }
    const syl = syllables(w);
    if ((isAdv && w.endsWith('ly')) || syl >= 3) { forms.comparative = 'more ' + w; forms.superlative = 'most ' + w; }
    else if (syl === 2 && w.endsWith('y') && !/[aeiou]y$/.test(w)) { forms.comparative = w.slice(0, -1) + 'ier'; forms.superlative = w.slice(0, -1) + 'iest'; }
    else if (syl <= 2) { forms.comparative = w + (needsDouble(w) ? w.slice(-1) : '') + 'er'; forms.superlative = w + (needsDouble(w) ? w.slice(-1) : '') + 'est'; }
    if (Object.keys(forms).length) formsSourceRef.v = 'rule-morph-v1';
  }
  return forms;
}

// ---------- 读源数据 ----------
console.log('[1/6] reading source CSVs from ' + DICT);
const wordRows = parseGtCsv(fs.readFileSync(path.join(DICT, 'word.csv'), 'utf8'));
const wordHeader = wordRows.shift();
if (wordHeader[0] !== 'vc_id' || wordHeader[1] !== 'vc_vocabulary') throw new Error('unexpected word.csv header: ' + wordHeader.join('>'));
const wordsById = new Map();
const idByWord = new Map();
for (const r of wordRows) {
  if (r.length < 7 || !r[0]) continue;
  const rec = { id: r[0], word: r[1], uk: r[2] || '', us: r[3] || '', freq: r[4] || '', diff: r[5] || '', ack: r[6] || '' };
  wordsById.set(rec.id, rec);
  if (!idByWord.has(rec.word.toLowerCase())) idByWord.set(rec.word.toLowerCase(), rec);
}
const { map: translations, bad: badTransLines } = parseTranslationCsv(fs.readFileSync(path.join(DICT, 'word_translation.csv'), 'utf8'));
function parseBookCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().replace(/^"+/, '').replace(/"+$/, '');
    if (!t) continue;
    rows.push(t.split('>'));
  }
  return rows;
}
const bookRows = parseBookCsv(fs.readFileSync(path.join(DICT, 'book.csv'), 'utf8'));
const bookHeader = bookRows.shift();
const booksById = new Map(bookRows.map(r => [r[0], { id: r[0], name: r[4] ?? '', desc: '' }]));
let relRows = [];
if (!args['no-relation']) {
  const csvText = readZipEntry(path.join(DICT, 'relation_book_word.zip'), 'relation_book_word.csv');
  relRows = parseGtCsv(csvText);
  relRows.shift();
}
const sourceStats = {
  dictionaryWordRows: wordRows.length, translationPairs: translations.size, badTranslationLines: badTransLines,
  bookRows: bookRows.length, relationRows: relRows.length,
};
console.log('  word.csv rows:', sourceStats.dictionaryWordRows, '| translations:', sourceStats.translationPairs, '(bad lines:', badTransLines + ')', '| books:', sourceStats.bookRows, '| relation rows:', sourceStats.relationRows);

// ---------- 种子书 ----------
console.log('[2/6] building seed book gk-core-140');
const seedRaw = JSON.parse(fs.readFileSync(outPath(SEED), 'utf8'));
if (!Array.isArray(seedRaw) || seedRaw.length !== 140) throw new Error('seed file must be a 140-word array, got ' + (seedRaw.length ?? 'non-array'));
const enrichFiles = fs.existsSync(outPath(ENRICH)) ? fs.readdirSync(outPath(ENRICH)).filter(f => /^seed-part\d+\.json$/.test(f)).sort() : [];
const enrichMap = new Map();
for (const f of enrichFiles) {
  for (const e of JSON.parse(fs.readFileSync(outPath(ENRICH, f), 'utf8'))) {
    if (enrichMap.has(e.word)) throw new Error('duplicate enrichment word: ' + e.word);
    enrichMap.set(e.word, e);
  }
}
const seedMissing = [];
const seedWords = seedRaw.map(item => {
  const w = item.word;
  const csvWord = idByWord.get(w.toLowerCase());
  const e = enrichMap.get(w);
  if (!csvWord) seedMissing.push(w);
  if (!e) seedMissing.push(w + ' [enrichment]');
  if (!csvWord || !e) return null;
  const senses = e.senses.map((s, i) => ({
    pos: s.pos, zh: s.zh, exampleEn: s.exampleEn, exampleZh: s.exampleZh,
    exampleSource: i === 0 && item.example && s.exampleEn.trim() === item.example.trim() ? 'seed-mock-v1' : 'ai-draft-v1',
  }));
  const grammarSrc = { v: 'ai-draft-v1' };
  const formsSrc = { v: 'rule-morph-v1' };
  const forms = deriveForms(csvWord.word, senses[0].pos, formsSrc);
  const rawTr = (translations.get(csvWord.word) ?? '').trim();
  const entry = {
    id: csvWord.id, word: csvWord.word, phoneticUk: csvWord.uk, phoneticUs: csvWord.us,
    frequency: Number(csvWord.freq) || 0, difficulty: item.difficulty, difficultyRaw: Number(csvWord.diff) || null,
    ackRate: Number(csvWord.ack) || 0, translationRaw: rawTr,
    translation: item.translation, senses, grammar: e.grammar, grammarSource: grammarSrc.v, formsSource: formsSrc.v,
  };
  if (rawTr.includes('//') || !rawTr) entry.needsReview = true;
  if (Object.keys(forms).length) entry.forms = forms;
  return entry;
});
if (seedMissing.length) { console.error('FAIL: seed words missing from dictionary/enrichment: ' + seedMissing.join(', ')); process.exit(1); }
const uncovered = [...enrichMap.keys()].filter(w => !seedRaw.some(s => s.word === w));
if (uncovered.length) { console.error('FAIL: enrichment has words not in seed: ' + uncovered.join(', ')); process.exit(1); }
seedWords.sort((a, b) => a.word.localeCompare(b.word, 'en'));
console.log('  seed entries:', seedWords.length, '| exampleSource mock:', seedWords.filter(w => w.senses.some(s => s.exampleSource === 'seed-mock-v1')).length, '| needsReview:', seedWords.filter(w => w.needsReview).length);

// ---------- 词典书 ----------
function mapDifficulty(rawDiff) {
  const d = Number(rawDiff);
  if (!Number.isFinite(d) || d < 1) return null;
  if (d <= 3) return 1;
  if (d <= 6) return 2;
  return 3;
}
const bookIds = (args.book ?? '9fc3d7152ba9336a670e36d0').split(',').map(s => s.trim()).filter(Boolean);
const dictBooks = [];
for (const bookId of bookIds) {
  const b = booksById.get(bookId);
  if (!b) { console.error('FAIL: book not in book.csv: ' + bookId); process.exit(1); }
  console.log('[3/6] building dictionary book ' + bookId + ' (' + b.name + ')');
  const rel = relRows.filter(r => r[1] === bookId).map(r => ({ voc: r[2], flag: r[3], tag: r[4], order: Number(r[5]) || 0 }));
  const tagRank = t => (t === '核心高频688词汇' ? 0 : t === '核心扩展110词汇' ? 1 : 2);
  rel.sort((a, b2) => tagRank(a.tag) - tagRank(b2.tag) || a.order - b2.order);
  const seenVoc = new Set();
  const words = [];
  let noTranslation = 0, needsReview = 0, multi = 0, single = 0, noPos = 0;
  const diffCount = { 1: 0, 2: 0, 3: 0 };
  for (const r of rel) {
    const rec = wordsById.get(r.voc);
    if (!rec || seenVoc.has(r.voc)) continue;
    seenVoc.add(r.voc);
    const rawTr = (translations.get(rec.word) ?? '').trim();
    const { senses, parseKind } = parseSenses(rawTr);
    if (parseKind === 'empty') noTranslation++;
    else if (parseKind === 'multi') multi++;
    else if (parseKind === 'no-pos') noPos++;
    else single++;
    const bad = !rawTr || rawTr.includes('//');
    if (bad) needsReview++;
    const d = mapDifficulty(rec.diff);
    if (d) diffCount[d]++;
    const entry = {
      id: rec.id, word: rec.word, phoneticUk: rec.uk, phoneticUs: rec.us,
      frequency: Number(rec.freq) || 0, difficulty: d, difficultyRaw: Number(rec.diff) || null,
      ackRate: Number(rec.ack) || 0, translation: rawTr, translationRaw: rawTr,
      senses: senses.map(s => ({ pos: s.pos, zh: s.zh })),
      unit: r.tag || undefined, order: r.order,
    };
    if (bad) entry.needsReview = true;
    words.push(entry);
  }
  const slug = 'gk688';
  dictBooks.push({ bookId, name: b.name, slug, words, stats: { noTranslation, needsReview, parseMultiSense: multi, parseSingleSense: single, parseNoPos: noPos, difficulty: diffCount }, relCount: rel.length });
  console.log('  relation rows:', rel.length, '| unique words:', words.length, '| noTranslation:', noTranslation, '| needsReview:', needsReview);
}

// ---------- 写出 ----------
console.log('[4/6] writing output to ' + OUT + (MIRROR ? ' (mirror: ' + MIRROR + ')' : ''));
fs.rmSync(outPath(OUT), { recursive: true, force: true });
fs.mkdirSync(outPath(OUT), { recursive: true });
function writeJson(rel, obj) {
  const p = outPath(OUT, rel);
  fs.writeFileSync(p, JSON.stringify(obj, null, 1) + '\n');
  if (MIRROR) {
    const mp = outPath(MIRROR, rel);
    fs.mkdirSync(path.dirname(mp), { recursive: true });
    fs.copyFileSync(p, mp);
  }
  return rel;
}
function writeBook(slug, words, extraIndex) {
  const chunks = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE) chunks.push(words.slice(i, i + CHUNK_SIZE));
  const chunkFiles = chunks.map((chunk, idx) =>
    writeJson(`words.${slug}.${String(idx + 1).padStart(3, '0')}.json`, { schemaVersion: 1, book: slug, chunk: idx + 1, chunkCount: chunks.length, words: chunk }));
  const indexFile = writeJson(`index.${slug}.json`, {
    schemaVersion: 1, book: slug, count: words.length, chunkCount: chunks.length, chunkFiles,
    ...extraIndex, words: words.map(w => ({ id: w.id, word: w.word, difficulty: w.difficulty })),
  });
  return { chunkFiles, indexFile };
}
const booksManifest = [];
{
  const w = seedWords;
  const stats = { noTranslation: w.filter(x => !x.translationRaw).length, needsReview: w.filter(x => x.needsReview).length };
  const f = writeBook('gk-core-140', w, { name: '高考高频核心词', kind: 'seed', fillLevel: 'full', missingFields: [] });
  booksManifest.push({
    id: 'gk-core-140', name: '高考高频核心词', kind: 'seed', fillLevel: 'full', missingFields: [],
    wordCount: w.length, chunkSize: CHUNK_SIZE, chunks: f.chunkFiles.length, indexFile: f.indexFile, chunkFiles: f.chunkFiles, stats: { ...stats, exampleSourceMock: w.filter(x => x.senses.some(s => s.exampleSource === 'seed-mock-v1')).length, exampleSourceAi: w.filter(x => x.senses.some(s => s.exampleSource === 'ai-draft-v1')).length },
  });
}
for (const db of dictBooks) {
  const w = db.words;
  const f = writeBook(db.slug, w, { name: db.name, kind: 'dictionary', sourceBookId: db.bookId, fillLevel: 'dictionary-only', missingFields: ['senses.example', 'grammar', 'forms'] });
  booksManifest.push({
    id: db.slug, name: db.name, kind: 'dictionary', sourceBookId: db.bookId, fillLevel: 'dictionary-only',
    missingFields: ['senses.example', 'grammar', 'forms'],
    wordCount: w.length, chunkSize: CHUNK_SIZE, chunks: f.chunkFiles.length, indexFile: f.indexFile, chunkFiles: f.chunkFiles, stats: db.stats,
  });
}
booksManifest.sort((a, b) => a.id.localeCompare(b.id));
const manifest = {
  schemaVersion: 1,
  generator: { tool: 'scripts/vocab/build-vocab.mjs', sourceDataset: 'DictionaryData', sourceLicense: 'Apache-2.0', licenseFile: 'LICENSE', noticeFile: 'NOTICE.md' },
  sourceStats,
  difficultyMapping: { scale: [1, 3], rule: 'difficultyRaw<=3 -> 1; 4-6 -> 2; >=7 -> 3' },
  books: booksManifest,
};
writeJson('books.json', manifest);
fs.copyFileSync(path.join(DICT, 'LICENSE'), outPath(OUT, 'LICENSE'));
const NOTICE = [
  '# NOTICE — vocab data modifications', '',
  '词库数据衍生自 DictionaryData（Apache-2.0 LICENSE 已随附于本目录）。', '',
  '## Modifications / 相对原始数据集的修改', '',
  '- 从 word.csv / word_translation.csv / book.csv / relation_book_word.zip 抽取子集（按书），转换为 JSON 分片。',
  '- 难度映射为站点 1-3 刻度（difficultyRaw<=3 -> 1; 4-6 -> 2; >=7 -> 3），difficultyRaw 保留。',
  '- 种子书 gk-core-140 的 senses（释义+例句）与 grammar 字段为 AI 辅助撰写（exampleSource=seed-mock-v1 / ai-draft-v1，grammarSource/formsSource 见各条目），并非原数据集内容；原词汇与释义行保留在 translationRaw。',
  '- 词典书 gk688 仅含原数据集字段（无例句/语法/屈折），由 books.json 的 missingFields 声明。',
  '', '原始许可与版权声明见同目录 LICENSE（Apache-2.0）。',
].join('\n');
fs.writeFileSync(outPath(OUT, 'NOTICE.md'), NOTICE + '\n');
if (MIRROR) fs.writeFileSync(outPath(MIRROR, 'NOTICE.md'), NOTICE + '\n');
if (MIRROR) { fs.mkdirSync(outPath(MIRROR), { recursive: true }); fs.copyFileSync(path.join(DICT, 'LICENSE'), outPath(MIRROR, 'LICENSE')); }

// ---------- 汇总 ----------
console.log('[5/6] copying LICENSE from ' + DICT + ' and writing NOTICE.md');
console.log('[6/6] build summary');
for (const b of booksManifest) {
  console.log(`  book ${b.id}: ${b.wordCount} words, ${b.chunks} chunks, fillLevel=${b.fillLevel}, needsReview=${b.stats.needsReview ?? 0}`);
}
console.log('done.');
