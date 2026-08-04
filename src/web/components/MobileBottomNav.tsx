import React from 'react';
import { Bot, Layout, FileText, Database, Activity } from 'lucide-react';

type TabId = 'agents' | 'board' | 'docs' | 'activity' | 'kb' | 'tokens' | 'admin';

interface MobileBottomNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const items: { id: TabId; icon: React.ElementType; label: string }[] = [
    { id: 'board', icon: Layout, label: 'Board' },
    { id: 'docs', icon: FileText, label: 'Docs' },
    { id: 'kb', icon: Database, label: 'KB' },
    { id: 'activity', icon: Activity, label: 'Activity' },
    { id: 'agents', icon: Bot, label: 'Agents' },
  ];

  return (
    <nav
      aria-label="Mobile navigation bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-muster-surface border-t border-muster-border shadow-2xl flex items-center justify-around px-1 py-1"
    >
      {items.map(({ id, icon: Icon, label }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectTab(id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-lg text-xs font-sans font-medium transition-all min-h-[48px] cursor-pointer ${
              isActive
                ? 'muster-accent bg-brand-500/10 font-semibold'
                : 'muster-text-muted hover:muster-text-primary'
            }`}
          >
            <Icon className={`w-5 h-5 mb-1 shrink-0 ${isActive ? 'muster-accent' : 'muster-text-muted'}`} />
            <span className="text-[11px] leading-none truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
};
