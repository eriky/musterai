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
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-600/50">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
            Approved
          </span>
        );
      case 'in_review':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-600/50">
            <AlertCircle className="w-3 h-3 mr-1 text-amber-400" />
            In Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-900 text-zinc-400 border border-zinc-700">
            <FileEdit className="w-3 h-3 mr-1 text-zinc-400" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-command-surface border border-command-border rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden tactical-border">
        
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
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer flex-shrink-0"
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
                className="inline-flex items-center px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open in Document Vault
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-zinc-700"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
