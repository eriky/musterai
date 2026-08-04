// File: src/web/components/CardSearch.tsx
import React, { useState, useEffect, useRef, useId } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Card } from '../types.js';
import { api } from '../api.js';

interface CardSearchProps {
  cards?: Card[];
  projectId?: string;
  excludeCardId?: string;
  placeholder?: string;
  onSelectCard: (card: Card) => void;
  className?: string;
  autoFocus?: boolean;
}

export const CardSearch: React.FC<CardSearchProps> = ({
  cards,
  projectId,
  excludeCardId,
  placeholder = 'Search cards by title or key...',
  onSelectCard,
  className = '',
  autoFocus = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Search logic (either in-memory from props or via API)
  useEffect(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    if (cards) {
      // Filter in-memory cards list
      const matched = cards.filter(
        (c) =>
          c.id !== excludeCardId &&
          (c.title.toLowerCase().includes(trimmed) || c.key.toLowerCase().includes(trimmed))
      );
      setResults(matched.slice(0, 8));
      setIsOpen(matched.length > 0);
      setSelectedIndex(matched.length > 0 ? 0 : -1);
    } else {
      // API search
      setIsSearching(true);
      const timer = setTimeout(async () => {
        try {
          const list = projectId ? await api.searchCards(projectId, trimmed, excludeCardId) : [];
          setResults(list.slice(0, 8));
          setIsOpen(list.length > 0);
          setSelectedIndex(list.length > 0 ? 0 : -1);
        } catch (err) {
          console.error('Card search failed:', err);
          setResults([]);
          setIsOpen(false);
        } finally {
          setIsSearching(false);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [query, cards, projectId, excludeCardId]);

  // Handle Outside Click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard Navigation Handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && query.trim() && results.length > 0) {
        setIsOpen(true);
        setSelectedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          const targetCard = results[selectedIndex];
          onSelectCard(targetCard);
          setQuery('');
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  const handleSelect = (card: Card) => {
    onSelectCard(card);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 muster-text-muted absolute left-2.5 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={selectedIndex >= 0 ? `${listboxId}-option-${selectedIndex}` : undefined}
          className="muster-input text-xs py-1 pl-8 pr-7 w-full font-sans"
        />
        {isSearching && (
          <Loader2 className="w-3.5 h-3.5 muster-accent animate-spin absolute right-2.5 pointer-events-none" />
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-muster-surface border border-muster-border rounded-lg shadow-xl py-1 text-xs"
        >
          {results.map((card, idx) => {
            const isHighlighted = idx === selectedIndex;
            return (
              <div
                key={card.id}
                id={`${listboxId}-option-${idx}`}
                role="option"
                aria-selected={isHighlighted}
                onClick={() => handleSelect(card)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                  isHighlighted ? 'bg-brand-500/15 muster-text-primary' : 'hover:bg-muster-surface-hover muster-text-primary'
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0 flex-1 pr-2">
                  <span className="font-mono text-[10px] muster-accent font-bold shrink-0">
                    {card.key}
                  </span>
                  <span className="truncate font-medium">{card.title}</span>
                </div>
                {card.is_epic ? (
                  <span className="muster-badge muster-badge-accent shrink-0 text-[10px]">EPIC</span>
                ) : (
                  <span className="muster-badge muster-badge-neutral shrink-0 text-[10px] uppercase">
                    {card.priority}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
