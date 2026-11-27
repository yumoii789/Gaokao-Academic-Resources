// 词汇数据校验器：对 data/vocab/*.json 做结构与内容一致性检查（只读）。
// 用法: node scripts/vocab/validate-vocab.mjs [--dir data/vocab] [--mirror public/data/vocab]
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function argOf(name, dflt) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
}
const dir = argOf('dir', 'data/vocab');
const mirror = argOf('mirror', 'public/data/vocab');
const errors = [];
const infos = [];
function fail(msg) { errors.push(msg); }
function info(msg) { infos.push(msg); }
function j(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function exists(p) { return fs.existsSync(p); }

if (!exists(dir)) { fail('数据目录不存在: ' + dir); finish(); }
if (!exists(path.join(dir, 'books.json'))) fail('缺少 books.json');

let books = null;
try { books = j(path.join(dir, 'books.json')); } catch (e) { fail('books.json 解析失败: ' + e.message); }

if (books) {
  if (books.schemaVersion !== 1) fail('books.json schemaVersion !== 1');
  if (!Array.isArray(books.books) || books.books.length === 0) fail('books.json books 为空');
  const allIds = new Map(); // id -> bookId
  for (const b of books.books ?? []) {
    if (!b.id) fail('book 缺 id');
    if (typeof b.wordCount !== 'number') fail('book ' + b.id + ' 缺 wordCount');
    if (!b.indexFile || !exists(path.join(dir, b.indexFile))) fail('book ' + b.id + ' 缺 indexFile: ' + b.indexFile);
    if (!Array.isArray(b.chunkFiles) || b.chunkFiles.length === 0) fail('book ' + b.id + ' 缺 chunkFiles');
    for (const c of b.chunkFiles ?? []) if (!exists(path.join(dir, c))) fail('book ' + b.id + ' 缺 chunk 文件: ' + c);
    if (b.fillLevel === 'full' && (b.missingFields ?? []).length) fail('book ' + b.id + ' fillLevel=full 但声明了 missingFields');
    if (b.fillLevel === 'dictionary-only' && !(b.missingFields ?? []).length) fail('book ' + b.id + ' dictionary-only 应声明 missingFields');

    // index
    let idx = null;
    try { idx = j(path.join(dir, b.indexFile)); } catch (e) { fail('index 解析失败: ' + b.indexFile); continue; }
    if (idx.schemaVersion !== 1) fail(b.indexFile + ' schemaVersion !== 1');
    if (idx.book !== b.id) fail(b.indexFile + ' book 与 books.json 不一致');
    const idxWords = idx.words ?? [];
    if (idx.count !== undefined && idx.count !== idxWords.length) fail(b.indexFile + ' count 与 words 长度不一致');
    if (idx.chunkCount !== (b.chunkFiles ?? []).length) fail(b.indexFile + ' chunkCount 不一致');
    if (idx.chunkCount !== b.chunks) fail(b.indexFile + ' chunkCount 与 books.json chunks 不一致');
    if (idxWords.length !== b.wordCount) fail('book ' + b.id + ' index 词数 ' + idxWords.length + ' != wordCount ' + b.wordCount);
    for (const w of idxWords) {
      if (typeof w.id !== 'string' || !w.id) fail(b.indexFile + ' 词条缺 id');
      if (typeof w.word !== 'string' || !w.word) fail(b.indexFile + ' 词条缺 word');
      if (![1, 2, 3].includes(w.difficulty)) fail(b.indexFile + ' ' + w.word + ' difficulty 非法');
    }
    // chunks
    const chunkWords = [];
    (b.chunkFiles ?? []).forEach((cf, ci) => {
      let chunk = null;
      try { chunk = j(path.join(dir, cf)); } catch (e) { fail('chunk 解析失败: ' + cf); return; }
      if (chunk.schemaVersion !== 1) fail(cf + ' schemaVersion !== 1');
      if (chunk.book !== b.id) fail(cf + ' book 不一致');
      if (chunk.chunk !== ci + 1) fail(cf + ' chunk 序号应为 ' + (ci + 1));
      if (chunk.chunkCount !== b.chunks) fail(cf + ' chunkCount 不一致');
      const ws = chunk.words ?? [];
      if (ws.length > 500) fail(cf + ' 超过 500 词/片 (' + ws.length + ')');
      chunkWords.push(...ws);
    });
    if (chunkWords.length !== b.wordCount) fail('book ' + b.id + ' chunk 词数合计 ' + chunkWords.length + ' != wordCount ' + b.wordCount);
    // id/word 一致性 index<->chunk
    const idxById = new Map(idxWords.map(w => [w.id, w]));
    chunkWords.forEach((w, i) => {
      if (!w.id || !w.word) fail('book ' + b.id + ' 词条缺 id/word');
      const iw = idxById.get(w.id);
      if (!iw) fail('book ' + b.id + ' chunk 词条 ' + w.word + ' 不在 index 中');
      else if (iw.word !== w.word) fail('book ' + b.id + ' id=' + w.id + ' index/chunk word 不一致');
      if (w.difficulty !== idxById.get(w.id)?.difficulty) fail('book ' + b.id + ' id=' + w.id + ' difficulty 不一致');
      const prev = allIds.get(w.id);
      if (prev && prev !== b.id) info('跨书 id 复用: ' + w.word + ' (' + prev + ' & ' + b.id + ')');
      allIds.set(w.id, b.id);
    });
    // 每本书内部结构
    for (const w of chunkWords) {
      if (!Array.isArray(w.senses)) fail(b.id + ' ' + w.word + ' senses 非数组');
      if (typeof w.translationRaw !== 'string') fail(b.id + ' ' + w.word + ' 缺 translationRaw');
      if (typeof w.translation !== 'string') fail(b.id + ' ' + w.word + ' 缺 translation');
      if (w.needsReview === true && typeof w.translationRaw === 'string' && w.translationRaw && !w.translationRaw.includes('//')) {
        // needsReview 允许 NULL/空翻译；不额外报错
      }
      if (b.kind === 'seed') {
        if (!w.senses?.length) fail(b.id + ' ' + w.word + ' 种子书 senses 为空');
        for (const s of w.senses ?? []) {
          if (!s.pos || !s.zh || !s.exampleEn || !s.exampleZh || !s.exampleSource) fail(b.id + ' ' + w.word + ' sense 字段不全');
        }
        if (!w.grammar || w.grammarSource !== 'ai-draft-v1') fail(b.id + ' ' + w.word + ' 种子书缺 grammar/grammarSource');
        const NON_INFLECT = new Set(['prep.', 'conj.', 'adv.', 'int.', 'art.', 'det.', 'num.']);
        const canInflect = (w.senses ?? []).some(s => !NON_INFLECT.has(s.pos));
        if (canInflect && (!w.forms || !Object.keys(w.forms).length || !w.formsSource)) fail(b.id + ' ' + w.word + ' 种子书缺 forms/formsSource');
        if (w.forms && !w.formsSource) fail(b.id + ' ' + w.word + ' forms 缺 formsSource');
      }
      if (b.kind === 'dictionary') {
        if (typeof w.unit !== 'string' || !w.unit) fail(b.id + ' ' + w.word + ' 缺 unit');
        if (typeof w.order !== 'number') fail(b.id + ' ' + w.word + ' 缺 order');
        if ('grammar' in w || 'forms' in w) fail(b.id + ' ' + w.word + ' dictionary-only 不应携带 grammar/forms');
        if (w.senses?.some(s => 'exampleEn' in s)) fail(b.id + ' ' + w.word + ' dictionary-only 不应携带例句');
      }
    }
    const seen = new Set();
    for (const w of chunkWords) { if (seen.has(w.id)) fail('book ' + b.id + ' id 重复: ' + w.id); seen.add(w.id); }
  }
  if (books.sourceStats && typeof books.sourceStats.relationRows !== 'number') fail('sourceStats.relationRows 缺失');
}

if (exists(mirror)) {
  const a = fs.readdirSync(dir).sort().join(',');
  const m = fs.readdirSync(mirror).sort().join(',');
  if (a !== m) fail('镜像目录与源目录文件列表不一致');
  else {
    for (const f of fs.readdirSync(dir)) {
      if (fs.readFileSync(path.join(dir, f)).length !== fs.readFileSync(path.join(mirror, f)).length) fail('镜像内容不一致: ' + f);
    }
  }
} else fail('镜像目录不存在: ' + mirror);

if (!exists(path.join(dir, 'LICENSE'))) fail('缺少 LICENSE');
if (!exists(path.join(dir, 'NOTICE.md'))) fail('缺少 NOTICE.md');
const lic = exists(path.join(dir, 'LICENSE')) ? fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8') : '';
if (!lic.includes('Apache License')) fail('LICENSE 不是 Apache-2.0 文本');

function finish() {
  for (const i of infos) console.log('INFO: ' + i);
  if (errors.length) { for (const e of errors) console.error('FAIL: ' + e); console.log('\n' + errors.length + ' 项失败'); process.exit(1); }
  console.log('PASS: 词汇数据校验通过 (' + (books?.books?.length ?? 0) + ' 本书, ' + infos.length + ' 条提示)');
}
finish();
