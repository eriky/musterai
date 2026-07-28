// File: src/web/notifications.ts
// Desktop notifications for card status transitions (MUS-17), driven by the
// existing SSE stream — see the `handleEvent` wiring in App.tsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Card, Event } from './types.js';

export type NotifiableStatus = 'in_review' | 'blocked';

export interface NotificationPrefs {
  in_review: boolean;
  blocked: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  in_review: true,
  blocked: true,
};

const PREFS_STORAGE_PREFIX = 'muster_notification_prefs_';

export function loadNotificationPrefs(projectId: string | null): NotificationPrefs {
  if (!projectId) return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = localStorage.getItem(`${PREFS_STORAGE_PREFIX}${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
      return {
        in_review: parsed.in_review !== false,
        blocked: parsed.blocked !== false,
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_NOTIFICATION_PREFS;
}

export function saveNotificationPrefs(projectId: string | null, prefs: NotificationPrefs): void {
  if (!projectId) return;
  try {
    localStorage.setItem(`${PREFS_STORAGE_PREFIX}${projectId}`, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

/**
 * A card `updated` event always carries the full `status` the caller sent,
 * even when it didn't change (the web edit form re-sends it on every save).
 * So this only tells us the event's *current* status — callers must compare
 * against the previously known status themselves to detect a real transition.
 */
export function getNotifiableStatus(event: Event): NotifiableStatus | null {
  if (event.entity_type !== 'card' || event.action !== 'updated') return null;
  const status = (event.payload as Record<string, unknown> | null | undefined)?.status;
  return status === 'in_review' || status === 'blocked' ? status : null;
}

function raiseCardNotification(event: Event, status: NotifiableStatus, cardTitle: string, onOpen: () => void): void {
  const actor = event.actor_name || 'Someone';
  const verb = status === 'in_review' ? 'moved to review' : 'blocked';
  // `body` is rendered as plain text by the Notification API (never parsed as
  // HTML), so the agent-authored card title is safe to interpolate directly.
  const notification = new Notification('Muster', {
    body: `${actor} ${verb} "${cardTitle}"`,
    tag: `muster-card-${event.entity_id}`,
  });
  notification.onclick = () => {
    window.focus();
    onOpen();
    notification.close();
  };
}

export interface CardNotifications {
  permission: NotificationPermission | 'unsupported';
  prefs: NotificationPrefs;
  updatePrefs: (prefs: NotificationPrefs) => void;
  requestPermission: () => void;
  handleEvent: (event: Event) => void;
}

/**
 * Tracks per-project notification preferences and raises a desktop
 * notification when a card's SSE `updated` event carries a genuine
 * transition into `in_review` or `blocked` — never on unrelated edits to a
 * card that already had that status, and never for the operator's own
 * actions.
 */
export function useCardNotifications(
  projectId: string | null,
  currentUserId: string | null,
  cards: Card[],
  onOpenCard: (cardId: string) => void,
): CardNotifications {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  );
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => loadNotificationPrefs(projectId));

  useEffect(() => {
    setPrefs(loadNotificationPrefs(projectId));
  }, [projectId]);

  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  const onOpenCardRef = useRef(onOpenCard);
  useEffect(() => { onOpenCardRef.current = onOpenCard; }, [onOpenCard]);

  // Last known status per card, kept in sync with the loaded board so we can
  // tell a real transition apart from a re-sent unchanged status.
  const statusRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    for (const c of cards) statusRef.current.set(c.id, c.status);
  }, [cards]);

  const updatePrefs = useCallback((next: NotificationPrefs) => {
    setPrefs(next);
    saveNotificationPrefs(projectId, next);
  }, [projectId]);

  const requestPermission = useCallback(() => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then(setPermission);
  }, []);

  const handleEvent = useCallback((event: Event) => {
    const status = getNotifiableStatus(event);
    if (!status || !prefsRef.current[status]) return;

    const operatorId = currentUserIdRef.current;
    if (operatorId && event.actor_id === operatorId) return;

    const previousStatus = statusRef.current.get(event.entity_id);
    if (previousStatus === status) return;
    statusRef.current.set(event.entity_id, status);

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    api.getCardDetails(event.entity_id)
      .then((card) => {
        raiseCardNotification(event, status, card.title, () => onOpenCardRef.current(event.entity_id));
      })
      .catch(() => {
        // Card may already be gone (deleted, or a permissions change) — skip silently.
      });
  }, []);

  return { permission, prefs, updatePrefs, requestPermission, handleEvent };
}
