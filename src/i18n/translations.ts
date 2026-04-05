export type Language = 'zh' | 'en';

export interface Translations {
  // 通用
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  create: string;
  search: string;
  filter: string;
  close: string;
  confirm: string;
  loading: string;
  noData: string;

  // 导航
  dashboard: string;
  projects: string;
  settings: string;

  // 导入导出
  import: string;
  export: string;
  tasks: string;

  // 项目
  projectName: string;
  projectDescription: string;
  projectStatus: string;
  projectGoal: string;
  createProject: string;
  editProject: string;
  deleteProject: string;
  deleteProjectConfirm: string;
  archiveProject: string;
  unarchiveProject: string;
  archivedProjects: string;
  noProjects: string;
  projectProgress: string;
  nextTask: string;
  nextTaskLabel: string;
  allDone: string;
  allTasksCompleted: string;

  // 任务
  taskTitle: string;
  taskDescription: string;
  taskStatus: string;
  taskPriority: string;
  taskDueDate: string;
  taskTags: string;
  taskComments: string;
  createTask: string;
  totalTasks: string;
  overdue: string;
  dueToday: string;

  // 标签
  tags: string;
  tagName: string;
  tagColor: string;
  createTag: string;
  noTags: string;

  // 设置
  theme: string;
  language: string;
  shortcuts: string;
}

export const zh: Translations = {
  // 通用
  save: '保存',
  cancel: '取消',
  delete: '删除',
  edit: '编辑',
  create: '创建',
  search: '搜索',
  filter: '筛选',
  close: '关闭',
  confirm: '确认',
  loading: '加载中...',
  noData: '暂无数据',

  // 导航
  dashboard: '仪表板',
  projects: '项目',
  settings: '设置',

  // 导入导出
  import: '导入',
  export: '导出',
  tasks: '任务',

  // 项目
  projectName: '项目名称',
  projectDescription: '项目描述',
  projectStatus: '项目状态',
  projectGoal: '项目目标',
  createProject: '创建项目',
  editProject: '编辑项目',
  deleteProject: '删除项目',
  deleteProjectConfirm: '确定要删除这个项目吗？此操作无法撤销。',
  archiveProject: '归档项目',
  unarchiveProject: '取消归档',
  archivedProjects: '归档项目',
  noProjects: '暂无项目',
  projectProgress: '进度',
  nextTask: '下一个待办',
  nextTaskLabel: '下一个任务',
  allDone: '全部完成',
  allTasksCompleted: '全部任务已完成',

  // 任务
  taskTitle: '任务标题',
  taskDescription: '任务描述',
  taskStatus: '任务状态',
  taskPriority: '优先级',
  taskDueDate: '截止日期',
  taskTags: '标签',
  taskComments: '评论',
  createTask: '创建任务',
  totalTasks: '总任务数',
  overdue: '逾期',
  dueToday: '今日到期',

  // 标签
  tags: '标签',
  tagName: '标签名称',
  tagColor: '标签颜色',
  createTag: '创建标签',
  noTags: '暂无标签',

  // 设置
  theme: '主题',
  language: '语言',
  shortcuts: '快捷键',
};

export const en: Translations = {
  // 通用
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  edit: 'Edit',
  create: 'Create',
  search: 'Search',
  filter: 'Filter',
  close: 'Close',
  confirm: 'Confirm',
  loading: 'Loading...',
  noData: 'No data available',

  // 导航
  dashboard: 'Dashboard',
  projects: 'Projects',
  settings: 'Settings',

  // 导入导出
  import: 'Import',
  export: 'Export',
  tasks: 'Tasks',

  // 项目
  projectName: 'Project Name',
  projectDescription: 'Project Description',
  projectStatus: 'Project Status',
  projectGoal: 'Project Goal',
  createProject: 'Create Project',
  editProject: 'Edit Project',
  deleteProject: 'Delete Project',
  deleteProjectConfirm: 'Are you sure you want to delete this project? This action cannot be undone.',
  archiveProject: 'Archive Project',
  unarchiveProject: 'Unarchive Project',
  archivedProjects: 'Archived Projects',
  noProjects: 'No projects',
  projectProgress: 'Progress',
  nextTask: 'Next task',
  nextTaskLabel: 'Next Task',
  allDone: 'All done',
  allTasksCompleted: 'All tasks completed',

  // 任务
  taskTitle: 'Task Title',
  taskDescription: 'Task Description',
  taskStatus: 'Task Status',
  taskPriority: 'Priority',
  taskDueDate: 'Due Date',
  taskTags: 'Tags',
  taskComments: 'Comments',
  createTask: 'Create Task',
  totalTasks: 'Total Tasks',
  overdue: 'Overdue',
  dueToday: 'Due Today',

  // 标签
  tags: 'Tags',
  tagName: 'Tag Name',
  tagColor: 'Tag Color',
  createTag: 'Create Tag',
  noTags: 'No tags',

  // 设置
  theme: 'Theme',
  language: 'Language',
  shortcuts: 'Shortcuts',
};

export const translations: Record<Language, Translations> = {
  zh,
  en,
};
