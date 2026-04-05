import { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Card } from '@/components/common';
import type { Task } from '@/types';
import { TASK_PRIORITY_COLORS } from '@/types';
import { useTagStore } from '@/stores/tagStore';
import { useI18n } from '@/i18n';
import dayjs from 'dayjs';

interface KanbanCardProps {
  task: Task;
  onClick: () => void;
  isDragging?: boolean;
}

export const KanbanCard = memo(function KanbanCard({ task, onClick, isDragging }: KanbanCardProps) {
  const { t } = useI18n();
  const { getTagsByIds } = useTagStore();
  const taskTags = useMemo(() => getTagsByIds(task.tags), [task.tags, getTagsByIds]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
  }), [transform, transition]);

  const isOverdue = useMemo(() => (
    task.dueDate && task.status !== 'done'
      ? dayjs(task.dueDate).isBefore(dayjs(), 'day')
      : false
  ), [task.dueDate, task.status]);

  const priorityIndicator = useMemo(() => {
    const colorClass = TASK_PRIORITY_COLORS[task.priority];
    const labels: Record<string, string> = {
      high: t.high,
      medium: t.medium,
      low: t.low,
    };
    return (
      <span className={`text-xs font-medium ${colorClass}`}>
        {labels[task.priority]}
      </span>
    );
  }, [task.priority, t]);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isSortableDragging ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      whileHover={{ scale: isDragging ? 1 : 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        hover
        className={`
          cursor-grab active:cursor-grabbing
          ${isSortableDragging ? 'opacity-50' : ''}
          ${isDragging ? 'shadow-xl' : ''}
        `}
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{task.title}</h4>
          {priorityIndicator}
        </div>
        {task.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
        )}
        {taskTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {taskTags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-0.5 rounded-full text-xs text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
            {taskTags.length > 3 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                +{taskTags.length - 3}
              </span>
            )}
          </div>
        )}
        {task.dueDate && (
          <div className={`mt-2 text-xs ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
            {isOverdue && <span className="mr-1">⚠️</span>}
            {t.dueDate}: {dayjs(task.dueDate).format('MM-DD')}
          </div>
        )}
      </Card>
    </motion.div>
  );
});
