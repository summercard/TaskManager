import { create } from 'zustand';
import type { Task, TaskStatus, TaskPriority, TaskComment } from '../types';
import { generateUUID, getCurrentTimestamp } from '../utils';
import { taskStorage, commentStorage } from '../utils/storage';

interface TaskState {
  tasks: Task[];
  comments: TaskComment[];
  isLoading: boolean;

  // CRUD 操作
  loadTasks: () => void;
  createTask: (projectId: string, title: string, description: string, dueDate?: string, priority?: TaskPriority, tags?: string[]) => Task;
  hydrateTask: (task: Task) => Task;
  replaceProjectSnapshot: (projectId: string, tasks: Task[], comments?: TaskComment[]) => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  deleteTask: (id: string) => void;
  deleteTasksByProject: (projectId: string) => void;

  // 辅助方法
  getTasksByProject: (projectId: string) => Task[];
  getTasksByStatus: (projectId: string, status: TaskStatus) => Task[];
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  updateTaskPriority: (id: string, priority: TaskPriority) => void;
  addTagToTask: (taskId: string, tagId: string) => void;
  removeTagFromTask: (taskId: string, tagId: string) => void;

  // 搜索和筛选
  searchTasks: (projectId: string, query: string) => Task[];
  filterTasks: (projectId: string, filters: TaskFilters) => Task[];

  // 评论
  loadComments: () => void;
  addComment: (taskId: string, content: string) => TaskComment;
  updateComment: (commentId: string, content: string) => void;
  deleteComment: (commentId: string) => void;
  getCommentsByTask: (taskId: string) => TaskComment[];

  // 统计
  getCompletedCount: (projectId: string) => number;
  getTotalCount: (projectId: string) => number;
  getTasksByPriority: (projectId: string, priority: TaskPriority) => Task[];
  getTasksByTag: (projectId: string, tagId: string) => Task[];
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  tags?: string[];
  searchQuery?: string;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  comments: [],
  isLoading: false,

  loadTasks: () => {
    set({ isLoading: true });
    const tasks = taskStorage.getAll() as Task[];
    set({ tasks, isLoading: false });
  },

  createTask: (projectId: string, title: string, description: string, dueDate?: string, priority: TaskPriority = 'medium', tags: string[] = []) => {
    const now = getCurrentTimestamp();
    const newTask: Task = {
      id: generateUUID(),
      projectId,
      title,
      description,
      status: 'todo',
      priority,
      tags,
      dueDate,
      createdAt: now,
      updatedAt: now,
    };
    taskStorage.save(newTask);
    set((state) => ({ tasks: [...state.tasks, newTask] }));
    return newTask;
  },

  hydrateTask: (task: Task) => {
    const existingTask = taskStorage.getById(task.id) as Task | undefined;

    if (existingTask) {
      taskStorage.update(task.id, task);
      set((state) => ({
        tasks: state.tasks.map((currentTask) =>
          currentTask.id === task.id ? task : currentTask
        ),
      }));
      return task;
    }

    taskStorage.save(task);
    set((state) => ({ tasks: [...state.tasks, task] }));
    return task;
  },

  replaceProjectSnapshot: (projectId: string, nextTasks: Task[], nextComments: TaskComment[] = []) => {
    const existingTasks = get().tasks.filter((task) => task.projectId === projectId);
    const existingTaskIds = new Set(existingTasks.map((task) => task.id));

    existingTasks.forEach((task) => taskStorage.delete(task.id));
    get().comments
      .filter((comment) => existingTaskIds.has(comment.taskId))
      .forEach((comment) => commentStorage.delete(comment.id));

    nextTasks.forEach((task) => taskStorage.save(task));
    nextComments.forEach((comment) => commentStorage.save(comment));

    set((state) => ({
      tasks: [
        ...state.tasks.filter((task) => task.projectId !== projectId),
        ...nextTasks,
      ],
      comments: [
        ...state.comments.filter((comment) => !existingTaskIds.has(comment.taskId)),
        ...nextComments,
      ],
    }));
  },

  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
    const now = getCurrentTimestamp();
    taskStorage.update(id, { ...updates, updatedAt: now });
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: now } : t
      ),
    }));
  },

  deleteTask: (id: string) => {
    taskStorage.delete(id);
    // 删除任务的所有评论
    const comments = get().comments.filter((c) => c.taskId !== id);
    set({ comments });
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
  },

  deleteTasksByProject: (projectId: string) => {
    const projectTasks = get().tasks.filter((t) => t.projectId === projectId);
    projectTasks.forEach((t) => {
      taskStorage.delete(t.id);
      // 删除任务的所有评论
      const taskComments = get().comments.filter((c) => c.taskId === t.id);
      taskComments.forEach((c) => commentStorage.delete(c.id));
    });
    set((state) => ({
      tasks: state.tasks.filter((t) => t.projectId !== projectId),
      comments: state.comments.filter((c) => {
        const task = state.tasks.find((t) => t.id === c.taskId);
        return task?.projectId !== projectId;
      }),
    }));
  },

  getTasksByProject: (projectId: string) => {
    return get().tasks.filter((t) => t.projectId === projectId);
  },

  getTasksByStatus: (projectId: string, status: TaskStatus) => {
    return get().tasks.filter((t) => t.projectId === projectId && t.status === status);
  },

  updateTaskStatus: (id: string, status: TaskStatus) => {
    get().updateTask(id, { status });
  },

  updateTaskPriority: (id: string, priority: TaskPriority) => {
    get().updateTask(id, { priority });
  },

  addTagToTask: (taskId: string, tagId: string) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (task && !task.tags.includes(tagId)) {
      get().updateTask(taskId, { tags: [...task.tags, tagId] });
    }
  },

  removeTagFromTask: (taskId: string, tagId: string) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (task) {
      get().updateTask(taskId, { tags: task.tags.filter((id) => id !== tagId) });
    }
  },

  searchTasks: (projectId: string, query: string) => {
    const lowerQuery = query.toLowerCase();
    return get().tasks.filter(
      (t) =>
        t.projectId === projectId &&
        (t.title.toLowerCase().includes(lowerQuery) ||
          t.description.toLowerCase().includes(lowerQuery))
    );
  },

  filterTasks: (projectId: string, filters: TaskFilters) => {
    return get().tasks.filter((t) => {
      if (t.projectId !== projectId) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.tags && filters.tags.length > 0) {
        if (!filters.tags.some((tag) => t.tags.includes(tag))) return false;
      }
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(query) && !t.description.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  },

  loadComments: () => {
    const comments = commentStorage.getAll() as TaskComment[];
    set({ comments });
  },

  addComment: (taskId: string, content: string) => {
    const now = getCurrentTimestamp();
    const newComment: TaskComment = {
      id: generateUUID(),
      taskId,
      content,
      createdAt: now,
      updatedAt: now,
    };
    commentStorage.save(newComment);
    set((state) => ({ comments: [...state.comments, newComment] }));
    return newComment;
  },

  updateComment: (commentId: string, content: string) => {
    const now = getCurrentTimestamp();
    commentStorage.update(commentId, { content, updatedAt: now });
    set((state) => ({
      comments: state.comments.map((c) =>
        c.id === commentId ? { ...c, content, updatedAt: now } : c
      ),
    }));
  },

  deleteComment: (commentId: string) => {
    commentStorage.delete(commentId);
    set((state) => ({
      comments: state.comments.filter((c) => c.id !== commentId),
    }));
  },

  getCommentsByTask: (taskId: string) => {
    return get().comments.filter((c) => c.taskId === taskId);
  },

  getCompletedCount: (projectId: string) => {
    return get().tasks.filter((t) => t.projectId === projectId && t.status === 'done').length;
  },

  getTotalCount: (projectId: string) => {
    return get().tasks.filter((t) => t.projectId === projectId).length;
  },

  getTasksByPriority: (projectId: string, priority: TaskPriority) => {
    return get().tasks.filter((t) => t.projectId === projectId && t.priority === priority);
  },

  getTasksByTag: (projectId: string, tagId: string) => {
    return get().tasks.filter((t) => t.projectId === projectId && t.tags.includes(tagId));
  },
}));
