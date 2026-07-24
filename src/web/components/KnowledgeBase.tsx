// File: src/web/components/KnowledgeBase.tsx
import React, { useState, useEffect } from 'react';
import {
  KnowledgeBase as KBType,
  KBFact,
  KBEntity,
  KBRelation,
  EntityKnowledgeResult,
  KBGraphTree,
  KBGraphNode,
  Project
} from '../types.js';
import { api } from '../api.js';
import { KnowledgeGraphCanvas } from './KnowledgeGraphCanvas.js';

interface KnowledgeBaseProps {
  currentProject: Project | null;
  initialEntityId?: string | null;
  onSelectEntity?: (entityId: string | null) => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseProps> = ({
  currentProject,
  initialEntityId,
  onSelectEntity,
}) => {

  const [kbs, setKbs] = useState<KBType[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'facts' | 'graph'>('graph');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [facts, setFacts] = useState<KBFact[]>([]);
  const [graphTree, setGraphTree] = useState<KBGraphTree>({ nodes: [], links: [] });
  const [selectedEntity, setSelectedEntity] = useState<EntityKnowledgeResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [showCreateKbModal, setShowCreateKbModal] = useState<boolean>(false);
  const [showAddFactModal, setShowAddFactModal] = useState<boolean>(false);
  const [showAddRelationModal, setShowAddRelationModal] = useState<boolean>(false);

  const [editingFact, setEditingFact] = useState<KBFact | null>(null);
  const [showEditFactModal, setShowEditFactModal] = useState<boolean>(false);

  const [editingEntity, setEditingEntity] = useState<KBEntity | null>(null);
  const [showEditEntityModal, setShowEditEntityModal] = useState<boolean>(false);

  // Form States
  const [newKbName, setNewKbName] = useState('');
  const [newKbDesc, setNewKbDesc] = useState('');
  const [newKbIsGlobal, setNewKbIsGlobal] = useState(false);

  const [newFactTitle, setNewFactTitle] = useState('');
  const [newFactContent, setNewFactContent] = useState('');
  const [newFactCategory, setNewFactCategory] = useState('constraint');
  const [newFactEntityName, setNewFactEntityName] = useState('');
  const [newFactEntityIdent, setNewFactEntityIdent] = useState('');

  // Edit Fact Form State
  const [editFactTitle, setEditFactTitle] = useState('');
  const [editFactContent, setEditFactContent] = useState('');
  const [editFactCategory, setEditFactCategory] = useState('constraint');
  const [editFactEntityName, setEditFactEntityName] = useState('');
  const [editFactEntityIdent, setEditFactEntityIdent] = useState('');

  // Edit Entity Form State
  const [editEntityName, setEditEntityName] = useState('');
  const [editEntityType, setEditEntityType] = useState('server');
  const [editEntityIdent, setEditEntityIdent] = useState('');

  const [relTargetEntityId, setRelTargetEntityId] = useState('');
  const [relType, setRelType] = useState('runs_on');
  const [relDesc, setRelDesc] = useState('');

  // Load KBs
  const loadKBs = async () => {
    try {
      setLoading(true);
      const list = await api.getKBs(currentProject?.id);
      setKbs(list);
    } catch (err) {
      console.error('Failed to load KBs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Facts & Graph Tree
  const refreshData = async () => {
    try {
      setLoading(true);
      const kbIdFilter = selectedKbId === 'all' ? undefined : selectedKbId;
      const projIdFilter = selectedKbId === 'all' ? currentProject?.id : undefined;

      if (searchQuery.trim()) {
        const res = await api.searchKnowledge(searchQuery, kbIdFilter, projIdFilter);
        setFacts(res.facts);
      } else {
        if (kbIdFilter) {
          const list = await api.getKBFacts(kbIdFilter);
          setFacts(list);
        } else {
          const res = await api.searchKnowledge('', undefined, projIdFilter);
          setFacts(res.facts);
        }
      }

      const tree = await api.getGraphTree(kbIdFilter, projIdFilter);
      setGraphTree(prev => {
        if (JSON.stringify(prev) === JSON.stringify(tree)) {
          return prev;
        }
        return tree;
      });

      if (selectedEntity) {
        const updated = await api.getEntityKnowledge(selectedEntity.entity.id, selectedEntity.entity.kb_id);
        setSelectedEntity(updated);
      }
    } catch (err) {
      console.error('Failed to refresh KB data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKBs();
  }, [currentProject?.id]);

  useEffect(() => {
    refreshData();
  }, [selectedKbId, searchQuery, currentProject?.id]);

  useEffect(() => {
    if (initialEntityId) {
      api.getEntityKnowledge(initialEntityId)
        .then(res => {
          setSelectedEntity(res);
          setViewMode('graph');
        })
        .catch(err => console.error('Failed to load initial entity from URL:', err));
    }
  }, [initialEntityId]);


  const handleCreateKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKbName.trim()) return;
    try {
      const created = await api.createKB({
        name: newKbName,
        description: newKbDesc,
        is_global: newKbIsGlobal,
        project_ids: currentProject ? [currentProject.id] : [],
      });
      setShowCreateKbModal(false);
      setNewKbName('');
      setNewKbDesc('');
      await loadKBs();
      setSelectedKbId(created.id);
    } catch (err) {
      console.error('Failed to create KB:', err);
    }
  };

  const handleAddFact = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetKbId = selectedKbId !== 'all' ? selectedKbId : (selectedEntity?.entity.kb_id || kbs[0]?.id);
    if (!targetKbId || !newFactTitle.trim() || !newFactContent.trim()) return;

    try {
      await api.addFact({
        kb_id: targetKbId,
        title: newFactTitle,
        content: newFactContent,
        category: newFactCategory,
        entity_name: newFactEntityName || undefined,
        entity_identifier: newFactEntityIdent || undefined,
      });
      setShowAddFactModal(false);
      setNewFactTitle('');
      setNewFactContent('');
      setNewFactEntityName('');
      setNewFactEntityIdent('');
      await refreshData();
      if (selectedEntity) {
        const updated = await api.getEntityKnowledge(selectedEntity.entity.id, selectedEntity.entity.kb_id);
        setSelectedEntity(updated);
      }
    } catch (err) {
      console.error('Failed to add fact:', err);
    }
  };

  const handleOpenAddFactForEntity = (entity: KBEntity) => {
    setNewFactEntityName(entity.name);
    setNewFactEntityIdent(entity.identifier || '');
    setNewFactTitle('');
    setNewFactContent('');
    setShowAddFactModal(true);
  };


  const handleOpenEditFact = (fact: KBFact) => {
    setEditingFact(fact);
    setEditFactTitle(fact.title);
    setEditFactContent(fact.content);
    setEditFactCategory(fact.category);
    setEditFactEntityName(fact.entity_name || '');
    setEditFactEntityIdent(fact.entity_identifier || '');
    setShowEditFactModal(true);
  };

  const handleUpdateFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFact) return;

    try {
      await api.updateFact(editingFact.id, {
        title: editFactTitle,
        content: editFactContent,
        category: editFactCategory,
        entity_name: editFactEntityName || undefined,
        entity_identifier: editFactEntityIdent || undefined,
      });
      setShowEditFactModal(false);
      setEditingFact(null);
      await refreshData();
    } catch (err) {
      console.error('Failed to update fact:', err);
    }
  };

  const handleDeleteFact = async (factId: string) => {
    if (!confirm('Are you sure you want to delete this gained knowledge fact?')) return;
    try {
      await api.deleteFact(factId);
      await refreshData();
    } catch (err) {
      console.error('Failed to delete fact:', err);
    }
  };

  const handleOpenEditEntity = (entity: KBEntity) => {
    setEditingEntity(entity);
    setEditEntityName(entity.name);
    setEditEntityType(entity.type);
    setEditEntityIdent(entity.identifier || '');
    setShowEditEntityModal(true);
  };

  const handleUpdateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntity) return;

    try {
      await api.updateEntity(editingEntity.id, {
        name: editEntityName,
        type: editEntityType,
        identifier: editEntityIdent || undefined,
      });
      setShowEditEntityModal(false);
      setEditingEntity(null);
      await refreshData();
    } catch (err) {
      console.error('Failed to update entity:', err);
    }
  };

  const handleSelectGraphNode = async (node: KBGraphNode) => {
    try {
      const res = await api.getEntityKnowledge(node.id, node.kb_id);
      setSelectedEntity(res);
      if (onSelectEntity) {
        onSelectEntity(node.id);
      }
    } catch (err) {
      console.error('Failed to fetch entity details:', err);
    }
  };

  const handleCloseInspector = () => {
    setSelectedEntity(null);
    if (onSelectEntity) {
      onSelectEntity(null);
    }
  };


  const handleAddRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntity || !relTargetEntityId) return;

    try {
      await api.addRelation({
        kb_id: selectedEntity.entity.kb_id,
        source_entity_id: selectedEntity.entity.id,
        target_entity_id: relTargetEntityId,
        relation_type: relType,
        description: relDesc || undefined,
      });
      setShowAddRelationModal(false);
      setRelDesc('');
      const updated = await api.getEntityKnowledge(selectedEntity.entity.id, selectedEntity.entity.kb_id);
      setSelectedEntity(updated);
      await refreshData();
    } catch (err) {
      console.error('Failed to add relation:', err);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-slate-100 p-6 space-y-4 ${viewMode === 'facts' ? 'overflow-y-auto' : 'overflow-hidden'}`}>

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Knowledge Base & Gained Knowledge Graph
            </h1>
            <p className="text-xs text-slate-400">
              Operational learnings, hardware specs, network IPs, and agent-gained facts.
            </p>
          </div>
        </div>

        {/* KB Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedKbId}
            onChange={(e) => setSelectedKbId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
          >
            <option value="all">⚡ All Linked & Global KBs</option>
            {kbs.map((kb: KBType) => (
              <option key={kb.id} value={kb.id}>
                {kb.name} {kb.is_global ? '(Global)' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateKbModal(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center space-x-1.5"
          >
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New KB</span>
          </button>

          <button
            onClick={() => setShowAddFactModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md transition flex items-center space-x-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Add Gained Knowledge</span>
          </button>
        </div>
      </div>

      {/* Search & View Mode Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            placeholder="Search IPs, hostnames, emails, or gained facts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-indigo-500 font-medium placeholder-slate-500 shadow-inner"
          />
          <svg className="w-4 h-4 text-slate-500 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('facts')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              viewMode === 'facts'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Fact Stream ({facts.length})
          </button>
          <button
            onClick={() => setViewMode('graph')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              viewMode === 'graph'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Knowledge Graph ({graphTree.nodes.length} Nodes)
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'facts' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {facts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
              <p className="text-sm font-medium">No gained knowledge facts matching search.</p>
              <p className="text-xs text-slate-500 mt-1">Click "Add Gained Knowledge" above to log operational learnings.</p>
            </div>
          ) : (
            facts.map((fact: KBFact) => (
              <div
                key={fact.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 transition-all shadow-sm flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {fact.category}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      {fact.entity_name && (
                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                          {fact.entity_name}
                        </span>
                      )}
                      <button
                        onClick={() => handleOpenEditFact(fact)}
                        className="text-slate-500 hover:text-indigo-400 p-1 rounded transition opacity-60 group-hover:opacity-100"
                        title="Edit Fact"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteFact(fact.id)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition opacity-60 group-hover:opacity-100"
                        title="Delete Fact"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100 mb-1.5">{fact.title}</h3>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{fact.content}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Confidence: {Math.round(fact.confidence * 100)}%</span>
                  <span>{new Date(fact.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 flex gap-6 min-h-0 h-full relative overflow-hidden">
          <div className="flex-1 h-full min-w-0">

            <KnowledgeGraphCanvas
              data={graphTree}
              selectedEntityId={selectedEntity?.entity.id}
              searchQuery={searchQuery}
              onSelectNode={handleSelectGraphNode}
            />

          </div>

          {/* Conditional Entity Details Inspector Side Panel (Stretches 100% height & fills available space!) */}
          {selectedEntity && (
            <div className="w-80 lg:w-[420px] h-full bg-slate-900/95 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col min-h-0 overflow-hidden backdrop-blur-md z-30 transition-all">
              {/* Fixed Header */}
              <div className="flex-none flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    {selectedEntity.entity.type}
                  </span>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    {selectedEntity.entity.name}
                    <button
                      onClick={() => handleOpenEditEntity(selectedEntity.entity)}
                      className="text-slate-500 hover:text-indigo-400 transition p-0.5"
                      title="Edit Entity Node"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </h2>
                  {selectedEntity.entity.identifier && (
                    <p className="text-xs font-mono text-slate-400 mt-0.5">{selectedEntity.entity.identifier}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowAddRelationModal(true)}
                    className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-medium rounded border border-indigo-500/40 transition"
                  >
                    + Edge
                  </button>
                  <button
                    onClick={handleCloseInspector}
                    className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer"
                    title="Close Panel"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Flex-1 Gained Knowledge Facts List (Fills all available height!) */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0 mb-4">
                <div className="flex-none flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Attached Gained Knowledge ({selectedEntity.facts.length})
                  </h4>
                  <button
                    onClick={() => handleOpenAddFactForEntity(selectedEntity.entity)}
                    className="px-2 py-0.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[11px] font-medium rounded border border-emerald-500/40 transition flex items-center gap-1 cursor-pointer"
                    title="Add Gained Knowledge Fact for this node"
                  >
                    + Add Fact
                  </button>
                </div>

                {selectedEntity.facts.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center p-4 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <p className="text-xs text-slate-500 italic">No specific facts attached directly.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
                    {selectedEntity.facts.map((f: KBFact) => (
                      <div key={f.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs group flex flex-col justify-between hover:border-slate-700 transition">
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-slate-200">{f.title}</p>
                            <div className="flex items-center space-x-1 opacity-60 group-hover:opacity-100">
                              <button
                                onClick={() => handleOpenEditFact(f)}
                                className="text-slate-500 hover:text-indigo-400 p-0.5"
                                title="Edit Fact"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteFact(f.id)}
                                className="text-slate-500 hover:text-red-400 p-0.5"
                                title="Delete Fact"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className="text-slate-300 mt-1.5 whitespace-pre-wrap leading-relaxed">{f.content}</p>
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500">
                          <span>Category: {f.category}</span>
                          <span>Confidence: {Math.round(f.confidence * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fixed Bottom Section: Graph Relations */}
              <div className="flex-none border-t border-slate-800/80 pt-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Graph Links ({selectedEntity.outgoing_relations.length + selectedEntity.incoming_relations.length})
                </h4>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {selectedEntity.outgoing_relations.map((r: KBRelation) => (
                    <div key={r.id} className="text-xs bg-slate-950 p-2 rounded border border-slate-800/80 flex items-center justify-between">
                      <span className="text-slate-300">--( {r.relation_type} )--&gt;</span>
                      <span className="font-bold text-emerald-400">{r.target_entity_name || 'Target'}</span>
                    </div>
                  ))}
                  {selectedEntity.incoming_relations.map((r: KBRelation) => (
                    <div key={r.id} className="text-xs bg-slate-950 p-2 rounded border border-slate-800/80 flex items-center justify-between">
                      <span className="font-bold text-emerald-400">{r.source_entity_name || 'Source'}</span>
                      <span className="text-slate-300">--( {r.relation_type} )--&gt;</span>
                    </div>
                  ))}
                  {selectedEntity.outgoing_relations.length === 0 && selectedEntity.incoming_relations.length === 0 && (
                    <p className="text-xs text-slate-500 italic">No graph edges linked to this entity.</p>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      )}


      {/* Modal: Create Knowledge Base */}
      {showCreateKbModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateKB} className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Knowledge Base</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">KB Name</label>
              <input
                type="text"
                placeholder="e.g. Home KB, Work KB, Infra KB"
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
              <textarea
                placeholder="Scope and purpose of this knowledge base..."
                value={newKbDesc}
                onChange={(e) => setNewKbDesc(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:border-indigo-500 outline-none resize-none"
              />
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="is_global"
                checked={newKbIsGlobal}
                onChange={(e) => setNewKbIsGlobal(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="is_global" className="text-xs text-slate-300">
                Make Global (accessible by all projects)
              </label>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateKbModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition"
              >
                Create KB
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Gained Knowledge */}
      {showAddFactModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddFact} className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Add Gained Knowledge</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Title</label>
              <input
                type="text"
                placeholder="e.g. Single CPU Constraint, Mail Server IP"
                value={newFactTitle}
                onChange={(e) => setNewFactTitle(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Content / Learning</label>
              <textarea
                placeholder="Detail what was learned (e.g., Server X has only 1 CPU core and should not be used to build container images)."
                value={newFactContent}
                onChange={(e) => setNewFactContent(e.target.value)}
                rows={4}
                required
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:border-indigo-500 outline-none resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Category</label>
                <select
                  value={newFactCategory}
                  onChange={(e) => setNewFactCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
                >
                  <option value="constraint">Constraint</option>
                  <option value="hardware">Hardware</option>
                  <option value="network">Network / IP</option>
                  <option value="config">Configuration</option>
                  <option value="gotcha">Gotcha / Warning</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Entity Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. server-01"
                  value={newFactEntityName}
                  onChange={(e) => setNewFactEntityName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Entity Identifier / IP / Email (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.50 or admin@work.com"
                value={newFactEntityIdent}
                onChange={(e) => setNewFactEntityIdent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddFactModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition"
              >
                Save Knowledge
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Fact */}
      {showEditFactModal && editingFact && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleUpdateFact} className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Edit Gained Knowledge Fact</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Title</label>
              <input
                type="text"
                value={editFactTitle}
                onChange={(e) => setEditFactTitle(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Content / Learning</label>
              <textarea
                value={editFactContent}
                onChange={(e) => setEditFactContent(e.target.value)}
                rows={4}
                required
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:border-indigo-500 outline-none resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Category</label>
                <select
                  value={editFactCategory}
                  onChange={(e) => setEditFactCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
                >
                  <option value="constraint">Constraint</option>
                  <option value="hardware">Hardware</option>
                  <option value="network">Network / IP</option>
                  <option value="config">Configuration</option>
                  <option value="gotcha">Gotcha / Warning</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Entity Name</label>
                <input
                  type="text"
                  value={editFactEntityName}
                  onChange={(e) => setEditFactEntityName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Entity Identifier / IP / Email</label>
              <input
                type="text"
                value={editFactEntityIdent}
                onChange={(e) => setEditFactEntityIdent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowEditFactModal(false);
                  setEditingFact(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition"
              >
                Update Fact
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Entity */}
      {showEditEntityModal && editingEntity && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleUpdateEntity} className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Edit Knowledge Graph Entity Node</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Entity Name</label>
              <input
                type="text"
                value={editEntityName}
                onChange={(e) => setEditEntityName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Entity Type</label>
              <input
                type="text"
                placeholder="e.g. server, ip_address, email, service, database"
                value={editEntityType}
                onChange={(e) => setEditEntityType(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Canonical Identifier (IP, Hostname, Email)</label>
              <input
                type="text"
                value={editEntityIdent}
                onChange={(e) => setEditEntityIdent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowEditEntityModal(false);
                  setEditingEntity(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition"
              >
                Update Entity Node
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Relation */}
      {showAddRelationModal && selectedEntity && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddRelation} className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Link Graph Relation</h3>
            <p className="text-xs text-slate-400">
              Source: <span className="font-semibold text-indigo-400">{selectedEntity.entity.name}</span>
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Relation Type</label>
              <input
                type="text"
                placeholder="e.g. runs_on, has_ip, depends_on, owned_by"
                value={relType}
                onChange={(e) => setRelType(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Target Entity</label>
              <select
                value={relTargetEntityId}
                onChange={(e) => setRelTargetEntityId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
              >
                <option value="">Select target entity...</option>
                {graphTree.nodes
                  .filter((n: KBGraphNode) => n.id !== selectedEntity.entity.id)
                  .map((n: KBGraphNode) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.type})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Description (Optional)</label>
              <input
                type="text"
                placeholder="Additional notes about relation..."
                value={relDesc}
                onChange={(e) => setRelDesc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddRelationModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition"
              >
                Save Relation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

