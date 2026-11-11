import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../db';
import { AiAgentError, AiAgentPrincipal, AiAgentRole } from '../ai-agent/types';
import { metricsCollector } from '../ai-agent/monitoring/metricsCollector';
import { extractTextFromDocx, extractTextFromPdf } from './documentParsers';
import { LocalKnowledgeBase } from './knowledgeBase';
import { KnowledgeDocumentSubmission, KnowledgeReference, KnowledgeSearchResult } from './types';

export interface StoredDocument {
  code: string;
  title: string;
  category: string;
  active: boolean;
  createdAt: string;
  versions: StoredVersion[];
}

export interface StoredVersion {
  version: number;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'SUPERSEDED' | 'REVOKED';
  content: string;
  format: 'MD' | 'TXT' | 'DOCX' | 'PDF';
  contentHash: string;
  allowedRoles: AiAgentRole[];
  validFrom: string;
  validUntil?: string;
  createdById: number;
  reviewedById?: number;
  approvedById?: number;
  approvedAt?: string;
  publishedAt?: string;
  revokedAt?: string;
  revocationReason?: string;
}

export class DurableKnowledgeService {
  private readonly storagePath: string;
  private readonly kb: LocalKnowledgeBase;
  private documents: Map<string, StoredDocument> = new Map();

  constructor(customStorageDir?: string) {
    const dir = customStorageDir || path.join(process.cwd(), 'storage', 'knowledge');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.storagePath = path.join(dir, 'knowledgeStore.json');
    this.kb = new LocalKnowledgeBase();
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (fs.existsSync(this.storagePath)) {
      try {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const list: StoredDocument[] = JSON.parse(raw);
        this.documents = new Map(list.map(d => [d.code, d]));
        this.rebuildIndex();
      } catch (err) {
        console.error('[DurableKnowledgeService] Error al cargar almacenamiento RAG de disco:', err);
      }
    }
  }

  private saveToDisk(): void {
    const list = Array.from(this.documents.values());
    const tempPath = `${this.storagePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(list, null, 2), 'utf8');
      fs.renameSync(tempPath, this.storagePath);
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      throw error;
    }
  }

  public rebuildIndex(): void {
    // Reconstruir el índice de LocalKnowledgeBase a partir de las versiones publicadas en disco
    const newKb = new LocalKnowledgeBase();
    for (const doc of this.documents.values()) {
      if (!doc.active) continue;
      // Ingestar en orden de versión
      const sortedVersions = [...doc.versions].sort((a, b) => a.version - b.version);
      for (const ver of sortedVersions) {
        if (ver.status === 'PUBLISHED') {
          newKb.ingest({
            code: doc.code,
            title: doc.title,
            category: doc.category as KnowledgeDocumentSubmission['category'],
            fileName: `${doc.code}_v${ver.version}.${ver.format.toLowerCase() === 'md' ? 'md' : 'txt'}`,
            content: ver.content,
            status: 'PUBLISHED',
            allowedRoles: ver.allowedRoles,
            version: ver.version,
            declaredNoPersonalData: true,
            approvedBy: `User-${ver.approvedById}`,
            approvedAt: ver.approvedAt,
            validFrom: ver.validFrom,
            validUntil: ver.validUntil
          });
        }
      }
    }
    // Asignar chunks
    (this.kb as any).chunks.length = 0;
    (this.kb as any).chunks.push(...(newKb as any).chunks);
    (this.kb as any).contentHashes.clear();
    for (const h of (newKb as any).contentHashes) {
      (this.kb as any).contentHashes.add(h);
    }
  }

  /**
   * Registro inicial de un documento institucional.
   * Requiere rol ADMIN o auditor institucional.
   */
  public registerDocument(principal: AiAgentPrincipal, input: { code: string; title: string; category: string }): StoredDocument {
    if (principal.role !== 'ADMIN') throw new AiAgentError('FORBIDDEN', 'Solo un administrador puede registrar documentos institucionales.');
    if (!/^[A-Z0-9][A-Z0-9._-]{1,59}$/.test(input.code)) throw new AiAgentError('INVALID_INPUT', 'Código de documento no cumple formato institucional.');
    if (!input.title?.trim() || input.title.length > 180) throw new AiAgentError('INVALID_INPUT', 'Título de documento inválido.');

    if (this.documents.has(input.code)) {
      throw new AiAgentError('CONFLICT', `El documento ${input.code} ya existe.`);
    }

    const doc: StoredDocument = {
      code: input.code,
      title: input.title.trim(),
      category: input.category,
      active: true,
      createdAt: new Date().toISOString(),
      versions: []
    };
    this.documents.set(input.code, doc);
    this.saveToDisk();
    return doc;
  }

  /**
   * Carga de una nueva versión documental con extracción segura de texto (MD, TXT, DOCX, PDF).
   */
  public submitVersion(
    principal: AiAgentPrincipal,
    input: {
      code: string;
      version: number;
      format: 'MD' | 'TXT' | 'DOCX' | 'PDF';
      rawBuffer?: Buffer;
      textContent?: string;
      allowedRoles: AiAgentRole[];
      validFrom?: string;
      validUntil?: string;
      declaredNoPersonalData: boolean;
    }
  ): StoredVersion {
    if (!['ODONTOLOGO', 'ADMIN'].includes(principal.role)) {
      throw new AiAgentError('FORBIDDEN', 'No autorizado para someter versiones documentales.');
    }
    if (!input.declaredNoPersonalData) {
      throw new AiAgentError('INVALID_INPUT', 'Debe declararse formalmente que el documento no contiene datos de pacientes.');
    }
    const doc = this.documents.get(input.code);
    if (!doc || !doc.active) throw new AiAgentError('NOT_FOUND', `Documento ${input.code} no registrado o inactivo.`);

    const existing = doc.versions.find(v => v.version === input.version);
    if (existing) throw new AiAgentError('CONFLICT', `La versión ${input.version} de ${input.code} ya existe.`);

    const maxVer = doc.versions.reduce((max, v) => Math.max(max, v.version), 0);
    if (input.version <= maxVer) throw new AiAgentError('CONFLICT', `La versión debe ser mayor que las existentes (última: ${maxVer}).`);

    // Extracción de texto según formato
    let text = '';
    if (input.format === 'DOCX') {
      if (!input.rawBuffer) throw new AiAgentError('INVALID_INPUT', 'Se requiere el archivo binario para formato DOCX.');
      text = extractTextFromDocx(input.rawBuffer);
    } else if (input.format === 'PDF') {
      if (!input.rawBuffer) throw new AiAgentError('INVALID_INPUT', 'Se requiere el archivo binario para formato PDF.');
      text = extractTextFromPdf(input.rawBuffer);
    } else {
      text = input.textContent || (input.rawBuffer ? input.rawBuffer.toString('utf8') : '');
    }

    if (!text.trim() || text.length < 10) throw new AiAgentError('INVALID_INPUT', 'Contenido del documento vacío o insuficiente.');

    if (this.hasPotentialPersonalData(text)) {
      throw new AiAgentError('INVALID_INPUT', 'El documento contiene patrones de datos personales (DNI, correo o teléfono). Debe ser anonimizado antes de su ingesta.');
    }

    const contentHash = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    const duplicate = doc.versions.find(v => v.contentHash === contentHash);
    if (duplicate) throw new AiAgentError('CONFLICT', `El contenido es idéntico al de la versión ${duplicate.version}.`);

    const newVersion: StoredVersion = {
      version: input.version,
      status: 'DRAFT',
      content: text,
      format: input.format,
      contentHash,
      allowedRoles: [...new Set(input.allowedRoles)],
      validFrom: input.validFrom || new Date().toISOString(),
      validUntil: input.validUntil,
      createdById: principal.idUsuario || 1
    };

    doc.versions.push(newVersion);
    this.saveToDisk();
    return newVersion;
  }

  /**
   * Aprobación humana explícita por profesional u odontólogo autorizado.
   */
  public approveVersion(principal: AiAgentPrincipal, code: string, versionNumber: number): StoredVersion {
    if (!['ODONTOLOGO', 'ADMIN'].includes(principal.role) || !principal.idUsuario) {
      throw new AiAgentError('FORBIDDEN', 'La aprobación documental requiere un profesional o administrador institucional autenticado.');
    }
    const doc = this.documents.get(code);
    if (!doc) throw new AiAgentError('NOT_FOUND', 'Documento no encontrado.');
    const ver = doc.versions.find(v => v.version === versionNumber);
    if (!ver) throw new AiAgentError('NOT_FOUND', 'Versión no encontrada.');
    if (ver.status !== 'DRAFT' && ver.status !== 'IN_REVIEW') {
      throw new AiAgentError('CONFLICT', `La versión está en estado ${ver.status} y no admite aprobación.`);
    }

    ver.status = 'APPROVED';
    ver.approvedById = principal.idUsuario;
    ver.approvedAt = new Date().toISOString();
    this.saveToDisk();
    return ver;
  }

  /**
   * Publicación oficial de la versión aprobada y actualización del índice de búsqueda.
   */
  public publishVersion(principal: AiAgentPrincipal, code: string, versionNumber: number): StoredVersion {
    if (principal.role !== 'ADMIN') {
      throw new AiAgentError('FORBIDDEN', 'Solo administración puede publicar oficialmente un documento institucional.');
    }
    const doc = this.documents.get(code);
    if (!doc) throw new AiAgentError('NOT_FOUND', 'Documento no encontrado.');
    const ver = doc.versions.find(v => v.version === versionNumber);
    if (!ver) throw new AiAgentError('NOT_FOUND', 'Versión no encontrada.');
    if (ver.status !== 'APPROVED') {
      throw new AiAgentError('CONFLICT', 'Solo versiones aprobadas previamente pueden publicarse.');
    }

    // Marcar versiones previamente publicadas como SUSTITUIDAS
    for (const otherVer of doc.versions) {
      if (otherVer.version !== versionNumber && otherVer.status === 'PUBLISHED') {
        otherVer.status = 'SUPERSEDED';
      }
    }

    ver.status = 'PUBLISHED';
    ver.publishedAt = new Date().toISOString();
    this.saveToDisk();
    this.rebuildIndex();
    return ver;
  }

  /**
   * Revocación inmediata de una versión. Deja de ser recuperable al instante.
   */
  public revokeVersion(principal: AiAgentPrincipal, code: string, versionNumber: number, reason: string): StoredVersion {
    if (principal.role !== 'ADMIN') {
      throw new AiAgentError('FORBIDDEN', 'Solo administración puede revocar documentos institucionales.');
    }
    if (!reason?.trim() || reason.length < 5) throw new AiAgentError('INVALID_INPUT', 'Debe consignarse un motivo de revocación válido.');
    const doc = this.documents.get(code);
    if (!doc) throw new AiAgentError('NOT_FOUND', 'Documento no encontrado.');
    const ver = doc.versions.find(v => v.version === versionNumber);
    if (!ver) throw new AiAgentError('NOT_FOUND', 'Versión no encontrada.');

    ver.status = 'REVOKED';
    ver.revokedAt = new Date().toISOString();
    ver.revocationReason = reason.trim();
    this.saveToDisk();
    this.rebuildIndex();
    return ver;
  }

  /**
   * Búsqueda en el corpus RAG con ACL por rol y vigencia.
   * Si hay paciente, audita en InteraccionesIA.
   */
  public async search(
    principal: AiAgentPrincipal,
    query: string,
    options: { limit?: number; correlationId?: string; category?: KnowledgeDocumentSubmission['category'] } = {}
  ): Promise<KnowledgeSearchResult> {
    const correlationId = options.correlationId || crypto.randomUUID();
    metricsCollector.recordRagSearch();
    const result = this.kb.search(query, principal, { ...options, correlationId });

    // Auditoría en InteraccionesIA si corresponde a un paciente autenticado
    if (principal.idPersona) {
      try {
        await prisma.interaccionesIA.create({
          data: {
            id_persona: principal.idPersona,
            actor_orientado: principal.role === 'ODONTOLOGO' ? 'ODONTOLOGO' : 'PACIENTE',
            tipo_evento: 'CONSULTA_RAG_CONOCIMIENTO',
            resumen_consulta: query.slice(0, 300),
            resultado: result.sufficientEvidence
              ? `Recuperados ${result.results.length} fragmentos de conocimiento institucional.`
              : 'Abstención: no hay evidencia institucional aprobada y autorizada.',
            id_correlacion: correlationId,
            version_agente: 'RAG-DURABLE-v1',
            es_diagnostico_o_prescripcion: false
          }
        });
      } catch (err) {
        console.warn('[DurableKnowledgeService] No fue posible persistir auditoría en InteraccionesIA:', err);
      }
    }

    return result;
  }

  /**
   * Verificación de una cita documental contra el índice oficial vigente.
   */
  private hasPotentialPersonalData(text: string): boolean {
    return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text) ||
      /\b\d{8}\b/.test(text) ||
      /\b9\d{8}\b/.test(text);
  }

  public getReference(principal: AiAgentPrincipal, reference: KnowledgeReference): KnowledgeReference | undefined {
    return this.kb.getReference(reference, principal);
  }

  public getDocument(code: string): StoredDocument | undefined {
    return this.documents.get(code);
  }

  public listDocuments(principal: AiAgentPrincipal): Array<{ code: string; title: string; category: string; latestVersion: number; status: string }> {
    return Array.from(this.documents.values()).map(doc => {
      const latest = doc.versions.sort((a, b) => b.version - a.version)[0];
      return {
        code: doc.code,
        title: doc.title,
        category: doc.category,
        latestVersion: latest?.version ?? 0,
        status: latest?.status ?? 'NO_VERSIONS'
      };
    });
  }
}

export const durableKnowledgeService = new DurableKnowledgeService();
