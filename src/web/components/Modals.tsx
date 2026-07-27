import React, { useState } from 'react';
import { Column, Project } from '../types.js';
import { X, Bot, Plus, FileText, FolderPlus, Layers, AlertCircle, UserPlus, Edit2 } from 'lucide-react';

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
    <div className="muster-scrim">
      <div className="muster-dialog w-full max-w-md p-5 space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-muster-border pb-3">
          <h3 className="text-sm font-bold muster-text-primary flex items-center">
            <FolderPlus className="w-4 h-4 mr-2 muster-accent" /> Create New Project
          </h3>
          <button onClick={onClose} className="muster-btn muster-btn-icon muster-btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="muster-badge muster-badge-danger normal-case tracking-normal text-xs p-3 w-full">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="muster-label">Project Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Collaborative Platform v2"
              className="muster-input muster-input-lg"
            />
          </div>

          <div>
            <label className="muster-label">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project goals, scope, and target deliverables..."
              className="muster-input"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="muster-btn muster-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="muster-btn muster-btn-primary"
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, onClose, onSuccess }) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.updateProject(project.id, { name: name.trim(), description: description.trim() || undefined });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to edit project:', err);
      setError(err.message || 'Failed to edit project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="muster-scrim">
      <div className="muster-dialog w-full max-w-md p-5 space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-muster-border pb-3">
          <h3 className="text-sm font-bold muster-text-primary flex items-center">
            <Edit2 className="w-4 h-4 mr-2 muster-accent" /> Edit Project Details
          </h3>
          <button onClick={onClose} className="muster-btn muster-btn-icon muster-btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="muster-badge muster-badge-danger normal-case tracking-normal text-xs p-3 w-full">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="muster-label">Project Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Collaborative Platform v2"
              className="muster-input muster-input-lg"
            />
          </div>

          <div>
            <label className="muster-label">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project goals, scope, and target deliverables..."
              className="muster-input"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="muster-btn muster-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="muster-btn muster-btn-primary"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
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
  const [template, setTemplate] = useState<'simple' | 'standard'>('simple');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.createBoard(projectId, name, template);
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
    <div className="muster-scrim">
      <div className="muster-dialog w-full max-w-md p-5 space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-muster-border pb-3">
          <h3 className="text-sm font-bold muster-text-primary flex items-center">
            <Layers className="w-4 h-4 mr-2 muster-accent" /> Create New Board
          </h3>
          <button onClick={onClose} className="muster-btn muster-btn-icon muster-btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="muster-badge muster-badge-danger normal-case tracking-normal text-xs p-3 w-full">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="muster-label">Board Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint 2, Feature Roadmap"
              className="muster-input muster-input-lg"
            />
          </div>

          <div>
            <label className="muster-label">Board Structure / Lanes</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as 'simple' | 'standard')}
              className="muster-input"
            >
              <option value="simple">⚡ 3 Lanes (To Do → In Progress → Done)</option>
              <option value="standard">📋 5 Lanes (Backlog → To Do → In Progress → In Review → Done)</option>
            </select>
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="muster-btn muster-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="muster-btn muster-btn-primary"
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
    <div className="muster-scrim">
      <div className="muster-dialog w-full max-w-md p-5 space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-muster-border pb-3">
          <h3 className="text-sm font-bold muster-text-primary flex items-center">
            <Plus className="w-4 h-4 mr-2 muster-accent" /> Add Column
          </h3>
          <button onClick={onClose} className="muster-btn muster-btn-icon muster-btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="muster-badge muster-badge-danger normal-case tracking-normal text-xs p-3 w-full">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="muster-label">Column Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. In Testing, Blocked, Done"
              className="muster-input muster-input-lg"
            />
          </div>

          <div>
            <label className="muster-label">WIP Limit (Optional)</label>
            <input
              type="number"
              min="1"
              value={wipLimit}
              onChange={(e) => setWipLimit(e.target.value)}
              placeholder="e.g. 3 (leave empty for unlimited)"
              className="muster-input"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="muster-btn muster-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="muster-btn muster-btn-primary"
            >
              {isSubmitting ? 'Adding...' : 'Add Column'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditColumnModalProps {
  column: Column;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditColumnModal: React.FC<EditColumnModalProps> = ({ column, onClose, onSuccess }) => {
  const [name, setName] = useState(column.name);
  const [wipLimit, setWipLimit] = useState<string>(column.wip_limit !== null && column.wip_limit !== undefined ? String(column.wip_limit) : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const limit = wipLimit.trim() !== '' ? parseInt(wipLimit, 10) : null;
      await api.updateColumn(column.id, { name: name.trim(), wip_limit: limit });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to update column:', err);
      setError(err.message || 'Failed to update column.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="muster-scrim">
      <div className="muster-dialog w-full max-w-md p-5 space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-muster-border pb-3">
          <h3 className="text-sm font-bold muster-text-primary flex items-center">
            <Edit2 className="w-4 h-4 mr-2 muster-accent" /> Edit Column Settings
          </h3>
          <button onClick={onClose} className="muster-btn muster-btn-icon muster-btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="muster-badge muster-badge-danger normal-case tracking-normal text-xs p-3 w-full">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="muster-label">Column Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. In Testing, Blocked, Done"
              className="muster-input muster-input-lg"
            />
          </div>

          <div>
            <label className="muster-label">WIP Limit (Optional)</label>
            <input
              type="number"
              min="1"
              value={wipLimit}
              onChange={(e) => setWipLimit(e.target.value)}
              placeholder="e.g. 3 (leave empty for unlimited)"
              className="muster-input"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="muster-btn muster-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="muster-btn muster-btn-primary"
            >
              {isSubmitting ? 'Saving...' : 'Save Column'}
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
  const [capabilities, setCapabilities] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.registerAgent({ name, capabilities });
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
    <div className="muster-scrim">
      <div className="muster-dialog w-full max-w-md p-5 space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-muster-border pb-3">
          <h3 className="text-sm font-bold muster-text-primary flex items-center">
            <UserPlus className="w-4 h-4 mr-2 muster-accent" /> Register Agent
          </h3>
          <button onClick={onClose} className="muster-btn muster-btn-icon muster-btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="muster-badge muster-badge-danger normal-case tracking-normal text-xs p-3 w-full">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-muster-base border border-muster-border rounded-md text-[11px] muster-text-muted">
          💡 <span className="font-semibold muster-text-primary">Note:</span> Manual registration is for human operators. AI agents (Claude, Cursor, Antigravity) register themselves programmatically over MCP.
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="muster-label">Agent Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. my-agent"
              className="muster-input muster-input-lg"
            />
          </div>

          <div>
            <label className="muster-label">Capabilities (comma-separated)</label>
            <input
              type="text"
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
              placeholder="e.g. code, testing, architecture"
              className="muster-input"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="muster-btn muster-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="muster-btn muster-btn-primary"
            >
              {isSubmitting ? 'Adding...' : 'Add User'}
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
  onSuccess: (newDoc?: any) => void;
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
      const doc = await api.createDocument(projectId, { title, content });
      onSuccess(doc);
      onClose();
    } catch (err: any) {
      console.error('Failed to create document:', err);
      setError(err.message || 'Failed to create document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="muster-scrim">
      <div className="muster-dialog w-full max-w-lg p-5 space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-muster-border pb-3">
          <h3 className="text-sm font-bold muster-text-primary flex items-center">
            <FileText className="w-4 h-4 mr-2 muster-accent" /> Create Design Document
          </h3>
          <button onClick={onClose} className="muster-btn muster-btn-icon muster-btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="muster-badge muster-badge-danger normal-case tracking-normal text-xs p-3 w-full">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="muster-label">Document Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Architecture Overview & Schemas"
              className="muster-input muster-input-lg"
            />
          </div>

          <div>
            <label className="muster-label">Markdown Content</label>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="muster-input font-mono"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="muster-btn muster-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="muster-btn muster-btn-primary"
            >
              {isSubmitting ? 'Creating...' : 'Create Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
