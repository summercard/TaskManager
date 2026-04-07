import { useState, useMemo, useCallback, memo } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import type { Task, TaskStatus } from '@/types';
import { TASK_STATUS_LABELS } from '@/types';

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: TASK_STATUS_LABELS.todo, color: 'bg-blue-500' },
  { id: 'in_progress', label: TASK_STATUS_LABELS.in_progress, color: 'bg-yellow-500' },
  { id: 'done', label: TASK_STATUS_LABELS.done, color: 'bg-green-500' },
];

interface KanbanBoardProps {
  tasks: Task[];
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
}

export const KanbanBoard = memo(function KanbanBoard({ tasks, onTaskStatusChange, onTaskClick }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getTasksByStatus = useCallback((status: TaskStatus) => {
    return tasks.filter((task) => task.status === status);
  }, [tasks]);

  const activeTask = useMemo(() => {
    return activeId ? tasks.find((task) => task.id === activeId) : null;
  }, [activeId, tasks]);

  const tasksByStatus = useMemo(() => {
    return COLUMNS.reduce((acc, col) => {
      acc[col.id] = getTasksByStatus(col.id);
      return acc;
    }, {} as Record<TaskStatus, Task[]>);
  }, [getTasksByStatus]);

  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    return rectIntersection(args);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const task = tasks.find((t) => t.id === active.id);
    if (!task) {
      setActiveId(null);
      return;
    }

    const overId = over.id as string;
    const overTask = tasks.find((t) => t.id === overId);

    let newStatus: TaskStatus | null = null;

    if (overTask) {
      newStatus = overTask.status;
    } else {
      const column = COLUMNS.find((col) => col.id === overId);
      if (column) {
        newStatus = column.id;
      }
    }

    if (newStatus && newStatus !== task.status) {
      onTaskStatusChange(task.id, newStatus);
    }

    setActiveId(null);
  }, [tasks, onTaskStatusChange]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence mode="popLayout">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              label={column.label}
              color={column.color}
              taskCount={tasksByStatus[column.id].length}
            >
              <SortableContext
                items={tasksByStatus[column.id].map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <AnimatePresence mode="popLayout">
                  {tasksByStatus[column.id].length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-8 text-gray-400 text-sm"
                    >
                      暂无任务
                    </motion.div>
                  ) : (
                    tasksByStatus[column.id].map((task) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick(task)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </SortableContext>
            </KanbanColumn>
          ))}
        </AnimatePresence>
      </motion.div>

      <DragOverlay>
        {activeTask ? (
          <motion.div
            initial={{ rotate: 0, scale: 1 }}
            animate={{ rotate: 3, scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <KanbanCard task={activeTask} onClick={() => {}} isDragging />
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});
