import { memo, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import type { TaskStatus } from '@/types';

interface KanbanColumnProps {
  id: TaskStatus;
  label: string;
  color: string;
  taskCount: number;
  children: React.ReactNode;
}

export const KanbanColumn = memo(function KanbanColumn({ id, label, color, taskCount, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const bgColor = useMemo(() => {
    if (isOver) return 'bg-blue-50 ring-2 ring-blue-200';
    return 'bg-gray-50';
  }, [isOver]);

  return (
    <motion.div
      ref={setNodeRef}
      className={`rounded-xl p-4 min-h-[400px] transition-colors ${bgColor}`}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <h3 className="font-semibold text-gray-900">{label}</h3>
        <span className="ml-auto text-sm text-gray-500 bg-white px-2 py-0.5 rounded-full">
          {taskCount}
        </span>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </motion.div>
  );
});
