import React, { useState } from 'react';
import { Project } from '../../types.js';
import { X, FolderPlus, Edit2, AlertCircle, Trash2 } from 'lucide-react';
import { api } from '../../api.js';
import { useEscapeKey } from './useEscapeKey.js';

interface NewProjectModalProps {
  onClose: () => void;
  onSuccess: (newProjectId: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose, onSuccess }) => {
  useEscapeKey(onClose);
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
      <div className="muster-dialog w-full max-w-md max-h-[90vh] overflow-y-auto mx-2 p-4 sm:p-5 space-y-4 font-sans">
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
  onDeleteProject?: (projectId: string) => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, onClose, onSuccess, onDeleteProject }) => {
  useEscapeKey(onClose);
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
    <div className="muster-scrim" onClick={onClose}>
      <div className="muster-dialog w-full max-w-md max-h-[90vh] overflow-y-auto mx-2 p-4 sm:p-5 space-y-4 font-sans" onClick={(e) => e.stopPropagation()}>
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

        {onDeleteProject && (
          <div className="border-t border-muster-border pt-3 mt-4">
            <button
              type="button"
              onClick={() => {
                if (confirm(`Are you sure you want to delete project "${project.name}"?\n\nThis will permanently delete all boards, cards, documents, and knowledge base links in this project.`)) {
                  onDeleteProject(project.id);
                  onClose();
                }
              }}
              className="muster-btn muster-btn-danger-soft text-xs w-full justify-center"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
