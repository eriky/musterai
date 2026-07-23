import React, { useState, useEffect } from 'react';
import { Document, DocumentVersion, AgentRegistration } from '../types';
import { FileText, Plus, History, Eye, Edit3, CheckCircle, Clock, Save, FileCode } from 'lucide-react';
import { fetchDocumentHistory, updateDocument } from '../api';
import { marked } from 'marked';

interface DocumentHubProps {
  documents: Document[];
  agents: AgentRegistration[];
  onOpenCreateDoc: () => void;
  onRefresh: () => void;
}

export const DocumentHub: React.FC<DocumentHubProps> = ({
  documents,
  agents,
  onOpenCreateDoc,
  onRefresh,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(documents[0] || null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [history, setHistory] = useState<DocumentVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (documents.length > 0 && !selectedDoc) {
      setSelectedDoc(documents[0]);
    }
  }, [documents]);

  useEffect(() => {
    if (selectedDoc) {
      setTitle(selectedDoc.title);
      setContent(selectedDoc.content);
    }
  }, [selectedDoc]);

  const handleSelectDoc = async (doc: Document) => {
    setSelectedDoc(doc);
    setIsEditing(false);
    setShowHistory(false);
  };

  const handleLoadHistory = async () => {
    if (!selectedDoc) return;
    const h = await fetchDocumentHistory(selectedDoc.id);
    setHistory(h);
    setShowHistory(!showHistory);
  };

  const handleSaveDocument = async () => {
    if (!selectedDoc) return;
    setIsSaving(true);
    const authorId = agents.length > 0 ? agents[0].id : 'system';
    await updateDocument(selectedDoc.id, {
      title,
      content,
      author_id: authorId,
      change_summary: changeSummary.trim() || 'Updated content',
    });
    setIsSaving(false);
    setIsEditing(false);
    setChangeSummary('');
    onRefresh();
  };

  const renderMarkdown = (text: string) => {
    try {
      return { __html: marked.parse(text) };
    } catch (_) {
      return { __html: text };
    }
  };

  return (
    <div style={{ padding: '24px', height: 'calc(100vh - 70px)', display: 'flex', gap: '20px' }} className="animate-fade-in">
      {/* Sidebar - Document List & Tree */}
      <div className="glass-panel" style={{ width: '320px', minWidth: '280px', display: 'flex', flexDirection: 'column', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#8b5cf6" /> System Specs
          </h3>
          <button onClick={onOpenCreateDoc} className="btn btn-primary btn-sm" style={{ padding: '4px 10px' }}>
            <Plus size={14} /> New
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '0.84rem' }}>
              No documents created yet.
            </div>
          ) : (
            documents.map((doc) => {
              const isSelected = selectedDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => handleSelectDoc(doc)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(139, 92, 246, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isSelected ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255, 255, 255, 0.05)'}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: isSelected ? '#a78bfa' : '#f8fafc', marginBottom: '4px' }}>
                    {doc.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8' }}>
                    <span className={`badge badge-${doc.status}`}>{doc.status}</span>
                    <span>v{doc.version}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Document Workspace Pane */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflow: 'hidden' }}>
        {!selectedDoc ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '1.05rem' }}>
            Select or create a document to start editing.
          </div>
        ) : (
          <>
            {/* Document Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className={`badge badge-${selectedDoc.status}`}>{selectedDoc.status}</span>
                  <span style={{ fontSize: '0.76rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>Version {selectedDoc.version}</span>
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                  {selectedDoc.title}
                </h2>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleLoadHistory} className="btn btn-secondary btn-sm">
                  <History size={14} /> History ({selectedDoc.version})
                </button>
                <button onClick={() => setIsEditing(!isEditing)} className="btn btn-secondary btn-sm">
                  {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
                  {isEditing ? 'Preview Markdown' : 'Edit Markdown'}
                </button>
              </div>
            </div>

            {/* Document Editor vs Rendered View */}
            {isEditing ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Document Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Markdown Source</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="input-field"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.88rem', resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Change summary / commit message..."
                    value={changeSummary}
                    onChange={(e) => setChangeSummary(e.target.value)}
                    className="input-field"
                    style={{ flex: 1, fontSize: '0.84rem' }}
                  />
                  <button onClick={handleSaveDocument} disabled={isSaving} className="btn btn-primary btn-sm">
                    <Save size={14} /> {isSaving ? 'Saving...' : 'Save & Bump Version'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', gap: '20px' }}>
                {/* Rendered Markdown Area */}
                <div style={{ flex: 1, lineHeight: 1.6, fontSize: '0.94rem', color: '#e2e8f0' }} dangerouslySetInnerHTML={renderMarkdown(selectedDoc.content)} />

                {/* Optional History Sidebar Drawer */}
                {showHistory && (
                  <div style={{ width: '280px', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#a78bfa' }}>Version Timeline</h4>
                    {history.map((ver) => (
                      <div key={ver.id} style={{
                        padding: '10px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        fontSize: '0.78rem',
                      }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>Version {ver.version}</div>
                        <div style={{ color: '#94a3b8', margin: '2px 0' }}>{ver.change_summary || 'No summary'}</div>
                        <div style={{ color: '#64748b', fontSize: '0.72rem' }}>{new Date(ver.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
