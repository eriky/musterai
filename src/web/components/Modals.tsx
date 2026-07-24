// File: src/web/components/Modals.tsx
import React, { useState } from 'react';
import { Column } from '../types.js';
import { X, Bot, Plus, FileText, FolderPlus, Layers, AlertCircle } from 'lucide-react';
import { api } from '../api.js';

interface NewProjectModalProps {
  onClose: () => void;
  onSuccess: (newProjectId: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const proj = await api.createProject({ name, description });
      onSuccess(proj.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to create project:', err);
      setError(err.message || 'Failed to create project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-command-surface border border-emerald-500/40 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-command-border pb-3">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center">
            <FolderPlus className="w-4 h-4 mr-2 text-emerald-400" /> Create New Project
          </h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Project Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Collaborative Platform v2"
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2.5 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project goals, scope, and target deliverables..."
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-zinc-950 font-bold rounded cursor-pointer transition-all"
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface NewBoardModalProps {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewBoardModal: React.FC<NewBoardModalProps> = ({ projectId, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.createBoard(projectId, name);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create board:', err);
      setError(err.message || 'Failed to create board.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-command-surface border border-cyan-500/40 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-command-border pb-3">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center">
            <Layers className="w-4 h-4 mr-2 text-cyan-400" /> Create New Board
          </h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Board Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint 2, Feature Roadmap"
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2.5 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 text-zinc-950 font-bold rounded cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface NewColumnModalProps {
  boardId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewColumnModal: React.FC<NewColumnModalProps> = ({ boardId, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [wipLimit, setWipLimit] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const limit = wipLimit ? parseInt(wipLimit, 10) : undefined;
      await api.createColumn(boardId, name, limit);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create column:', err);
      setError(err.message || 'Failed to create column.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-command-surface border border-cyan-500/40 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-command-border pb-3">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center">
            <Plus className="w-4 h-4 mr-2 text-cyan-400" /> Add Column
          </h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Column Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. In Testing, Blocked, Done"
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2.5 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">WIP Limit (Optional)</label>
            <input
              type="number"
              min="1"
              value={wipLimit}
              onChange={(e) => setWipLimit(e.target.value)}
              placeholder="e.g. 3 (leave empty for unlimited)"
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 text-zinc-950 font-bold rounded cursor-pointer"
            >
              {isSubmitting ? 'Adding...' : 'Add Column'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface NewAgentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const NewAgentModal: React.FC<NewAgentModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'ai_agent' | 'human'>('ai_agent');
  const [role, setRole] = useState<'owner' | 'contributor' | 'observer'>('contributor');
  const [capabilities, setCapabilities] = useState('code, review, test');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.registerAgent({ name, type, role, capabilities });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to register agent:', err);
      setError(err.message || 'Failed to register agent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-command-surface border border-emerald-500/40 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-command-border pb-3">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center">
            <Bot className="w-4 h-4 mr-2 text-emerald-400" /> Register Agent / Operator
          </h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Claude-Backend, Gemini-Frontend"
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2.5 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 mb-1 font-semibold">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2"
              >
                <option value="ai_agent">AI Agent</option>
                <option value="human">Human Operator</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 font-semibold">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2"
              >
                <option value="contributor">Contributor</option>
                <option value="owner">Owner</option>
                <option value="observer">Observer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Capabilities (comma-separated)</label>
            <input
              type="text"
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
              placeholder="e.g. backend, ts, react, testing"
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-zinc-950 font-bold rounded cursor-pointer"
            >
              {isSubmitting ? 'Registering...' : 'Register Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface NewCardModalProps {
  columns: Column[];
  defaultColumnId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewCardModal: React.FC<NewCardModalProps> = ({ columns, defaultColumnId, onClose, onSuccess }) => {
  const [columnId, setColumnId] = useState(defaultColumnId || (columns.length > 0 ? columns[0].id : ''));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !columnId || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.createCard(columnId, { title, description, priority });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create card:', err);
      setError(err.message || 'Failed to create card.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-command-surface border border-cyan-500/40 rounded-xl w-full max-w-lg p-5 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-command-border pb-3">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center">
            <Plus className="w-4 h-4 mr-2 text-cyan-400" /> Create Card
          </h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Column</label>
            <select
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2"
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement OAuth 2.0 Auth Handler"
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2.5 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Description (Markdown)</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed instructions for assigned agents..."
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 text-zinc-950 font-bold rounded cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface NewDocModalProps {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewDocModal: React.FC<NewDocModalProps> = ({ projectId, onClose, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('# Document Title\n\n## Overview\nDetails...');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.createDocument(projectId, { title, content });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create document:', err);
      setError(err.message || 'Failed to create document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-command-surface border border-amber-500/40 rounded-xl w-full max-w-lg p-5 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-command-border pb-3">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center">
            <FileText className="w-4 h-4 mr-2 text-amber-400" /> Create Design Document
          </h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-lg text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Document Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Architecture Overview & Schemas"
              className="w-full bg-command-card border border-command-border text-zinc-100 rounded p-2.5 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-400 mb-1 font-semibold">Markdown Content</label>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-command-card border border-command-border text-zinc-100 font-mono text-xs rounded p-2 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-zinc-950 font-bold rounded cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
