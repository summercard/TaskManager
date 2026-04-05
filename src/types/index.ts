// 项目状态
export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'suspended';

// 任务状态
export type TaskStatus = 'todo' | 'in_progress' | 'done';

// 任务优先级
export type TaskPriority = 'low' | 'medium' | 'high';

// 任务评论
export interface TaskComment {
  id: string;
  taskId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 标签
export interface Tag {
  id: string;
  name: string;
  color: string;
}

// 项目目标
export interface ProjectGoal {
  targetCount: number;
  currentCount: number;
  description: string;
}

// 项目文件夹配置
export interface ProjectFolder {
  projectId: string;
  folderPath: string;
  stateFileName: string;
  lastSyncedAt: string;
}

// 项目
export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  goal?: ProjectGoal;
  path?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// 任务
export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

// 项目状态标签配置
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: '规划中',
  in_progress: '进行中',
  completed: '已完成',
  suspended: '已搁置',
};

// 任务状态标签配置
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待处理',
  in_progress: '进行中',
  done: '已完成',
};

// 任务优先级标签配置
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

// 任务优先级颜色配置
export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'text-green-500',
  medium: 'text-yellow-500',
  high: 'text-red-500',
};

// 默认标签颜色
export const DEFAULT_TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

// 项目状态标签配置 - 英文
export const PROJECT_STATUS_LABELS_EN: Record<ProjectStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  completed: 'Completed',
  suspended: 'Suspended',
};

// 任务状态标签配置 - 英文
export const TASK_STATUS_LABELS_EN: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

// 任务优先级标签配置 - 英文
export const TASK_PRIORITY_LABELS_EN: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
