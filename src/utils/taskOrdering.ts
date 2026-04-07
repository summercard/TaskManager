import type { Task } from '@/types';

export function formatTaskOrder(orderIndex?: number): string | undefined {
  if (!Number.isFinite(orderIndex) || !orderIndex || orderIndex <= 0) {
    return undefined;
  }

  return String(orderIndex).padStart(2, '0');
}

export function compareTasksByOrder(left: Task, right: Task): number {
  const leftOrder = left.orderIndex ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.orderIndex ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  const leftCreatedAt = new Date(left.createdAt).valueOf();
  const rightCreatedAt = new Date(right.createdAt).valueOf();

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return left.title.localeCompare(right.title, 'zh-Hans-CN');
}

export function sortTasksByOrder(tasks: Task[]): Task[] {
  return [...tasks].sort(compareTasksByOrder);
}

export function getNextTaskOrderIndex(tasks: Task[]): number {
  return (
    tasks.reduce((maxOrder, task) => {
      if (!Number.isFinite(task.orderIndex) || !task.orderIndex) {
        return maxOrder;
      }

      return Math.max(maxOrder, task.orderIndex);
    }, 0) + 1
  );
}
