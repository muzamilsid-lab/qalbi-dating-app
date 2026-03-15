'use client';

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS }     from '@dnd-kit/utilities';
import { useState } from 'react';
import { clsx }    from 'clsx';
import { PromptDraft, Prompt, CATEGORY_META } from './types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  drafts:     PromptDraft[];
  catalogue:  Prompt[];
  onReorder:  (from: 0 | 1 | 2, to: 0 | 1 | 2) => void;
  onEdit:     (index: 0 | 1 | 2) => void;
  onDelete:   (index: 0 | 1 | 2) => void;
  onAdd:      (index: 0 | 1 | 2) => void;
}

// ─── Individual sortable item ─────────────────────────────────────────────────

interface SortableItemProps {
  id:       string;
  index:    0 | 1 | 2;
  draft:    PromptDraft;
  prompt:   Prompt | undefined;
  onEdit:   () => void;
  onDelete: () => void;
  onAdd:    () => void;
  isDragging?: boolean;
}

function SortableItem({ id, index, draft, prompt, onEdit, onDelete, onAdd, isDragging }: SortableItemProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isSorting,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isEmpty = !draft.promptId || !prompt;
  const meta    = prompt ? CATEGORY_META[prompt.category] : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'rounded-2xl transition-shadow',
        isDragging && 'opacity-50',
        isSorting && 'z-10',
      )}
    >
      {isEmpty ? (
        // ── Empty slot ──────────────────────────────────────────────────────
        <button
          onClick={onAdd}
          className={clsx(
            'w-full flex items-center gap-3 px-4 py-5 rounded-2xl',
            'border-2 border-dashed border-[var(--color-border)]',
            'text-[var(--color-text-muted)] hover:border-rose-400 hover:text-rose-400',
            'transition-colors',
          )}
          aria-label={`Add prompt ${index + 1}`}
        >
          <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">Add prompt {index + 1}</p>
            <p className="text-xs opacity-70">Tap to choose from the library</p>
          </div>
        </button>
      ) : (
        // ── Filled slot ─────────────────────────────────────────────────────
        <div
          className={clsx(
            'flex items-start gap-3 px-4 py-4 rounded-2xl',
            'bg-[var(--color-surface-alt)] border border-[var(--color-border)]',
            'group',
          )}
        >
          {/* Drag handle */}
          <button
            className="mt-1 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] touch-none cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M9 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM9 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM9 17a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
            </svg>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {meta && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-1 text-transparent bg-clip-text bg-gradient-to-r ${meta.color}`}>
                <span className="text-[11px]">{meta.icon}</span>
                {meta.label}
              </span>
            )}
            <p className="text-[var(--color-text-muted)] text-xs truncate">{prompt?.text}</p>
            <p className="text-[var(--color-text-primary)] text-sm font-semibold mt-0.5 line-clamp-2">
              {draft.answer}
            </p>
          </div>

          {/* Actions */}
          <div className="shrink-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="w-7 h-7 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-rose-400 transition-colors"
              aria-label="Edit answer"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="w-7 h-7 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-red-400 transition-colors"
              aria-label="Remove prompt"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main reorder container ───────────────────────────────────────────────────

export function PromptReorder({ drafts, catalogue, onReorder, onEdit, onDelete, onAdd }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const items = drafts.map((_, i) => `slot-${i}`);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = items.indexOf(active.id as string) as 0 | 1 | 2;
    const toIndex   = items.indexOf(over.id   as string) as 0 | 1 | 2;
    onReorder(fromIndex, toIndex);
  }

  const catalogueMap = new Map(catalogue.map(p => [p.id, p]));

  const activeIndex = activeId ? (items.indexOf(activeId) as 0 | 1 | 2) : null;
  const activeDraft = activeIndex !== null ? drafts[activeIndex] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {drafts.map((draft, i) => (
            <SortableItem
              key={`slot-${i}`}
              id={`slot-${i}`}
              index={i as 0 | 1 | 2}
              draft={draft}
              prompt={draft.promptId != null ? catalogueMap.get(draft.promptId) : undefined}
              onEdit={() => onEdit(i as 0 | 1 | 2)}
              onDelete={() => onDelete(i as 0 | 1 | 2)}
              onAdd={() => onAdd(i as 0 | 1 | 2)}
              isDragging={activeId === `slot-${i}`}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeDraft && activeIndex !== null && (
          <div className="opacity-95 rotate-1 shadow-2xl rounded-2xl">
            <SortableItem
              id="overlay"
              index={activeIndex}
              draft={activeDraft}
              prompt={activeDraft.promptId != null ? catalogueMap.get(activeDraft.promptId) : undefined}
              onEdit={() => {}}
              onDelete={() => {}}
              onAdd={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
