// File: src/web/components/KnowledgeGraphCanvas.tsx
import React, { useEffect, useRef, useMemo } from 'react';
import * as vis from 'vis-network/standalone/esm/vis-network.js';
import { DataSet } from 'vis-data';
import { KBGraphTree, KBGraphNode } from '../types.js';
import { ZoomIn, ZoomOut, RefreshCw, Move, Search, Zap } from 'lucide-react';
import { useTheme } from '../ThemeContext.js';

interface KnowledgeGraphCanvasProps {
  data: KBGraphTree;
  selectedEntityId?: string;
  searchQuery?: string;
  onSelectNode: (node: KBGraphNode) => void;
}

// Dark mode node palettes (rich, vivid backgrounds with light text)
const TYPE_COLORS_DARK: Record<string, { bg: string; border: string; highlightBg: string; text: string }> = {
  ip_address:     { bg: '#1e3a8a', border: '#3b82f6', highlightBg: '#2563eb',  text: '#93c5fd' },
  email:          { bg: '#831843', border: '#ec4899', highlightBg: '#db2777',  text: '#fbcfe8' },
  server:         { bg: '#064e3b', border: '#10b981', highlightBg: '#059669',  text: '#a7f3d0' },
  service:        { bg: '#3b0764', border: '#a855f7', highlightBg: '#7c3aed',  text: '#e9d5ff' },
  database:       { bg: '#78350f', border: '#f59e0b', highlightBg: '#d97706',  text: '#fde68a' },
  network:        { bg: '#0c4a6e', border: '#0ea5e9', highlightBg: '#0284c7',  text: '#bae6fd' },
  credential_ref: { bg: '#7f1d1d', border: '#ef4444', highlightBg: '#dc2626',  text: '#fca5a5' },
  person:         { bg: '#881337', border: '#f43f5e', highlightBg: '#e11d48',  text: '#fecdd3' },
  custom:         { bg: '#1f2937', border: '#6b7280', highlightBg: '#4b5563',  text: '#d1d5db' },
};

// Light mode palettes (muted, pastel bg with dark text for readability)
const TYPE_COLORS_LIGHT: Record<string, { bg: string; border: string; highlightBg: string; text: string }> = {
  ip_address:     { bg: '#dbeafe', border: '#3b82f6', highlightBg: '#bfdbfe',  text: '#1e3a8a' },
  email:          { bg: '#fce7f3', border: '#ec4899', highlightBg: '#fbcfe8',  text: '#831843' },
  server:         { bg: '#d1fae5', border: '#10b981', highlightBg: '#a7f3d0',  text: '#064e3b' },
  service:        { bg: '#ede9fe', border: '#8b5cf6', highlightBg: '#ddd6fe',  text: '#4c1d95' },
  database:       { bg: '#fef3c7', border: '#f59e0b', highlightBg: '#fde68a',  text: '#78350f' },
  network:        { bg: '#e0f2fe', border: '#0ea5e9', highlightBg: '#bae6fd',  text: '#0c4a6e' },
  credential_ref: { bg: '#fee2e2', border: '#ef4444', highlightBg: '#fca5a5',  text: '#7f1d1d' },
  person:         { bg: '#ffe4e6', border: '#f43f5e', highlightBg: '#fecdd3',  text: '#881337' },
  custom:         { bg: '#f3f4f6', border: '#6b7280', highlightBg: '#e5e7eb',  text: '#1f2937' },
};

function formatNode(
  node: KBGraphNode,
  isSelected: boolean,
  isSearchMatched: boolean,
  isSearchActive: boolean,
  linkCount: number,
  isDark: boolean,
) {
  const palette = isDark ? TYPE_COLORS_DARK : TYPE_COLORS_LIGHT;
  const colors = palette[node.type] || palette.custom;
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

  const selectedBorder = isDark ? '#818cf8' : '#7c3aed';
  const dimBg       = isDark ? '#0f172a' : '#e5e7eb';
  const dimBorder   = isDark ? '#1e293b' : '#cbd5e1';
  const dimText     = isDark ? '#475569' : '#94a3b8';
  const strokeColor = isDark ? '#020617' : '#ffffff';

  // Visual styling based on selection and search match state
  let bgColor = colors.bg;
  let borderColor = isSelected ? selectedBorder : colors.border;
  let textColor = colors.text;
  let borderWidth = isSelected ? 3.5 : 2;
  let opacity = 1.0;
  let shadowSize = 8;
  let shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)';

  if (isSearchActive) {
    if (isSearchMatched) {
      borderColor = '#f59e0b'; // Bright amber gold border
      bgColor = colors.highlightBg;
      borderWidth = 4;
      shadowSize = 16;
      shadowColor = 'rgba(245, 158, 11, 0.8)';
    } else {
      opacity = 0.25; // Dim non-matching nodes
      bgColor = dimBg;
      borderColor = dimBorder;
      textColor = dimText;
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
      strokeWidth: isDark ? 3 : 2,
      strokeColor,
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
        border: selectedBorder,
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
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
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
        // Use dark text on light bg nodes, white on dark bg nodes
        const htmlEl = document.documentElement;
        ctx.fillStyle = htmlEl.classList.contains('light') ? '#1f2937' : '#ffffff';
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
      const formatted = formatNode(node, isSelected, isSearchMatched, isSearchActive, linkCount, isDark);
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
    const edgesDS2 = edgesDS;
    const edgesToUpsert = data.links.map(link => {
      const isConnectedToMatch = searchMatchedIds.has(link.source) || searchMatchedIds.has(link.target);
      const baseEdgeColor   = isDark ? '#334155' : '#94a3b8';
      const dimEdgeColor    = isDark ? '#1e293b' : '#e2e8f0';
      const edgeColor       = isSearchActive && !isConnectedToMatch ? dimEdgeColor : baseEdgeColor;
      const edgeOpacity     = isSearchActive && !isConnectedToMatch ? 0.2 : 1.0;
      const labelColor      = isSearchActive && !isConnectedToMatch ? dimEdgeColor : (isDark ? '#94a3b8' : '#64748b');
      const strokeColor     = isDark ? '#020617' : '#ffffff';
      const highlightHover  = isDark ? '#818cf8' : '#7c3aed';

      return {
        id: link.id,
        from: link.source,
        to: link.target,
        label: link.relation_type,
        font: {
          color: labelColor,
          size: 10,
          face: 'monospace',
          strokeWidth: isDark ? 3 : 2,
          strokeColor,
          align: 'horizontal',
        },
        arrows: {
          to: { enabled: true, scaleFactor: 0.5 },
        },
        color: {
          color: edgeColor,
          highlight: '#f59e0b',
          hover: highlightHover,
          opacity: edgeOpacity,
        },
        width: isConnectedToMatch && isSearchActive ? 3 : 2,
        smooth: {
          type: 'continuous',
          roundness: 0.2,
        },
      };
    });
    edgesDS2.update(edgesToUpsert);

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
  }, [data.nodes, data.links, selectedEntityId, searchMatchedIds, isSearchActive, isDark]);

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
    <div className="cap-panel relative w-full h-full min-h-[450px] overflow-hidden flex-1">
      {/* Empty State Overlay when no nodes exist */}
      {data.nodes.length === 0 && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-command-surface cap-text-muted">
          <Zap className="w-12 h-12 mb-3 cap-text-faint" />
          <p className="text-base font-medium">No Graph Nodes Found</p>
          <p className="text-sm mt-1">Add entities and gained knowledge facts to populate the graph.</p>
        </div>
      )}

      {/* Search Overlay Badge */}
      {isSearchActive && (
        <div className="cap-badge cap-badge-warning absolute top-3 left-3 z-20 px-3 py-1.5 normal-case tracking-normal text-xs backdrop-blur-md">
          <Search className="w-3.5 h-3.5" />
          <span>
            Search Active: {searchMatchedIds.size} {searchMatchedIds.size === 1 ? 'node' : 'nodes'} matched
          </span>
        </div>
      )}

      {/* Control Overlay Buttons */}
      <div className="cap-panel absolute top-3 right-3 z-20 flex items-center gap-1 p-1 backdrop-blur-md">
        <button onClick={handleZoomIn} className="cap-btn cap-btn-icon cap-btn-ghost" title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={handleZoomOut} className="cap-btn cap-btn-icon cap-btn-ghost" title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={handleResetView} className="cap-btn cap-btn-icon cap-btn-soft" title="Fit Graph to Screen">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Helper Legend */}
      <div className="cap-panel absolute bottom-3 left-3 z-20 px-3 py-1.5 text-[11px] flex items-center gap-2 cap-text-muted backdrop-blur-md">
        <Move className="w-3.5 h-3.5 cap-accent" />
        <span>Drag nodes to rearrange • Smooth cursor zoom • Search highlights matching nodes in gold</span>
      </div>

      {/* vis-network Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
