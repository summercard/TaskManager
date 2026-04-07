import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardTitle } from '@/components/common';
import { useTaskStore } from '@/stores/taskStore';
import { useProjectStore } from '@/stores/projectStore';
import dayjs from 'dayjs';
import { TASK_STATUS_LABELS } from '@/types';

interface StatsPanelProps {
  projectId?: string;
  versionId?: string;
  showOverview?: boolean;
}

export const StatsPanel = memo(function StatsPanel({ projectId, versionId, showOverview = false }: StatsPanelProps) {
  const tasks = useTaskStore((state) => state.tasks);
  const projects = useProjectStore((state) => state.projects);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (projectId && task.projectId !== projectId) return false;
      if (versionId && task.versionId !== versionId) return false;
      return true;
    });
  }, [tasks, projectId, versionId]);

  const stats = useMemo(() => {
    const totalTasks = filteredTasks.length;
    const todoTasks = filteredTasks.filter((t) => t.status === 'todo').length;
    const inProgressTasks = filteredTasks.filter((t) => t.status === 'in_progress').length;
    const completedTasks = filteredTasks.filter((t) => t.status === 'done').length;
    const completionRate = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;
    const overdueTasks = filteredTasks.filter((t) => {
      if (!t.dueDate || t.status === 'done') return false;
      return dayjs(t.dueDate).isBefore(dayjs(), 'day');
    }).length;
    const inProgressProjects = projects.filter((p) => p.status === 'in_progress').length;
    const projectsWithGoals = projects.filter((p) => p.goal).length;

    return {
      totalTasks,
      todoTasks,
      inProgressTasks,
      completedTasks,
      completionRate,
      overdueTasks,
      inProgressProjects,
      projectsWithGoals,
    };
  }, [filteredTasks, projects]);

  const projectsGoalProgress = useMemo(() => {
    if (stats.projectsWithGoals === 0) return 0;
    return Math.round(
      projects
        .filter((p) => p.goal)
        .reduce((acc, p) => {
          const projectTasks = tasks.filter((t) => t.projectId === p.id);
          const scopedTasks = p.currentVersionId
            ? projectTasks.filter((task) => task.versionId === p.currentVersionId)
            : projectTasks;
          if (scopedTasks.length === 0) return acc;
          const completed = scopedTasks.filter((t) => t.status === 'done').length;
          return acc + (completed / scopedTasks.length) * 100;
        }, 0) / stats.projectsWithGoals
    );
  }, [projects, tasks, stats.projectsWithGoals]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="text-center">
          <CardTitle className="text-sm">总任务</CardTitle>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalTasks}</p>
          <div className="flex justify-center gap-2 mt-2 text-xs">
            <span className="text-blue-500">{TASK_STATUS_LABELS.todo}: {stats.todoTasks}</span>
            <span className="text-yellow-500">{TASK_STATUS_LABELS.in_progress}: {stats.inProgressTasks}</span>
            <span className="text-green-500">{TASK_STATUS_LABELS.done}: {stats.completedTasks}</span>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <Card className="text-center">
          <CardTitle className="text-sm">完成率</CardTitle>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.completionRate}%</p>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden mx-auto w-3/4">
            <motion.div
              className="h-full bg-green-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${stats.completionRate}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
            />
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="text-center">
          <CardTitle className="text-sm">逾期任务</CardTitle>
          <p className={`text-2xl font-bold mt-1 ${stats.overdueTasks > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {stats.overdueTasks}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {stats.overdueTasks > 0 ? '需要处理' : '无逾期'}
          </p>
        </Card>
      </motion.div>

      {showOverview && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card className="text-center">
              <CardTitle className="text-sm">进行中项目</CardTitle>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.inProgressProjects}</p>
              <p className="text-xs text-gray-500 mt-2">
                {projects.length} 个项目中
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="text-center">
              <CardTitle className="text-sm">目标达成</CardTitle>
              <p className="text-2xl font-bold text-purple-600 mt-1">{projectsGoalProgress}%</p>
              <p className="text-xs text-gray-500 mt-2">
                {stats.projectsWithGoals} 个有目标项目
              </p>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
});
