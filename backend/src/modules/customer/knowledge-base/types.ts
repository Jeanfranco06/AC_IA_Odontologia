import { AiAgentRole } from '../ai-agent/types';

export type KnowledgeCategory = 'KB-01' | 'KB-02' | 'KB-03' | 'KB-04' | 'KB-05';
export type KnowledgeStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'SUPERSEDED' | 'REVOKED';

export interface KnowledgeDocumentSubmission {
  fileName: string;
  code: string;
  title: string;
  category: KnowledgeCategory;
  version: number;
  content: string;
  status: KnowledgeStatus;
  allowedRoles: AiAgentRole[];
  declaredNoPersonalData: boolean;
  approvedBy?: string;
  approvedAt?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface KnowledgeReference {
  documentCode: string;
  title: string;
  version: number;
  section: string;
  chunkId: string;
}

export interface KnowledgeSearchResult {
  sufficientEvidence: boolean;
  results: Array<{
    reference: KnowledgeReference;
    excerpt: string;
    score: number;
  }>;
  limitation?: 'NO_AUTHORIZED_EVIDENCE';
}
