import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Card, CardTitle, Modal, Input } from '@/components/common';
import { useProjectStore } from '@/stores/projectStore';
import { useTaskStore, type TaskFilters } from '@/stores/taskStore';
import { useTagStore } from '@/stores/tagStore';
import { useI18n } from '@/i18n';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_LABELS_EN,
  TASK_STATUS_LABELS,
  TASK_STATUS_LABELS_EN,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_LABELS_EN,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type ProjectGoal,
} from '@/types';
import { KanbanBoard } from '@/components/kanban';
import { TaskModal } from '@/components/task';
import { GoalEditor } from '@/components/goal';
import { StatsPanel } from '@/components/stats';
import { FolderSync } from '@/components/folder';
import { formatRelativeTime } from '@/utils';
import { exportData, readImportFile, validateImportData } from '@/utils/importExport';
import dayjs from 'dayjs';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const { getProjectById, updateProject, deleteProject } = useProjectStore();
  const { getTasksByProject, createTask, updateTask, deleteTask, updateTaskStatus, filterTasks } = useTaskStore();
  const { tags, getTagsByIds } = useTagStore();

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [importError, setImportError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const project = id ? getProjectById(id) : undefined;

  // 筛选后的任务
  const filteredTasks = useMemo(() => {
    if (!id) return [];
    const filters: TaskFilters = {};
    if (statusFilter) filters.status = statusFilter;
    if (priorityFilter) filters.priority = priorityFilter;
    if (tagFilter.length > 0) filters.tags = tagFilter;
    if (searchQuery) filters.searchQuery = searchQuery;

    if (Object.keys(filters).length === 0) {
      return getTasksByProject(id);
    }
    return filterTasks(id, filters);
  }, [id, getTasksByProject, filterTasks, statusFilter, priorityFilter, tagFilter, searchQuery]);

  useEffect(() => {
    if (!project && id) {
      navigate('/projects');
    }
  }, [project, id, navigate]);

  // 快捷键支持
  const handleNewTask = useCallback(() => {
    setEditingTask(null);
    setShowTaskModal(true);
  }, []);

  const handleOpenSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  useKeyboardShortcuts([
    { key: 'n', ctrl: true, handler: handleNewTask },
    { key: 'f', ctrl: true, handler: handleOpenSearch },
  ]);

  const handleCreateTask = useCallback((data: {
    title: string;
    description: string;
    dueDate?: string;
    status: TaskStatus;
    priority: TaskPriority;
    tags: string[];
  }) => {
    if (!id) return;
    createTask(id, data.title, data.description, data.dueDate, data.priority, data.tags);
    if (data.status !== 'todo') {
      const newTasks = getTasksByProject(id);
      const newTask = newTasks.find((t) => t.title === data.title && t.description === data.description);
      if (newTask) {
        updateTaskStatus(newTask.id, data.status);
      }
    }
  }, [id, createTask, getTasksByProject, updateTaskStatus]);

  const handleUpdateTask = useCallback((data: {
    title: string;
    description: string;
    dueDate?: string;
    status: TaskStatus;
    priority: TaskPriority;
    tags: string[];
  }) => {
    if (!editingTask) return;
    updateTask(editingTask.id, {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      status: data.status,
      priority: data.priority,
      tags: data.tags,
    });
    setEditingTask(null);
  }, [editingTask, updateTask]);

  const handleDeleteTask = useCallback(() => {
    if (!editingTask) return;
    deleteTask(editingTask.id);
    setEditingTask(null);
    setShowTaskModal(false);
  }, [editingTask, deleteTask]);

  const handleTaskStatusChange = useCallback((taskId: string, newStatus: TaskStatus) => {
    updateTaskStatus(taskId, newStatus);
  }, [updateTaskStatus]);

  const handleTaskClick = useCallback((task: Task) => {
    setEditingTask(task);
    setShowTaskModal(true);
  }, []);

  const handleSaveGoal = useCallback((goal: ProjectGoal) => {
    updateProject(project!.id, { goal });
  }, [project, updateProject]);

  const handleDeleteProject = useCallback(() => {
    deleteProject(project!.id);
    navigate('/projects');
  }, [project, deleteProject, navigate]);

  const handleExport = useCallback(() => {
    const currentProjectTasks = id ? getTasksByProject(id) : [];
    exportData(project ? [project] : [], currentProjectTasks);
  }, [project, id, getTasksByProject]);

  const handleImport = useCallback(async (file: File) => {
    setImportError(null);
    try {
      const data = await readImportFile(file);
      const validation = validateImportData(data);
      if (!validation.valid) {
        setImportError(validation.error || t.noData);
        return;
      }
      const projectTasksToImport = data.tasks.filter(t => t.projectId === id);
      const currentTasks = id ? getTasksByProject(id) : [];
      projectTasksToImport.forEach(task => {
        const existing = currentTasks.find(t => t.id === task.id);
        if (existing) {
          updateTask(task.id, task);
        } else {
          createTask(task.projectId, task.title, task.description, task.dueDate);
        }
      });
      setShowImportModal(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t.noData);
    }
  }, [id, getTasksByProject, createTask, updateTask, t]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setTagFilter([]);
  }, []);

  const toggleTagFilter = (tagId: string) => {
    setTagFilter(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const goalProgress = useMemo(() => {
    if (!project?.goal) return 0;
    return Math.round((project.goal.currentCount / project.goal.targetCount) * 100);
  }, [project?.goal]);

  const hasFilters = searchQuery || statusFilter || priorityFilter || tagFilter.length > 0;

  const getStatusLabel = (status: TaskStatus) => {
    return language === 'zh' ? TASK_STATUS_LABELS[status] : TASK_STATUS_LABELS_EN[status];
  };

  const getPriorityLabel = (priority: TaskPriority) => {
    return language === 'zh' ? TASK_PRIORITY_LABELS[priority] : TASK_PRIORITY_LABELS_EN[priority];
  };

  const statuses: TaskStatus[] = ['todo', 'in_progress', 'done'];
  const priorities: TaskPriority[] = ['low', 'medium', 'high'];

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 头部信息 */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={() => navigate('/projects')}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
            <span
              className={`
                px-2 py-1 text-xs rounded-full
                ${project.status === 'completed'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : project.status === 'in_progress'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                    : project.status === 'suspended'
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                }
              `}
            >
              {language === 'zh' ? PROJECT_STATUS_LABELS[project.status] : PROJECT_STATUS_LABELS_EN[project.status]}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm sm:text-base">{project.description || t.noData}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {t.updatedAt}: {formatRelativeTime(project.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
            {t.import || '导入'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            {t.export || '导出'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowGoalModal(true)}>
            {project.goal ? t.edit : t.create} {t.projectGoal}
          </Button>
          <Button size="sm" onClick={handleNewTask}>
            {t.createTask}
          </Button>
        </div>
      </motion.div>

      {/* 目标进度 */}
      <AnimatePresence>
        {project.goal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4">
                <div className="flex-1 w-full">
                  <CardTitle className="text-base">{project.goal.description}</CardTitle>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500 dark:text-gray-400">{t.projectProgress}</span>
                        <span className="font-medium">
                          {project.goal.currentCount} / {project.goal.targetCount}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, goalProgress)}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">{goalProgress}%</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 文件夹同步 */}
      <FolderSync project={project} />

      {/* 统计面板 */}
      <StatsPanel projectId={project.id} />

      {/* 搜索和筛选 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="">{t.filterByStatus}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{getStatusLabel(s)}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="">{t.filterByPriority}</option>
            {priorities.map((p) => (
              <option key={p} value={p}>{getPriorityLabel(p)}</option>
            ))}
          </select>
          {hasFilters && (
            <Button variant="secondary" size="sm" onClick={handleClearFilters}>
              {t.clearFilters}
            </Button>
          )}
        </div>

        {/* 标签筛选 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-500">{t.filterByTags}:</span>
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTagFilter(tag.id)}
                className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                  tagFilter.includes(tag.id)
                    ? 'text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                style={tagFilter.includes(tag.id) ? { backgroundColor: tag.color } : {}}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 视图切换 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t.tasks || '任务'}</h2>
          {hasFilters && (
            <span className="text-sm text-gray-500">
              ({filteredTasks.length} {t.totalTasks?.toLowerCase().includes('任务') ? '项' : ''})
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              viewMode === 'kanban'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {language === 'zh' ? '看板' : 'Kanban'}
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {language === 'zh' ? '列表' : 'List'}
          </button>
        </div>
      </div>

      {/* 任务列表 */}
      <AnimatePresence mode="wait">
        {viewMode === 'kanban' ? (
          <motion.div
            key="kanban"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <KanbanBoard
              tasks={filteredTasks}
              onTaskStatusChange={handleTaskStatusChange}
              onTaskClick={handleTaskClick}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {filteredTasks.length === 0 ? (
              <Card className="text-center py-8">
                <p className="text-gray-500">{hasFilters ? t.noResults : t.noTasks}</p>
                {!hasFilters && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={handleNewTask}
                  >
                    {t.createTask}
                  </Button>
                )}
              </Card>
            ) : (
              filteredTasks.map((task, index) => {
                const taskTags = getTagsByIds(task.tags);
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Card
                      hover
                      className="cursor-pointer"
                      onClick={() => handleTaskClick(task)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">{task.title}</h4>
                            <span
                              className={`
                                px-2 py-0.5 text-xs rounded-full
                                ${task.status === 'done'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : task.status === 'in_progress'
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                }
                              `}
                            >
                              {getStatusLabel(task.status)}
                            </span>
                            <span className={`text-xs ${
                              task.priority === 'high' ? 'text-red-500' :
                              task.priority === 'medium' ? 'text-yellow-500' : 'text-green-500'
                            }`}>
                              {getPriorityLabel(task.priority)}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{task.description}</p>
                          )}
                          {taskTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {taskTags.map((tag) => (
                                <span
                                  key={tag.id}
                                  className="px-2 py-0.5 rounded-full text-xs text-white"
                                  style={{ backgroundColor: tag.color }}
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {task.dueDate && (
                            <p className={`text-xs mt-1 ${
                              task.status !== 'done' && dayjs(task.dueDate).isBefore(dayjs(), 'day')
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-400 dark:text-gray-500'
                            }`}>
                              {t.dueDate}: {dayjs(task.dueDate).format('YYYY-MM-DD')}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 任务编辑弹窗 */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
        task={editingTask}
        projectId={project.id}
        onSave={editingTask ? handleUpdateTask : handleCreateTask}
        onDelete={editingTask ? handleDeleteTask : undefined}
      />

      {/* 目标编辑弹窗 */}
      <GoalEditor
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        goal={project.goal}
        onSave={handleSaveGoal}
      />

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t.deleteProject}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleDeleteProject}>{t.delete}</Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          {t.deleteProjectConfirm}
        </p>
      </Modal>

      {/* 导入弹窗 */}
      <Modal
        isOpen={showImportModal}
        onClose={() => { setShowImportModal(false); setImportError(null); }}
        title={t.import || '导入任务'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {language === 'zh' ? '选择要导入的 JSON 文件。文件应包含有效的任务数据。' : 'Select a JSON file to import. The file should contain valid task data.'}
          </p>
          <input
            type="file"
            accept=".json"
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
          {importError && (
            <p className="text-sm text-red-500">{importError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
