import { Card } from './types.js';

export type CardDateSortOrder = 'newest' | 'oldest';

export const DONE_LANE_PAGE_SIZE = 25;

export const isDoneLane = (columnName: string): boolean =>
  columnName.trim().toLocaleLowerCase() === 'done';

export const sortCardsByUpdatedAt = (
  cards: Card[],
  order: CardDateSortOrder
): Card[] => {
  const direction = order === 'newest' ? -1 : 1;

  return [...cards].sort((left, right) => {
    const dateDifference =
      (Date.parse(left.updated_at) - Date.parse(right.updated_at)) * direction;

    if (dateDifference !== 0) return dateDifference;

    const positionDifference = left.position.localeCompare(right.position);
    if (positionDifference !== 0) return positionDifference;

    return left.id.localeCompare(right.id);
  });
};

export const getLaneCards = (
  cards: Card[],
  columnId: string,
  columnName: string,
  order: CardDateSortOrder,
  doneVisibleLimit = DONE_LANE_PAGE_SIZE
): { all: Card[]; visible: Card[]; hiddenCount: number } => {
  const all = sortCardsByUpdatedAt(
    cards.filter((card) => card.column_id === columnId && !card.archived),
    order
  );
  const visible = isDoneLane(columnName)
    ? all.slice(0, doneVisibleLimit)
    : all;

  return {
    all,
    visible,
    hiddenCount: all.length - visible.length,
  };
};
