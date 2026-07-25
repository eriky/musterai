// File: src/web/components/DocumentReaderModal.tsx
import React from 'react';
import { FileText, X, ExternalLink, Clock, ShieldCheck, FileEdit, CheckCircle2, AlertCircle } from 'lucide-react';
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
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
            Approved
          </span>
        );
      case 'in_review':
        return (
          <span className="cap-badge cap-badge-warning">
            <AlertCircle className="w-3 h-3 mr-1 text-amber-400" />
            In Review
          </span>
        );
      default:
        return (
          <span className="cap-badge cap-badge-neutral">
            <FileEdit className="w-3 h-3 mr-1 text-zinc-400" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="cap-scrim">
      <div className="cap-dialog w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-command-border flex items-start justify-between bg-command-card">
          <div className="flex items-start space-x-3 min-w-0 pr-4">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h3 className="text-base font-bold text-zinc-100 truncate">{doc.title}</h3>
                {getStatusBadge(doc.status)}
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  v{doc.version}
                </span>
              </div>
              <div className="flex items-center space-x-3 mt-1 text-xs text-zinc-400">
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-zinc-500" />
                  Updated: {new Date(doc.updated_at).toLocaleString()}
                </span>
                <span>•</span>
                <span className="font-mono text-zinc-500 text-[11px]">ID: #{doc.id.substring(doc.id.length - 8)}</span>
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
        <div className="p-6 overflow-y-auto flex-1 bg-command-surface font-sans text-sm text-zinc-300 leading-relaxed space-y-4">
          {doc.content ? (
            <div className="whitespace-pre-wrap font-mono text-xs text-zinc-200 bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 leading-relaxed overflow-x-auto selection:bg-amber-500/30 selection:text-amber-200">
              {doc.content}
            </div>
          ) : (
            <p className="text-zinc-500 italic text-xs">This document is empty.</p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-command-border bg-command-card flex items-center justify-between">
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
