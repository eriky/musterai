import React, { useState } from 'react';
import { X, Plus, Cpu, FileText, Kanban, FolderPlus } from 'lucide-react';
import { createProject, createBoard, createCard, createDocument, registerAgent } from '../api';

/* Create Project Modal */
export const CreateProjectModal: React.FC<{ onClose: () => void; onRefresh: () => void }> = ({ onClose, onRefresh }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    await createProject({ name: name.trim(), description: description.trim() || undefined });
    setIsSubmitting(false);
    onRefresh();
    onClose();
  };

  return (
    <ModalWrapper title="Create New Project" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Project Name</label>
          <input
            type="text"
            required
            placeholder="e.g. Autonomous Agent Core"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Description</label>
          <textarea
            rows={3}
            placeholder="Project mission, scope, or agent rules..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field"
            style={{ resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm">
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

/* Create Board Modal */
export const CreateBoardModal: React.FC<{ projectId: string; onClose: () => void; onRefresh: () => void }> = ({ projectId, onClose, onRefresh }) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !projectId) return;
    setIsSubmitting(true);
    await createBoard({ project_id: projectId, name: name.trim() });
    setIsSubmitting(false);
    onRefresh();
    onClose();
  };

  return (
    <ModalWrapper title="Create New Board" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Board Name</label>
          <input
            type="text"
            required
            placeholder="e.g. Sprint Board, Architecture Backlog"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm">
            {isSubmitting ? 'Creating...' : 'Create Board'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

/* Create Card Modal */
export const CreateCardModal: React.FC<{ columnId: string; onClose: () => void; onRefresh: () => void }> = ({ columnId, onClose, onRefresh }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !columnId) return;
    setIsSubmitting(true);
    await createCard({
      column_id: columnId,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
    });
    setIsSubmitting(false);
    onRefresh();
    onClose();
  };

  return (
    <ModalWrapper title="Add Task Card" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Task Title</label>
          <input
            type="text"
            required
            placeholder="e.g. Implement OAuth2 Refresh Strategy"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input-field">
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Description</label>
          <textarea
            rows={4}
            placeholder="Task execution context or guidelines..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm">
            {isSubmitting ? 'Adding...' : 'Add Task Card'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

/* Create Document Modal */
export const CreateDocumentModal: React.FC<{ projectId: string; onClose: () => void; onRefresh: () => void }> = ({ projectId, onClose, onRefresh }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    setIsSubmitting(true);
    await createDocument({
      project_id: projectId,
      title: title.trim(),
      content: content.trim() || '# System Specification\n\nOutline details here...',
      author_id: 'system',
    });
    setIsSubmitting(false);
    onRefresh();
    onClose();
  };

  return (
    <ModalWrapper title="Create Architecture Document" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Document Title</label>
          <input
            type="text"
            required
            placeholder="e.g. Agent Memory Protocol Specification"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Markdown Content</label>
          <textarea
            rows={6}
            placeholder="# Document Title..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input-field"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm">
            {isSubmitting ? 'Creating...' : 'Create Document'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

/* Register Agent Modal */
export const RegisterAgentModal: React.FC<{ projectId: string; onClose: () => void; onRefresh: () => void }> = ({ projectId, onClose, onRefresh }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'ai_agent' | 'human'>('ai_agent');
  const [role, setRole] = useState<'owner' | 'contributor' | 'observer'>('contributor');
  const [capabilities, setCapabilities] = useState('code-review,refactoring,testing');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !projectId) return;
    setIsSubmitting(true);
    await registerAgent({
      project_id: projectId,
      name: name.trim(),
      type,
      role,
      capabilities,
    });
    setIsSubmitting(false);
    onRefresh();
    onClose();
  };

  return (
    <ModalWrapper title="Register New Agent" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Agent Name</label>
          <input
            type="text"
            required
            placeholder="e.g. Audit Agent, Senior Developer"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="input-field">
              <option value="ai_agent">AI Agent</option>
              <option value="human">Human Contributor</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as any)} className="input-field">
              <option value="owner">Owner</option>
              <option value="contributor">Contributor</option>
              <option value="observer">Observer</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Capabilities (Comma-separated)</label>
          <input
            type="text"
            placeholder="e.g. code-review,refactoring,testing,security"
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
            className="input-field"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm">
            {isSubmitting ? 'Registering...' : 'Register Agent'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

/* Base Modal Shell Component */
const ModalWrapper: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div style={{
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  }} className="animate-fade-in">
    <div className="glass-panel" style={{
      width: '100%',
      maxWidth: '520px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.2)',
      }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>{title}</h3>
        <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '4px' }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  </div>
);
