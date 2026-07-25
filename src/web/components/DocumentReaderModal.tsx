// File: src/web/components/DocumentReaderModal.tsx
import React from 'react';
import { FileText, X, ExternalLink, Clock, ShieldCheck, FileEdit, CheckCircle2, AlertCircle } from 'lucide-react';
import { marked } from 'marked';
import { Document } from '../types.js';

interface DocumentReaderModalProps {
  document: Document;
  onClose: () => void;
  onOpenInVault?: (docId: string) => void;
}

export const DocumentReaderModal: React.FC<DocumentReaderModalProps> = ({
  document: doc,
  onClose,
  onOpenInVault,
}) => {
  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="cap-badge cap-badge-success">
            <CheckCircle2 className="w-3 h-3 mr-1 cap-text-success" />
            Approved
          </span>
        );
      case 'in_review':
        return (
          <span className="cap-badge cap-badge-warning">
            <AlertCircle className="w-3 h-3 mr-1 cap-text-warning" />
            In Review
          </span>
        );
      default:
        return (
          <span className="cap-badge cap-badge-neutral">
            <FileEdit className="w-3 h-3 mr-1 cap-text-muted" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="cap-scrim">
      <div className="cap-dialog w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-cap-border flex items-start justify-between bg-cap-surface">
          <div className="flex items-start space-x-3 min-w-0 pr-4">
            <div className="p-2 bg-warning-500/10 border border-warning-500/30 rounded-lg cap-text-warning flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h3 className="text-base font-bold cap-text-primary truncate">{doc.title}</h3>
                {getStatusBadge(doc.status)}
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 cap-text-secondary border border-neutral-700">
                  v{doc.version}
                </span>
              </div>
              <div className="flex items-center space-x-3 mt-1 text-xs cap-text-muted">
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-neutral-500" />
                  Updated: {new Date(doc.updated_at).toLocaleString()}
                </span>
                <span>•</span>
                <span className="font-mono text-neutral-500 text-[11px]">ID: #{doc.id.substring(doc.id.length - 8)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="cap-btn cap-btn-icon cap-btn-ghost flex-shrink-0"
            title="Close document viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Viewer Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-cap-surface font-sans text-sm cap-text-secondary leading-relaxed space-y-4">
          {doc.content ? (
            <div
              className="markdown-render max-w-none text-xs leading-relaxed bg-cap-surface p-4 rounded-lg border border-cap-border overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: marked.parse(doc.content) as string }}
            />
          ) : (
            <p className="text-neutral-500 italic text-xs">This document is empty.</p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-cap-border bg-cap-surface flex items-center justify-between">
          <div>
            {onOpenInVault && (
              <button
                onClick={() => {
                  onClose();
                  onOpenInVault(doc.id);
                }}
                className="cap-btn cap-btn-soft"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open in Document Vault
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="cap-btn cap-btn-lg cap-btn-secondary"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
