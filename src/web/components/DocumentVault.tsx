// File: src/web/components/DocumentVault.tsx
import React, { useState } from 'react';
import { Document } from '../types.js';
import { FileText, Edit3, History, CheckCircle, Clock, Save, Plus } from 'lucide-react';
import { marked } from 'marked';
import { api } from '../api.js';

interface DocumentVaultProps {
  documents: Document[];
  onOpenNewDoc: () => void;
  onRefresh: () => void;
}

export const DocumentVault: React.FC<DocumentVaultProps> = ({ documents, onOpenNewDoc, onRefresh }) => {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const selectedDoc = documents.find(d => d.id === selectedDocId) || (documents.length > 0 ? documents[documents.length - 1] : null);

  const handleSelectDoc = (doc: Document) => {
    setSelectedDocId(doc.id);
    setIsEditing(false);
    setShowHistory(false);
  };

  const handleStartEdit = () => {
    if (!selectedDoc) return;
    setEditTitle(selectedDoc.title);
    setEditContent(selectedDoc.content);
    setChangeSummary('');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDoc) return;
    try {
      await api.updateDocument(selectedDoc.id, {
        title: editTitle,
        content: editContent,
        change_summary: changeSummary || 'Updated content',
      });
      setIsEditing(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to update document:', err);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedDoc) return;
    try {
      await api.setDocumentStatus(selectedDoc.id, status);
      onRefresh();
    } catch (err) {
      console.error('Failed to update document status:', err);
    }
  };

  const handleLoadHistory = async () => {
    if (!selectedDoc) return;
    try {
      const versions = await api.getDocumentHistory(selectedDoc.id);
      setHistory(versions);
      setShowHistory(!showHistory);
    } catch (err) {
      console.error('Failed to load version history:', err);
    }
  };

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-sans font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
            <CheckCircle className="w-3 h-3 mr-1" /> Approved
          </span>
        );
      case 'in_review':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-sans font-medium bg-amber-950/80 text-amber-400 border border-amber-500/40">
            <Clock className="w-3 h-3 mr-1 animate-pulse" /> In Review
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-sans font-medium bg-zinc-900 text-zinc-400 border border-zinc-700">
            Draft (v{selectedDoc?.version || 1})
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 font-sans">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-command-border pb-3">
        <div className="flex items-center space-x-3">
          <FileText className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-zinc-100 uppercase tracking-wide">
            Design Documents
          </h2>
        </div>
        <button
          onClick={onOpenNewDoc}
          className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-zinc-950 transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Create Document
        </button>
      </div>

      {/* Main View */}
      {documents.length === 0 ? (
        <div className="text-center py-16 bg-command-surface rounded-xl tactical-border">
          <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm text-zinc-300 font-semibold">No Design Documents</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            Author and version control system specifications and design docs.
          </p>
          <button
            onClick={onOpenNewDoc}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 text-xs font-bold rounded-md cursor-pointer"
          >
            Create Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[650px]">
          
          {/* Document Tree Sidebar */}
          <div className="md:col-span-1 bg-command-surface rounded-xl p-4 tactical-border space-y-2 max-h-[700px] overflow-y-auto">
            <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3 tracking-wider">
              Documents ({documents.length})
            </h3>

            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleSelectDoc(doc)}
                className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedDoc?.id === doc.id
                    ? 'bg-amber-950/30 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-command-card border-command-border text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold truncate">
                  <span className="truncate">{doc.title}</span>
                  <span className="text-[10px] font-mono text-zinc-500 ml-1">v{doc.version}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-500">
                  <span className="capitalize">{doc.status.replace('_', ' ')}</span>
                  <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Document Reader / Editor */}
          <div className="md:col-span-3 bg-command-surface rounded-xl p-6 tactical-border flex flex-col justify-between">
            {selectedDoc ? (
              <div className="space-y-5">
                
                {/* Spec Toolbar & Status */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-command-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-100">{selectedDoc.title}</h2>
                    <div className="flex items-center space-x-3 mt-1 text-xs text-zinc-500">
                      <span>ID: #{selectedDoc.id.substring(selectedDoc.id.length - 8)}</span>
                      <span>•</span>
                      <span>Version {selectedDoc.version}</span>
                      <span>•</span>
                      <span>Updated: {new Date(selectedDoc.updated_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {getStatusBadge(selectedDoc.status)}

                    {selectedDoc.status === 'draft' && (
                      <button
                        onClick={() => handleStatusChange('in_review')}
                        className="px-2.5 py-1 bg-amber-600/20 text-amber-300 border border-amber-500/40 text-xs rounded hover:bg-amber-600/30 transition-colors cursor-pointer"
                      >
                        Submit for Review
                      </button>
                    )}
                    {selectedDoc.status === 'in_review' && (
                      <button
                        onClick={() => handleStatusChange('approved')}
                        className="px-2.5 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 text-xs rounded hover:bg-emerald-600/30 transition-colors cursor-pointer"
                      >
                        Approve
                      </button>
                    )}

                    <button
                      onClick={() => (isEditing ? handleSaveEdit() : handleStartEdit())}
                      className="inline-flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 text-xs rounded transition-colors cursor-pointer"
                    >
                      {isEditing ? (
                        <>
                          <Save className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Save Version
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Edit Document
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleLoadHistory}
                      className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 border border-zinc-700 rounded transition-colors cursor-pointer"
                      title="Version History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Edit or Render View */}
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">Title</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-command-card border border-command-border text-zinc-100 text-sm rounded p-2.5 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">Change Summary</label>
                      <input
                        type="text"
                        value={changeSummary}
                        onChange={(e) => setChangeSummary(e.target.value)}
                        placeholder="Summary of changes..."
                        className="w-full bg-command-card border border-command-border text-zinc-100 text-xs rounded p-2 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 mb-1">Markdown Body</label>
                      <textarea
                        rows={16}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-command-card border border-command-border text-zinc-100 font-mono text-xs p-3 rounded leading-relaxed focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className="markdown-render max-w-none text-xs leading-relaxed bg-command-card p-6 rounded-lg border border-command-border overflow-y-auto max-h-[550px]"
                    dangerouslySetInnerHTML={{ __html: marked.parse(selectedDoc.content || '') as string }}
                  />
                )}

                {/* History Drawer */}
                {showHistory && (
                  <div className="p-4 bg-command-card rounded-lg border border-amber-500/30 space-y-3">
                    <h4 className="text-xs font-bold text-amber-300 uppercase flex items-center">
                      <History className="w-3.5 h-3.5 mr-1.5" /> Version History
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {history.map((ver) => (
                        <div key={ver.id} className="p-2.5 bg-zinc-900 rounded border border-zinc-800 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-amber-400">v{ver.version}</span> - {ver.change_summary || 'Updated'}
                          </div>
                          <span className="text-[10px] text-zinc-500">{new Date(ver.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : null}
          </div>

        </div>
      )}

    </div>
  );
};
