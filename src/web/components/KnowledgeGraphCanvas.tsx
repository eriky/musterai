// File: src/web/components/KnowledgeGraphCanvas.tsx
import React, { useEffect, useRef, useMemo } from 'react';
import * as vis from 'vis-network/standalone/esm/vis-network.js';
import { DataSet } from 'vis-data';
import { KBGraphTree, KBGraphNode } from '../types.js';
import { ZoomIn, ZoomOut, RefreshCw, Move, Search } from 'lucide-react';

interface KnowledgeGraphCanvasProps {
  data: KBGraphTree;
  selectedEntityId?: string;
  searchQuery?: string;
  onSelectNode: (node: KBGraphNode) => void;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; highlightBg: string; text: string }> = {
  ip_address: { bg: '#1e3a8a', border: '#3b82f6', highlightBg: '#2563eb', text: '#93c5fd' },
  email: { bg: '#831843', border: '#ec4899', highlightBg: '#db2777', text: '#fbcfe8' },
  server: { bg: '#064e3b', border: '#10b981', highlightBg: '#059669', text: '#a7f3d0' },
  service: { bg: '#581c87', border: '#a855f7', highlightBg: '#9333ea', text: '#e9d5ff' },
  database: { bg: '#78350f', border: '#f59e0b', highlightBg: '#d97706', text: '#fde68a' },
  network: { bg: '#0c4a6e', border: '#0ea5e9', highlightBg: '#0284c7', text: '#bae6fd' },
  credential_ref: { bg: '#7f1d1d', border: '#ef4444', highlightBg: '#dc2626', text: '#fca5a5' },
  person: { bg: '#881337', border: '#f43f5e', highlightBg: '#e11d48', text: '#fecdd3' },
  custom: { bg: '#1f2937', border: '#6b7280', highlightBg: '#4b5563', text: '#d1d5db' },
};

function formatNode(
  node: KBGraphNode,
  isSelected: boolean,
  isSearchMatched: boolean,
  isSearchActive: boolean,
  linkCount: number
) {
  const colors = TYPE_COLORS[node.type] || TYPE_COLORS.custom;
  let labelText = node.name;
  if (node.identifier && node.identifier !== node.name) {
    labelText += `\n(${node.identifier})`;
  }

  const factCount = node.fact_count || 0;
  const weight = factCount * 2 + linkCount;
  const baseSize = isSelected ? 24 : 18;
  let nodeSize = Math.min(48, baseSize + weight * 3);
  if (isSearchMatched) {
    nodeSize += 6; // Visual size boost for search matches
  }

  // Visual styling based on selection and search match state
  let bgColor = colors.bg;
  let borderColor = isSelected ? '#818cf8' : colors.border;
  let textColor = '#f8fafc';
  let borderWidth = isSelected ? 3.5 : 2;
  let opacity = 1.0;
  let shadowSize = 8;
  let shadowColor = 'rgba(0,0,0,0.5)';

  if (isSearchActive) {
    if (isSearchMatched) {
      borderColor = '#f59e0b'; // Bright amber gold border
      bgColor = colors.highlightBg;
      borderWidth = 4;
      shadowSize = 16;
      shadowColor = 'rgba(245, 158, 11, 0.8)';
    } else {
      opacity = 0.25; // Dim non-matching nodes
      bgColor = '#0f172a';
      borderColor = '#1e293b';
      textColor = '#475569';
    }
  }

  return {
    id: node.id,
    label: labelText,
    shape: 'dot',
    size: nodeSize,
    opacity,
    font: {
      color: textColor,
      size: isSearchMatched ? 13 : 12,
      face: 'sans-serif',
      multi: 'html',
      strokeWidth: 3,
      strokeColor: '#020617',
    },
    color: {
      background: bgColor,
      border: borderColor,
      highlight: {
        background: colors.highlightBg,
        border: '#f59e0b',
      },
      hover: {
        background: colors.highlightBg,
        border: '#818cf8',
      },
    },
    borderWidth,
    shadow: {
      enabled: true,
      color: shadowColor,
      size: shadowSize,
      x: 2,
      y: 4,
    },
  };
}

export const KnowledgeGraphCanvas: React.FC<KnowledgeGraphCanvasProps> = ({
  data,
  selectedEntityId,
  searchQuery,
  onSelectNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);
  const nodesDataSetRef = useRef<DataSet<any> | null>(null);
  const edgesDataSetRef = useRef<DataSet<any> | null>(null);
  const hasFittedRef = useRef<boolean>(false);

  const onSelectNodeRef = useRef(onSelectNode);
  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  const dataNodesRef = useRef(data.nodes);
  useEffect(() => {
    dataNodesRef.current = data.nodes;
    if (data.nodes.length === 0) {
      hasFittedRef.current = false;
    }
  }, [data.nodes]);

  // Compute search matched node IDs
  const searchMatchedIds = useMemo(() => {
    if (!searchQuery?.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase().trim();
    const matched = data.nodes.filter(n =>
      n.name.toLowerCase().includes(q) ||
      (n.identifier && n.identifier.toLowerCase().includes(q)) ||
      n.type.toLowerCase().includes(q)
    );
    return new Set(matched.map(n => n.id));
  }, [data.nodes, searchQuery]);

  const isSearchActive = (searchQuery?.trim().length || 0) > 0;

  // 1. Mount Network ONCE
  useEffect(() => {
    if (!containerRef.current) return;

    const nodesDS = new DataSet([]);
    const edgesDS = new DataSet([]);
    nodesDataSetRef.current = nodesDS;
    edgesDataSetRef.current = edgesDS;

    const options = {
      nodes: {
        scaling: {
          min: 14,
          max: 48,
        },
      },
      edges: {
        smooth: true,
      },
      physics: {
        enabled: true,
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: -8000,
          centralGravity: 0.15,
          springLength: 200,
          springConstant: 0.03,
          damping: 0.09,
          avoidOverlap: 1.0,
        },
        stabilization: {
          enabled: true,
          iterations: 150,
          fit: true,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        zoomSpeed: 0.05, // Micro-step smooth mouse wheel & trackpad zoom (reduced from giant default steps!)
        dragView: true,
        dragNodes: true,
      },

    };

    const NetworkConstructor = (vis as any).Network || vis;
    const network = new NetworkConstructor(containerRef.current, { nodes: nodesDS, edges: edgesDS }, options);
    networkRef.current = network;

    const resizeObserver = new ResizeObserver(() => {
      if (networkRef.current) {
        networkRef.current.setSize('100%', '100%');
        networkRef.current.redraw();
      }
    });
    resizeObserver.observe(containerRef.current);

    network.on('click', (params: { nodes: (string | number)[] }) => {
      if (params.nodes.length > 0) {
        const clickedId = String(params.nodes[0]);
        const found = dataNodesRef.current.find(n => n.id === clickedId);
        if (found) {
          onSelectNodeRef.current(found);
        }
      }
    });

    // Render Fact Count inside each node circle
    network.on('afterDrawing', (ctx: CanvasRenderingContext2D) => {
      const nodePositions = network.getPositions();
      dataNodesRef.current.forEach(node => {
        const pos = nodePositions[node.id];
        if (!pos) return;
        const factCount = node.fact_count || 0;
        if (factCount === 0) return;

        ctx.save();
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${factCount}`, pos.x, pos.y);
        ctx.restore();
      });
    });

    return () => {
      resizeObserver.disconnect();
      network.destroy();
      networkRef.current = null;
      nodesDataSetRef.current = null;
      edgesDataSetRef.current = null;
      hasFittedRef.current = false;
    };
  }, []);

  // 2. Differential Dataset Update
  useEffect(() => {
    const nodesDS = nodesDataSetRef.current;
    const edgesDS = edgesDataSetRef.current;
    if (!nodesDS || !edgesDS) return;

    // Calculate link degree (connected edge count) per node
    const degreeMap = new Map<string, number>();
    data.links.forEach(link => {
      degreeMap.set(link.source, (degreeMap.get(link.source) || 0) + 1);
      degreeMap.set(link.target, (degreeMap.get(link.target) || 0) + 1);
    });

    // Remove deleted nodes
    const incomingNodeIds = new Set(data.nodes.map(n => n.id));
    const existingNodeIds = new Set(nodesDS.getIds().map(id => String(id)));
    existingNodeIds.forEach(id => {
      if (!incomingNodeIds.has(id)) {
        nodesDS.remove(id);
      }
    });

    // Upsert nodes with search matching & dynamic scaling
    const nodesToUpsert = data.nodes.map(node => {
      const isSelected = selectedEntityId === node.id;
      const isSearchMatched = searchMatchedIds.has(node.id);
      const linkCount = degreeMap.get(node.id) || 0;
      const formatted = formatNode(node, isSelected, isSearchMatched, isSearchActive, linkCount);
      const existing = nodesDS.get(node.id);
      if (existing && existing.x !== undefined) {
        return {
          ...formatted,
          x: existing.x,
          y: existing.y,
        };
      }
      return formatted;
    });
    nodesDS.update(nodesToUpsert);

    // Remove deleted edges
    const incomingEdgeIds = new Set(data.links.map(l => l.id));
    const existingEdgeIds = new Set(edgesDS.getIds().map(id => String(id)));
    existingEdgeIds.forEach(id => {
      if (!incomingEdgeIds.has(id)) {
        edgesDS.remove(id);
      }
    });

    // Upsert edges (dim edges during search if not connected to matched nodes)
    const edgesToUpsert = data.links.map(link => {
      const isConnectedToMatch = searchMatchedIds.has(link.source) || searchMatchedIds.has(link.target);
      const edgeColor = isSearchActive && !isConnectedToMatch ? '#1e293b' : '#334155';
      const edgeOpacity = isSearchActive && !isConnectedToMatch ? 0.2 : 1.0;

      return {
        id: link.id,
        from: link.source,
        to: link.target,
        label: link.relation_type,
        font: {
          color: isSearchActive && !isConnectedToMatch ? '#334155' : '#94a3b8',
          size: 10,
          face: 'monospace',
          strokeWidth: 3,
          strokeColor: '#020617',
          align: 'horizontal',
        },
        arrows: {
          to: { enabled: true, scaleFactor: 0.5 },
        },
        color: {
          color: edgeColor,
          highlight: '#f59e0b',
          hover: '#818cf8',
          opacity: edgeOpacity,
        },
        width: isConnectedToMatch && isSearchActive ? 3 : 2,
        smooth: {
          type: 'continuous',
          roundness: 0.2,
        },
      };
    });
    edgesDS.update(edgesToUpsert);

    if (selectedEntityId && networkRef.current) {
      networkRef.current.selectNodes([selectedEntityId]);
    }

    // Auto-fit camera view on initial node population or search filtering
    if (!hasFittedRef.current && data.nodes.length > 0 && networkRef.current) {
      hasFittedRef.current = true;
      setTimeout(() => {
        if (networkRef.current) {
          networkRef.current.fit({ animation: { duration: 350, easingFunction: 'easeInOutQuad' } });
        }
      }, 150);
    }
  }, [data.nodes, data.links, selectedEntityId, searchMatchedIds, isSearchActive]);

  // Focus camera on search matched nodes
  useEffect(() => {
    if (isSearchActive && searchMatchedIds.size > 0 && networkRef.current) {
      const nodeArray = Array.from(searchMatchedIds);
      networkRef.current.fit({
        nodes: nodeArray,
        animation: { duration: 350, easingFunction: 'easeInOutQuad' },
      });
    }
  }, [isSearchActive, searchMatchedIds]);

  const handleZoomIn = () => {
    if (!networkRef.current) return;
    const currScale = networkRef.current.getScale();
    networkRef.current.moveTo({ scale: currScale * 1.12, animation: { duration: 150, easingFunction: 'easeInOutQuad' } });
  };

  const handleZoomOut = () => {
    if (!networkRef.current) return;
    const currScale = networkRef.current.getScale();
    networkRef.current.moveTo({ scale: currScale / 1.12, animation: { duration: 150, easingFunction: 'easeInOutQuad' } });
  };


  const handleResetView = () => {
    if (!networkRef.current) return;
    networkRef.current.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  };

  return (
    <div className="relative w-full h-full min-h-[450px] bg-slate-950/90 rounded-xl border border-slate-800 overflow-hidden shadow-2xl flex-1">
      {/* Empty State Overlay when no nodes exist */}
      {data.nodes.length === 0 && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-slate-400 bg-slate-950/90 backdrop-blur-sm">
          <svg className="w-12 h-12 mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-base font-medium">No Graph Nodes Found</p>
          <p className="text-sm text-slate-500 mt-1">Add entities and gained knowledge facts to populate the graph.</p>
        </div>
      )}

      {/* Search Overlay Badge */}
      {isSearchActive && (
        <div className="absolute top-3 left-3 z-20 px-3 py-1.5 bg-amber-950/90 border border-amber-500/40 rounded-lg text-amber-300 text-xs font-semibold flex items-center space-x-2 backdrop-blur-md shadow-lg">
          <Search className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Search Active: {searchMatchedIds.size} {searchMatchedIds.size === 1 ? 'node' : 'nodes'} matched
          </span>
        </div>
      )}

      {/* Control Overlay Buttons */}
      <div className="absolute top-3 right-3 z-20 flex items-center space-x-1.5 bg-slate-900/90 p-1.5 rounded-lg border border-slate-800 backdrop-blur-md shadow-lg">
        <button
          onClick={handleZoomIn}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded transition cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded transition cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-800/80 hover:bg-slate-700 rounded transition flex items-center space-x-1 cursor-pointer"
          title="Fit Graph to Screen"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Helper Legend */}
      <div className="absolute bottom-3 left-3 z-20 px-3 py-1.5 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center space-x-2 backdrop-blur-md">
        <Move className="w-3.5 h-3.5 text-indigo-400" />
        <span>Drag nodes to rearrange • Smooth cursor zoom • Search highlights matching nodes in gold</span>
      </div>

      {/* vis-network Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
