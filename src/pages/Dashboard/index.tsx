import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardTitle, Button } from '@/components/common';
import { useProjectStore } from '@/stores/projectStore';
import { useTaskStore } from '@/stores/taskStore';
import { useI18n } from '@/i18n';
import { TASK_STATUS_LABELS, TASK_STATUS_LABELS_EN, PROJECT_STATUS_LABELS, PROJECT_STATUS_LABELS_EN } from '@/types';
import { formatRelativeTime } from '@/utils';
import { StatsPanel } from '@/components/stats';
import dayjs from 'dayjs';

export function Dashboard() {
  const { t, language } = useI18n();
  const { projects, loadProjects } = useProjectStore();
  const { tasks, loadTasks } = useTaskStore();

  useEffect(() => {
    loadProjects();
    loadTasks();
  }, [loadProjects, loadTasks]);

  const activeProjects = useMemo(() => projects.filter(p => !p.isArchived), [projects]);

  const stats = useMemo(() => {
    const totalProjects = activeProjects.length;
    const inProgressProjects = activeProjects.filter((p) => p.status === 'in_progress').length;
    const completedProjects = activeProjects.filter((p) => p.status === 'completed').length;

    const overdueTasks = tasks.filter((t) => {
      if (!t.dueDate || t.status === 'done') return false;
      return dayjs(t.dueDate).isBefore(dayjs(), 'day');
    });

    const todayTasks = tasks.filter((t) => {
      if (!t.dueDate || t.status === 'done') return false;
      return dayjs(t.dueDate).isSame(dayjs(), 'day');
    });

    const taskStats = {
      total: tasks.length,
      todo: tasks.filter((t) => t.status === 'todo').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
    };

    const overallCompletionRate = taskStats.total > 0
      ? Math.round((taskStats.done / taskStats.total) * 100)
      : 0;

    return {
      totalProjects,
      inProgressProjects,
      completedProjects,
      overdueTasks,
      todayTasks,
      taskStats,
      overallCompletionRate,
    };
  }, [activeProjects, tasks]);

  const getProjectProgress = (projectId: string) => {
    const projectTasks = tasks.filter((t) => t.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    const completed = projectTasks.filter((t) => t.status === 'done').length;
    return Math.round((completed / projectTasks.length) * 100);
  };

  const getNextTask = (projectId: string) => {
    // 获取该项目的所有未完成任务
    const projectTasks = tasks
      .filter((t) => t.projectId === projectId && t.status !== 'done')
      .sort((a, b) => {
        // 按优先级排序
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority || 'medium'] || 2;
        const bPriority = priorityOrder[b.priority || 'medium'] || 2;
        
        // 如果优先级相同，按截止日期排序
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        // 优先级相同，比较截止日期
        if (a.dueDate && b.dueDate) {
          return dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf();
        }
        
        // 只有一个有截止日期，有截止日期的在前
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        
        // 都没有截止日期，按创建时间排序
        return dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf();
      });

    return projectTasks[0]; // 返回第一个（下一个待办）
  };

  const getStatusLabel = (status: string) => {
    const labels = language === 'zh' ? PROJECT_STATUS_LABELS : PROJECT_STATUS_LABELS_EN;
    return labels[status as keyof typeof labels] || status;
  };

  const getTaskStatusLabel = (status: string) => {
    const labels = language === 'zh' ? TASK_STATUS_LABELS : TASK_STATUS_LABELS_EN;
    return labels[status as keyof typeof labels] || status;
  };

  const getPriorityColor = (priority: string | undefined) => {
    const colors = {
      high: 'text-red-600 bg-red-50',
      medium: 'text-yellow-600 bg-yellow-50',
      low: 'text-green-600 bg-green-50',
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  return (
    <div className="space-y-6">
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.dashboard}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t.projects}</p>
        </div>
        <Link to="/projects">
          <Button>{t.createProject}</Button>
        </Link>
      </motion.div>

      {/* 全局统计面板 */}
      <StatsPanel showOverview />

      {/* 快捷统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="text-center">
            <CardTitle className="text-sm">{t.projects}</CardTitle>
            <p className="text-2xl md:text-3xl font-bold text-blue-600 mt-2">{stats.totalProjects}</p>
            <div className="flex justify-center gap-2 md:gap-3 mt-2 text-xs">
              <span className="text-gray-500">{getStatusLabel('in_progress')}: {stats.inProgressProjects}</span>
              <span className="text-green-600">{getStatusLabel('completed')}: {stats.completedProjects}</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="text-center">
            <CardTitle className="text-sm">{t.totalTasks}</CardTitle>
            <p className="text-2xl md:text-3xl font-bold text-purple-600 mt-2">{stats.taskStats.total}</p>
            <div className="flex justify-center gap-1 md:gap-2 mt-2 text-xs flex-wrap">
              <span className="text-blue-500">{getTaskStatusLabel('todo')}: {stats.taskStats.todo}</span>
              <span className="text-yellow-500">{getTaskStatusLabel('in_progress')}: {stats.taskStats.inProgress}</span>
              <span className="text-green-500">{getTaskStatusLabel('done')}: {stats.taskStats.done}</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="text-center">
            <CardTitle className="text-sm">{t.overdue}</CardTitle>
            <p className={`text-2xl md:text-3xl font-bold mt-2 ${stats.overdueTasks.length > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
              {stats.overdueTasks.length}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {stats.overdueTasks.length > 0 ? (language === 'zh' ? '需要尽快处理' : 'Needs attention') : (language === 'zh' ? '无逾期任务' : 'No overdue tasks')}
            </p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="text-center">
            <CardTitle className="text-sm">{t.dueToday}</CardTitle>
            <p className={`text-2xl md:text-3xl font-bold mt-2 ${stats.todayTasks.length > 0 ? 'text-orange-600' : 'text-gray-900 dark:text-gray-100'}`}>
              {stats.todayTasks.length}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {stats.todayTasks.length > 0 ? (language === 'zh' ? '今日需完成任务' : 'Due today') : (language === 'zh' ? '今日无到期任务' : 'No tasks due today')}
            </p>
          </Card>
        </motion.div>
      </div>

      {/* 任务状态分布图 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardTitle>{language === 'zh' ? '任务状态分布' : 'Task Status Distribution'}</CardTitle>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 py-6">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {stats.taskStats.total > 0 ? (
                    <>
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="3"
                        strokeDasharray={`${(stats.taskStats.todo / stats.taskStats.total) * 100} ${100 - (stats.taskStats.todo / stats.taskStats.total) * 100}`}
                        strokeDashoffset="0"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="#eab308"
                        strokeWidth="3"
                        strokeDasharray={`${(stats.taskStats.inProgress / stats.taskStats.total) * 100} ${100 - (stats.taskStats.inProgress / stats.taskStats.total) * 100}`}
                        strokeDashoffset={`${-(stats.taskStats.todo / stats.taskStats.total) * 100}`}
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="3"
                        strokeDasharray={`${(stats.taskStats.done / stats.taskStats.total) * 100} ${100 - (stats.taskStats.done / stats.taskStats.total) * 100}`}
                        strokeDashoffset={`${-((stats.taskStats.todo + stats.taskStats.inProgress) / stats.taskStats.total) * 100}`}
                      />
                    </>
                  ) : (
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="3"
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.overallCompletionRate}%</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{getTaskStatusLabel('todo')}: {stats.taskStats.todo}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{getTaskStatusLabel('in_progress')}: {stats.taskStats.inProgress}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{getTaskStatusLabel('done')}: {stats.taskStats.done}</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card>
            <CardTitle>{language === 'zh' ? '项目概览' : 'Project Overview'}</CardTitle>
            <div className="space-y-4 py-2">
              {activeProjects.length === 0 ? (
                <p className="text-gray-500 text-center py-4">{t.noProjects}</p>
              ) : (
                activeProjects.slice(0, 5).map((project) => {
                  const progress = getProjectProgress(project.id);
                  const taskCount = tasks.filter((t) => t.projectId === project.id).length;
                  const nextTask = getNextTask(project.id);
                  return (
                    <div key={project.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{project.name}</span>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            project.status === 'completed'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : project.status === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {getStatusLabel(project.status)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${
                              project.status === 'completed'
                                ? 'bg-green-500'
                                : project.status === 'in_progress'
                                  ? 'bg-yellow-500'
                                  : 'bg-blue-500'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {taskCount} {language === 'zh' ? '任务' : 'tasks'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* 最近项目 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{language === 'zh' ? '最近项目' : 'Recent Projects'}</h2>
          <Link to="/projects" className="text-sm text-blue-600 hover:text-blue-700">
            {language === 'zh' ? '查看全部 →' : 'View all →'}
          </Link>
        </div>
        {activeProjects.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-gray-500">{t.noProjects}</p>
            <Link to="/projects" className="mt-3 inline-block">
              <Button variant="secondary" size="sm">
                {t.createProject}
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeProjects.slice(0, 6).map((project, index) => {
              const progress = getProjectProgress(project.id);
              const taskCount = tasks.filter((t) => t.projectId === project.id).length;
              const nextTask = getNextTask(project.id);

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <Link to={`/projects/${project.id}`}>
                    <Card hover className="h-full">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{project.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {project.description || t.noData}
                          </p>
                        </div>
                        <span
                          className={`
                            px-2 py-1 text-xs rounded-full shrink-0
                            ${
                              project.status === 'completed'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : project.status === 'in_progress'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                  : project.status === 'suspended'
                                    ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            }
                          `}
                        >
                          {getStatusLabel(project.status)}
                        </span>
                      </div>

                      {/* 项目进度 */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-500 dark:text-gray-400">{language === 'zh' ? '进度' : 'Progress'}</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-blue-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                          />
                        </div>
                      </div>

                      {/* 任务数量 */}
                      <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <span>{taskCount} {language === 'zh' ? '个任务' : 'tasks'}</span>
                        <span>{formatRelativeTime(project.updatedAt)}</span>
                      </div>

                      {/* 目标进度 */}
                      {project.goal && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-400">{t.projectGoal}</span>
                            <span className="text-blue-600 font-medium">
                              {project.goal.currentCount}/{project.goal.targetCount}
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
                              style={{ width: `${Math.min(100, (project.goal.currentCount / project.goal.targetCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 下一个待办事项 */}
                      {nextTask && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-start gap-2">
                            <div className={`flex-shrink-0 mt-0.5 ${getPriorityColor(nextTask.priority)}`}>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000-16zm1-13a1 1 0 10-2 1 1 0 102 2zm0-4a1 1 0 10-2 1 1 0 102 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-400 mb-1">
                                {language === 'zh' ? '下一个待办' : 'Next task'}
                              </p>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {nextTask.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {nextTask.dueDate && (
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    dayjs(nextTask.dueDate).isBefore(dayjs(), 'day') && nextTask.status !== 'done'
                                      ? 'bg-red-100 text-red-700'
                                      : dayjs(nextTask.dueDate).isSame(dayjs(), 'day')
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {dayjs(nextTask.dueDate).format('MM/DD')}
                                  </span>
                                )}
                                {nextTask.tags && nextTask.tags.length > 0 && (
                                  <div className="flex gap-1">
                                    {nextTask.tags.slice(0, 3).map(tag => (
                                      <span key={tag} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 如果没有待办事项 */}
                      {!nextTask && taskCount > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                          <p className="text-sm text-green-600 text-center">
                            {language === 'zh' ? '🎉 全部完成！' : '🎉 All done!'}
                          </p>
                        </div>
                      )}
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
