'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Auftrag, STATUS_COLORS_LIGHT, STATUS_TEXT_COLORS, STATUS_LABELS, STATUS_DOT_COLORS } from '@/lib/types';

interface Props {
  auftrag: Auftrag;
  durationHours: number;
  onClick: () => void;
}

export default function AuftragCard({ auftrag, durationHours, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: auftrag.id,
    data: { auftrag },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`rounded border ${STATUS_COLORS_LIGHT[auftrag.status]} ${STATUS_TEXT_COLORS[auftrag.status]}
                  p-1.5 text-xs leading-tight select-none overflow-hidden h-full w-full`}
    >
      <div className="flex items-start gap-1">
        <span className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${STATUS_DOT_COLORS[auftrag.status]}`} />
        <div className="overflow-hidden">
          <div className="font-semibold truncate">{auftrag.titel}</div>
          {auftrag.kunde && <div className="truncate opacity-70 text-[10px]">{auftrag.kunde}</div>}
          {durationHours > 1 && (
            <div className="opacity-50 text-[10px]">{STATUS_LABELS[auftrag.status]}</div>
          )}
        </div>
      </div>
    </div>
  );
}
