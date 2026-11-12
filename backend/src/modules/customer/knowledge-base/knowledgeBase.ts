import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { TextDecoder } from 'util';
import { AiAgentPrincipal, AiAgentRole } from '../ai-agent/types';
import { KnowledgeDocumentSubmission, KnowledgeReference, KnowledgeSearchResult } from './types';

const roles = new Set<AiAgentRole>(['PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN']);
const categories = new Set(['KB-01', 'KB-02', 'KB-03', 'KB-04', 'KB-05']);
const statuses = new Set(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'REVOKED']);
const stopWords = new Set([
  'para', 'como', 'desde', 'donde', 'cuando', 'cual', 'cuales', 'cuanto', 'cuanta',
  'este', 'esta', 'estos', 'estas', 'sobre', 'entre', 'con', 'sin', 'por', 'del',
  'las', 'los', 'una', 'uno', 'unos', 'unas', 'que', 'son', 'ser', 'debe', 'deben',
  'puede', 'pueden', 'puedo', 'hacer', 'tener', 'tiene', 'tienen', 'hay', 'the',
  'and', 'for', 'with'
]);

interface Chunk {
  id: string;
  documentCode: string;
  title: string;
  category: KnowledgeDocumentSubmission['category'];
  version: number;
  status: KnowledgeDocumentSubmission['status'];
  allowedRoles: AiAgentRole[];
  validFrom: number;
  validUntil?: number;
  approvedBy?: string;
  section: string;
  text: string;
  tokens: string[];
  hash: string;
}

export interface KnowledgeBaseOptions {
  chunkChars?: number;
  maxDocumentChars?: number;
  maxResults?: number;
  minimumScore?: number;
  now?: () => Date;
}

function tokenize(text: string): string[] {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]{2,}/g)?.filter(token => !stopWords.has(token)) ?? [];
}

function cleanText(markdown: string): string {
  return markdown
    .replace(/^\uFEFF/, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function splitSections(content: string): Array<{ section: string; text: string }> {
  const sections: Array<{ section: string; text: string }> = [];
  let title = 'Contenido';
  let paragraphs: string[] = [];
  const flush = () => {
    const text = paragraphs.join('\n\n').trim();
    if (text) sections.push({ section: title, text });
    paragraphs = [];
  };
  for (const line of content.split('\n')) {
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      title = heading[2].replace(/[*_`]/g, '').trim();
    } else if (!line.trim()) {
      flush();
    } else {
      paragraphs.push(line.trim());
    }
  }
  flush();
  return sections;
}

function splitLongText(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const result: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current) result.push(current), current = '';
      const sentences = paragraph.match(/[^.!?]+[.!?]?(?:\s+|$)/g) ?? [paragraph];
      let part = '';
      for (const sentence of sentences) {
        const next = part ? `${part} ${sentence.trim()}` : sentence.trim();
        if (next.length > maxChars && part) result.push(part), part = sentence.trim();
        else if (next.length > maxChars) {
          for (let offset = 0; offset < next.length; offset += maxChars) result.push(next.slice(offset, offset + maxChars));
          part = '';
        } else part = next;
      }
      if (part) result.push(part);
      continue;
    }
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > maxChars && current) result.push(current), current = paragraph;
    else current = next;
  }
  if (current) result.push(current);
  return result;
}

export class LocalKnowledgeBase {
  private readonly chunks: Chunk[] = [];
  private readonly contentHashes = new Set<string>();
  private readonly auditEvents: Array<{ correlationId: string; role: AiAgentRole; resultChunkIds: string[]; at: string }> = [];
  private readonly chunkChars: number;
  private readonly maxDocumentChars: number;
  private readonly maxResults: number;
  private readonly minimumScore: number;
  private readonly now: () => Date;

  constructor(options: KnowledgeBaseOptions = {}) {
    this.chunkChars = options.chunkChars ?? 900;
    this.maxDocumentChars = options.maxDocumentChars ?? 100_000;
    this.maxResults = options.maxResults ?? 5;
    this.minimumScore = options.minimumScore ?? 0.15;
    this.now = options.now ?? (() => new Date());
    if (this.chunkChars < 100 || this.maxDocumentChars < this.chunkChars || this.maxResults < 1) throw new Error('Configuración inválida para la base de conocimiento.');
  }

  ingest(input: KnowledgeDocumentSubmission): { code: string; version: number; chunksCreated: number; contentHash: string } {
    this.validate(input);
    const content = cleanText(input.content);
    if (this.hasPotentialPersonalData(content)) throw new Error('El documento contiene patrones de datos personales; requiere saneamiento y revisión autorizada.');
    const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    if (this.contentHashes.has(contentHash)) throw new Error('El contenido ya está indexado y no se puede duplicar como otro documento o versión.');
    if (this.chunks.some(chunk => chunk.documentCode === input.code && chunk.version === input.version)) throw new Error('La versión documental ya existe.');
    const previousVersions = this.chunks.filter(chunk => chunk.documentCode === input.code).map(chunk => chunk.version);
    if (previousVersions.length && input.version <= Math.max(...previousVersions)) throw new Error('La nueva versión debe ser mayor que todas las versiones existentes.');

    const validFrom = input.validFrom ? Date.parse(input.validFrom) : this.now().getTime();
    const validUntil = input.validUntil ? Date.parse(input.validUntil) : undefined;
    const sections = splitSections(content);
    const prepared = sections.flatMap(section => splitLongText(section.text, this.chunkChars).map((text, index) => ({ section: section.section, text, index })));
    if (!prepared.length) throw new Error('No se pudo extraer texto indexable del documento.');

    if (input.status === 'PUBLISHED') {
      for (const chunk of this.chunks) {
        if (chunk.documentCode === input.code && chunk.status === 'PUBLISHED') chunk.status = 'SUPERSEDED';
      }
    }

    prepared.forEach((part, ordinal) => {
      const id = `${input.code}:v${input.version}:c${ordinal + 1}`;
      this.chunks.push({
        id,
        documentCode: input.code,
        title: input.title.trim(),
        category: input.category,
        version: input.version,
        status: input.status,
        allowedRoles: [...new Set(input.allowedRoles)],
        validFrom,
        validUntil,
        approvedBy: input.approvedBy,
        section: part.section,
        text: part.text,
        tokens: tokenize(part.text),
        hash: crypto.createHash('sha256').update(`${contentHash}:${part.section}:${part.index}:${part.text}`).digest('hex'),
      });
    });
    this.contentHashes.add(contentHash);
    return { code: input.code, version: input.version, chunksCreated: prepared.length, contentHash };
  }

  async ingestFile(rootDirectory: string, filePath: string, metadata: Omit<KnowledgeDocumentSubmission, 'fileName' | 'content'>): Promise<{ code: string; version: number; chunksCreated: number; contentHash: string }> {
    const root = await fs.realpath(rootDirectory);
    const file = await fs.realpath(filePath);
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('El archivo debe estar dentro del directorio documental autorizado.');
    if (!/\.(md|txt)$/i.test(file)) throw new Error('Solo se admiten archivos Markdown y texto plano.');
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > this.maxDocumentChars) throw new Error('El documento no es un archivo regular o excede el tamaño máximo.');
    const bytes = await fs.readFile(file);
    let content: string;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('El documento debe estar codificado en UTF-8 válido.'); }
    return this.ingest({ ...metadata, fileName: path.basename(file), content });
  }

  revoke(code: string, version: number, principal: AiAgentPrincipal): void {
    if (principal.role !== 'ADMIN' || !principal.idUsuario) throw new Error('Solo administración autenticada puede revocar documentos.');
    const target = this.chunks.filter(chunk => chunk.documentCode === code && chunk.version === version);
    if (!target.length) throw new Error('Documento no encontrado.');
    target.forEach(chunk => { chunk.status = 'REVOKED'; });
  }

  search(query: string, principal: AiAgentPrincipal, options: { limit?: number; correlationId?: string; category?: KnowledgeDocumentSubmission['category'] } = {}): KnowledgeSearchResult {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length > 500) throw new Error('La consulta debe tener entre 1 y 500 caracteres.');
    const queryTokens = [...new Set(tokenize(cleanQuery))];
    const limit = Math.min(this.maxResults, Math.max(1, Math.trunc(options.limit ?? this.maxResults)));
    const now = this.now().getTime();
    // ACL y estado se aplican antes del cálculo de relevancia para no filtrar metadatos restringidos.
    const authorized = this.chunks.filter(chunk =>
      chunk.status === 'PUBLISHED' &&
      chunk.allowedRoles.includes(principal.role) &&
      chunk.validFrom <= now &&
      (chunk.validUntil === undefined || chunk.validUntil >= now) &&
      (!options.category || chunk.category === options.category)
    );
    const documentFrequency = new Map<string, number>();
    for (const token of queryTokens) {
      documentFrequency.set(token, authorized.filter(chunk => chunk.tokens.includes(token)).length);
    }
    const ranked = authorized.map(chunk => {
      const counts = new Map<string, number>();
      chunk.tokens.forEach(token => counts.set(token, (counts.get(token) ?? 0) + 1));
      const score = queryTokens.reduce((sum, token) => {
        const tf = counts.get(token) ?? 0;
        if (!tf) return sum;
        const df = documentFrequency.get(token) ?? 0;
        const idf = Math.log(1 + (authorized.length - df + 0.5) / (df + 0.5));
        return sum + idf * ((tf * 2.2) / (tf + 1.2));
      }, 0);
      return { chunk, score };
    }).filter(item => item.score >= this.minimumScore).sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id)).slice(0, limit);

    const results = ranked.map(({ chunk, score }) => ({
      reference: this.reference(chunk),
      excerpt: chunk.text,
      score: Number(score.toFixed(4)),
    }));
    if (options.correlationId) this.auditEvents.push({ correlationId: options.correlationId, role: principal.role, resultChunkIds: results.map(result => result.reference.chunkId), at: this.now().toISOString() });
    return results.length ? { sufficientEvidence: true, results } : { sufficientEvidence: false, results: [], limitation: 'NO_AUTHORIZED_EVIDENCE' };
  }

  getReference(reference: KnowledgeReference, principal: AiAgentPrincipal): KnowledgeReference | undefined {
    const chunk = this.chunks.find(item => item.id === reference.chunkId && item.documentCode === reference.documentCode && item.version === reference.version);
    if (!chunk || chunk.title !== reference.title || chunk.section !== reference.section || chunk.status !== 'PUBLISHED' || !chunk.allowedRoles.includes(principal.role)) return undefined;
    const now = this.now().getTime();
    if (chunk.validFrom > now || (chunk.validUntil !== undefined && chunk.validUntil < now)) return undefined;
    return this.reference(chunk);
  }

  getAuditEvents(): ReadonlyArray<{ correlationId: string; role: AiAgentRole; resultChunkIds: string[]; at: string }> {
    return this.auditEvents.map(event => ({ ...event, resultChunkIds: [...event.resultChunkIds] }));
  }

  get indexedChunkCount(): number { return this.chunks.length; }

  private reference(chunk: Chunk): KnowledgeReference {
    return { documentCode: chunk.documentCode, title: chunk.title, version: chunk.version, section: chunk.section, chunkId: chunk.id };
  }

  private validate(input: KnowledgeDocumentSubmission): void {
    if (!input || !/^[A-Z0-9][A-Z0-9._-]{1,59}$/.test(input.code) || !input.title?.trim() || input.title.length > 180) throw new Error('Código o título documental inválido.');
    if (!/^[A-Za-z0-9._-]+\.(md|txt)$/i.test(input.fileName) || input.fileName.includes('..')) throw new Error('Solo se admiten archivos Markdown y texto plano con nombre seguro.');
    if (!categories.has(input.category) || !statuses.has(input.status) || !Number.isInteger(input.version) || input.version < 1) throw new Error('Categoría, estado o versión documental inválidos.');
    if (typeof input.content !== 'string' || !input.content.trim() || Buffer.byteLength(input.content, 'utf8') > this.maxDocumentChars) throw new Error('El documento está vacío o excede el tamaño máximo.');
    if (!input.declaredNoPersonalData) throw new Error('El documento debe declararse libre de datos personales antes de procesarlo.');
    if (!input.allowedRoles.length || input.allowedRoles.some(role => !roles.has(role))) throw new Error('La política de acceso documental es inválida.');
    if (input.status === 'PUBLISHED' && (!input.approvedBy?.trim() || !input.approvedAt || !Number.isFinite(Date.parse(input.approvedAt)))) throw new Error('Publicar requiere responsable y fecha de aprobación verificables.');
    if (input.validFrom && !Number.isFinite(Date.parse(input.validFrom))) throw new Error('Fecha de vigencia inválida.');
    if (input.validUntil && !Number.isFinite(Date.parse(input.validUntil))) throw new Error('Fecha de expiración inválida.');
    if (input.validFrom && input.validUntil && Date.parse(input.validUntil) < Date.parse(input.validFrom)) throw new Error('El rango de vigencia es inválido.');
  }

  private hasPotentialPersonalData(text: string): boolean {
    return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text) ||
      /\b\d{8}\b/.test(text) ||
      /\b(?:\+?51[\s-]?)?9\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/.test(text);
  }
}
