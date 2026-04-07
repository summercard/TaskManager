import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Card, CardTitle, Modal, Input } from '@/components/common';
import { useFolderStore } from '@/stores/folderStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTaskStore, type TaskFilters } from '@/stores/taskStore';
import { useTagStore } from '@/stores/tagStore';
import { useI18n } from '@/i18n';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_LABELS_EN,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_LABELS_EN,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskSourceType,
  type ProjectGoal,
  type ProjectTaskPreparationRecord,
} from '@/types';
import { KanbanBoard } from '@/components/kanban';
import { TaskModal } from '@/components/task';
import { GoalEditor } from '@/components/goal';
import { StatsPanel } from '@/components/stats';
import { FolderSync } from '@/components/folder';
import { ProjectWorkspacePanel } from '@/components/workspace';
import { generateUUID, getCurrentTimestamp } from '@/utils';
import { exportData, readImportFile, validateImportData } from '@/utils/importExport';
import { removeProjectDirectoryHandle, removeProjectRegistryEntry } from '@/utils/directoryHandles';
import {
  createProjectVersionTemplate,
  getCurrentProjectVersion,
  getLatestTaskPreparation,
  getNextVersionTarget,
  getProjectVersionById,
  getProjectVersionDocuments,
  getVersionStageOptions,
  getVersionTasks,
} from '@/utils/projectVersion';
import { formatTaskOrder, getNextTaskOrderIndex, sortTasksByOrder } from '@/utils/taskOrdering';
import { buildTaskTargetSummary } from '@/utils/taskStage';
import { isDesktopApp } from '@/utils/desktop';
import { navigateToPath } from '@/utils/navigation';
import dayjs from 'dayjs';

interface PendingTaskPreparation {
  versionId: string;
  documentId: string;
  documentStageId: string;
  targetSummary: string;
  record: ProjectTaskPreparationRecord;
}

type DevelopmentEventMode = 'start' | 'progress' | 'done';

export function ProjectDetail() {
  const isDesktop = isDesktopApp();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const { getProjectById, updateProject, deleteProject, loadProjects } = useProjectStore();
  const {
    getTasksByProject,
    createTask,
    hydrateTask,
    updateTask,
    deleteTask,
    deleteTasksByProject,
    filterTasks,
    loadTasks,
  } = useTaskStore();
  const { tags, getTagsByIds, loadTags } = useTagStore();
  const { removeProjectFolder } = useFolderStore();

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showTaskPreparationModal, setShowTaskPreparationModal] = useState(false);
  const [showDevelopmentEventModal, setShowDevelopmentEventModal] = useState(false);
  const [showMorePanel, setShowMorePanel] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [pendingTaskPreparation, setPendingTaskPreparation] = useState<PendingTaskPreparation | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [importError, setImportError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [goalUpdateNote, setGoalUpdateNote] = useState('');
  const [implementationUpdateNote, setImplementationUpdateNote] = useState('');
  const [selectedStageKey, setSelectedStageKey] = useState('');
  const [newVersionNumber, setNewVersionNumber] = useState('');
  const [newVersionSummary, setNewVersionSummary] = useState('');
  const [newVersionGoal, setNewVersionGoal] = useState('');
  const [newVersionStageTitle, setNewVersionStageTitle] = useState('');
  const [newVersionStageSummary, setNewVersionStageSummary] = useState('');
  const [developmentTitle, setDevelopmentTitle] = useState('');
  const [developmentSyncKey, setDevelopmentSyncKey] = useState('');
  const [developmentDescription, setDevelopmentDescription] = useState('');
  const [developmentPriority, setDevelopmentPriority] = useState<TaskPriority>('medium');
  const [developmentStageKey, setDevelopmentStageKey] = useState('');
  const [developmentMode, setDevelopmentMode] = useState<DevelopmentEventMode>('start');
  const [developmentProgress, setDevelopmentProgress] = useState(30);
  const [developmentGoalUpdateNote, setDevelopmentGoalUpdateNote] = useState('');
  const [developmentImplementationUpdateNote, setDevelopmentImplementationUpdateNote] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
    loadTasks();
    loadTags();
  }, [loadProjects, loadTasks, loadTags]);

  const project = id ? getProjectById(id) : undefined;
  const projectTasks = project ? getTasksByProject(project.id) : [];
  const fallbackVersionId = project?.currentVersionId ?? project?.versions?.[0]?.id ?? null;
  const hasSelectedVersion = selectedVersionId
    ? (project?.versions ?? []).some((version) => version.id === selectedVersionId)
    : false;
  const effectiveSelectedVersionId = hasSelectedVersion ? selectedVersionId : fallbackVersionId;
  const currentVersion =
    getProjectVersionById(project, effectiveSelectedVersionId ?? undefined) ??
    getCurrentProjectVersion(project);
  const activeVersionId = currentVersion?.id;
  const currentVersionTasks = project
    ? getVersionTasks(projectTasks, project.id, activeVersionId)
    : [];
  const currentVersionDocuments = getProjectVersionDocuments(project, activeVersionId);
  const goalDocument = currentVersionDocuments.find((document) => document.type === 'goal');
  const implementationDocument = currentVersionDocuments.find((document) => document.type === 'implementation');
  const currentVersionStageOptions = getVersionStageOptions(currentVersion);
  const nextVersionTarget = getNextVersionTarget(project, projectTasks, activeVersionId);
  const defaultStageKey = nextVersionTarget
    ? `${nextVersionTarget.documentId}::${nextVersionTarget.stageId}`
    : currentVersionStageOptions[0]
      ? `${currentVersionStageOptions[0].documentId}::${currentVersionStageOptions[0].stageId}`
      : '';
  const selectedStageOption = currentVersionStageOptions.find(
    (option) => `${option.documentId}::${option.stageId}` === selectedStageKey
  );
  const selectedDevelopmentStageOption = currentVersionStageOptions.find(
    (option) => `${option.documentId}::${option.stageId}` === developmentStageKey
  );
  const latestTaskPreparation = getLatestTaskPreparation(currentVersion);
  const taskCreationRules = currentVersion?.taskCreationRules?.length
    ? currentVersion.taskCreationRules
    : [
        '新增任务前，先补充当前版本的目标文档更新说明。',
        '新增任务前，先补充当前版本的施工文档更新说明。',
        '新增任务时，确认任务归属的文档阶段。',
      ];
  const requiresDocumentPreparation = true;
  const canPrepareTaskCreation = Boolean(
    currentVersion && goalDocument && implementationDocument && currentVersionStageOptions.length > 0
  );
  const taskCreationBlockedReason = !currentVersion
    ? '请先为项目初始化当前版本，再新增任务或接入开发事件。'
    : !goalDocument || !implementationDocument
      ? '当前版本缺少目标文档或施工文档，暂时不能新增任务。'
      : currentVersionStageOptions.length === 0
        ? '当前版本还没有可归属的文档阶段，暂时不能新增任务。'
        : '';
  const normalizedDevelopmentProgress =
    developmentMode === 'done'
      ? 100
      : developmentMode === 'start'
        ? Math.max(15, developmentProgress)
        : Math.max(1, Math.min(99, developmentProgress));
  const normalizedDevelopmentSyncKey = developmentSyncKey.trim();
  const potentialDevelopmentTask = currentVersionTasks.find((task) => {
    if (normalizedDevelopmentSyncKey && task.syncKey === normalizedDevelopmentSyncKey) {
      return true;
    }

    return (
      selectedDevelopmentStageOption &&
      task.documentStageId === selectedDevelopmentStageOption.stageId &&
      task.title.trim() === developmentTitle.trim()
    );
  });
  const currentVersionCompletedCount = currentVersionTasks.filter((task) => task.status === 'done').length;
  const currentVersionCompletionRate =
    currentVersionTasks.length === 0
      ? 0
      : Math.round((currentVersionCompletedCount / currentVersionTasks.length) * 100);

  // 筛选后的任务
  const filteredTasks = (() => {
    if (!id) return [];
    const scopedTasks = activeVersionId
      ? projectTasks.filter((task) => task.versionId === activeVersionId)
      : projectTasks;
    const filters: TaskFilters = {};
    if (statusFilter) filters.status = statusFilter;
    if (priorityFilter) filters.priority = priorityFilter;
    if (tagFilter.length > 0) filters.tags = tagFilter;
    if (searchQuery) filters.searchQuery = searchQuery;

    if (Object.keys(filters).length === 0) {
      return sortTasksByOrder(scopedTasks);
    }

    return sortTasksByOrder(
      filterTasks(id, filters).filter((task) =>
        activeVersionId ? task.versionId === activeVersionId : true
      )
    );
  })();

  useEffect(() => {
    if (!project && id) {
      navigateToPath('/projects', navigate);
    }
  }, [project, id, navigate]);

  const effectiveViewMode: 'kanban' | 'list' = isDesktop ? 'kanban' : viewMode;

  useEffect(() => {
    if (!project?.currentVersionId || !activeVersionId || project.currentVersionId !== activeVersionId || currentVersionTasks.length === 0) {
      return;
    }

    const nextStatus = currentVersionCompletionRate === 100 ? 'completed' : 'in_progress';
    const nextGoalCurrentCount = project.goal
      ? Math.min(project.goal.targetCount, currentVersionCompletedCount)
      : undefined;
    const versionLabel = project.tracking?.currentVersionLabel ?? project.currentVersionId;
    const nextTrackingStatusLabel =
      currentVersionCompletionRate === 100
        ? `${versionLabel} 已完成`
        : `${versionLabel} 开发中`;

    const shouldUpdate =
      project.status !== nextStatus ||
      (typeof nextGoalCurrentCount === 'number' && project.goal?.currentCount !== nextGoalCurrentCount) ||
      project.tracking?.progress !== currentVersionCompletionRate ||
      project.tracking?.statusLabel !== nextTrackingStatusLabel;

    if (!shouldUpdate) {
      return;
    }

    updateProject(project.id, {
      status: nextStatus,
      goal: project.goal
        ? {
            ...project.goal,
            currentCount: nextGoalCurrentCount ?? project.goal.currentCount,
          }
        : project.goal,
      tracking: project.tracking
        ? {
            ...project.tracking,
            progress: currentVersionCompletionRate,
            statusLabel: nextTrackingStatusLabel,
            lastUpdatedAt: new Date().toISOString(),
          }
        : project.tracking,
    });
  }, [
    activeVersionId,
    project,
    currentVersionTasks.length,
    currentVersionCompletedCount,
    currentVersionCompletionRate,
    updateProject,
  ]);

  const resetTaskPreparationForm = () => {
    setGoalUpdateNote('');
    setImplementationUpdateNote('');
    setSelectedStageKey(defaultStageKey);
  };

  const resetVersionForm = () => {
    setNewVersionNumber('');
    setNewVersionSummary('');
    setNewVersionGoal('');
    setNewVersionStageTitle('');
    setNewVersionStageSummary('');
  };

  const resetDevelopmentEventForm = () => {
    setDevelopmentTitle('');
    setDevelopmentSyncKey('');
    setDevelopmentDescription('');
    setDevelopmentPriority('medium');
    setDevelopmentStageKey(defaultStageKey);
    setDevelopmentMode('start');
    setDevelopmentProgress(30);
    setDevelopmentGoalUpdateNote('');
    setDevelopmentImplementationUpdateNote('');
  };

  const closeTaskPreparationModal = () => {
    setShowTaskPreparationModal(false);
    resetTaskPreparationForm();
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setPendingTaskPreparation(null);

    if (requiresDocumentPreparation) {
      if (!canPrepareTaskCreation) {
        return;
      }

      resetTaskPreparationForm();
      setShowTaskPreparationModal(true);
      return;
    }

    setShowTaskModal(true);
  };

  const handleOpenSearch = () => {
    searchInputRef.current?.focus();
  };

  const handleOpenVersionModal = () => {
    resetVersionForm();
    setShowVersionModal(true);
  };

  const handleSelectVersion = (versionId: string) => {
    setSelectedVersionId(versionId);
  };

  const handleOpenDevelopmentEventModal = () => {
    resetDevelopmentEventForm();
    setShowDevelopmentEventModal(true);
  };

  useKeyboardShortcuts([
    { key: 'n', ctrl: true, handler: handleNewTask },
    { key: 'f', ctrl: true, handler: handleOpenSearch },
  ]);

  const persistTaskPreparationRecord = (
    record: ProjectTaskPreparationRecord,
    targetStageTitle: string
  ) => {
    if (!project || !currentVersion) {
      return;
    }

    const preparedAt = record.preparedAt;
    const nextVersions = (project.versions ?? []).map((version) => {
      if (version.id !== record.versionId) {
        return version;
      }

      return {
        ...version,
        updatedAt: preparedAt,
        documents: version.documents.map((document) =>
          document.id === goalDocument?.id || document.id === implementationDocument?.id
            ? { ...document, updatedAt: preparedAt }
            : document
        ),
        taskPreparationHistory: [
          record,
          ...(version.taskPreparationHistory ?? []),
        ],
      };
    });

    updateProject(project.id, {
      versions: nextVersions,
      documents: project.documents?.map((document) =>
        document.id === goalDocument?.id || document.id === implementationDocument?.id
          ? { ...document, updatedAt: preparedAt }
          : document
      ),
      tracking: project.tracking
        ? {
            ...project.tracking,
            currentFocus: `新增任务前已更新文档，当前准备推进 ${targetStageTitle}`,
            lastUpdatedAt: preparedAt,
          }
        : project.tracking,
    });
  };

  const persistTaskPreparation = (preparation: PendingTaskPreparation) => {
    persistTaskPreparationRecord(preparation.record, preparation.record.targetStageTitle);
  };

  const handleCreateVersion = () => {
    if (
      !project ||
      !newVersionNumber.trim() ||
      !newVersionSummary.trim() ||
      !newVersionGoal.trim() ||
      !newVersionStageTitle.trim() ||
      !newVersionStageSummary.trim()
    ) {
      return;
    }

    const nextVersion = createProjectVersionTemplate(project.name, newVersionNumber, {
      summary: newVersionSummary.trim(),
      goalDescription: newVersionGoal.trim(),
      customStageTitle: newVersionStageTitle.trim(),
      customStageSummary: newVersionStageSummary.trim(),
    });

    updateProject(project.id, {
      status: 'planning',
      currentVersionId: nextVersion.id,
      versions: [...(project.versions ?? []), nextVersion],
      documents: nextVersion.documents.map((document) => ({
        id: document.id,
        title: document.title,
        type: document.type,
        summary: document.summary,
        path: document.path,
        updatedAt: document.updatedAt,
      })),
      goal: nextVersion.goal,
      tracking: {
        interfaceName: project.tracking?.interfaceName ?? '开发推进接口',
        currentVersionId: nextVersion.id,
        currentVersionLabel: nextVersion.label,
        statusLabel: `${nextVersion.label} 规划中`,
        progress: 0,
        currentFocus: `当前正在规划 ${nextVersion.label}，请先补齐文档与阶段，再接入开发事件。`,
        childWorkspaceName: project.tracking?.childWorkspaceName ?? project.name,
        childWorkspacePath: project.tracking?.childWorkspacePath ?? project.path,
        lastUpdatedAt: nextVersion.updatedAt,
      },
    });

    setSelectedVersionId(nextVersion.id);
    setShowVersionModal(false);
    resetVersionForm();
  };

  const handlePrepareTaskCreation = () => {
    if (
      !project ||
      !currentVersion ||
      !goalDocument ||
      !implementationDocument ||
      !selectedStageOption ||
      !goalUpdateNote.trim() ||
      !implementationUpdateNote.trim()
    ) {
      return;
    }

    const preparedAt = getCurrentTimestamp();
    const record: ProjectTaskPreparationRecord = {
      id: generateUUID(),
      versionId: currentVersion.id,
      targetDocumentId: selectedStageOption.documentId,
      targetDocumentTitle: selectedStageOption.documentTitle,
      targetStageId: selectedStageOption.stageId,
      targetStageTitle: selectedStageOption.stageTitle,
      goalUpdateNote: goalUpdateNote.trim(),
      implementationUpdateNote: implementationUpdateNote.trim(),
      preparedAt,
    };

    setPendingTaskPreparation({
      versionId: currentVersion.id,
      documentId: selectedStageOption.documentId,
      documentStageId: selectedStageOption.stageId,
      targetSummary:
        buildTaskTargetSummary(selectedStageOption.documentTitle, selectedStageOption.stageTitle) ??
        `${currentVersion.label} · ${selectedStageOption.stageTitle}`,
      record,
    });
    setShowTaskPreparationModal(false);
    setShowTaskModal(true);
  };

  const handleCreateTask = (data: {
    title: string;
    description: string;
    dueDate?: string;
    status: TaskStatus;
    priority: TaskPriority;
    tags: string[];
  }) => {
    if (!id) return;
    const nextOrderIndex = getNextTaskOrderIndex(currentVersionTasks);
    const newTask = createTask(id, data.title, data.description, data.dueDate, data.priority, data.tags);
    const nextProgress =
      data.status === 'done' ? 100 : data.status === 'in_progress' ? 20 : 0;

    updateTask(newTask.id, {
      orderIndex: nextOrderIndex,
      status: data.status,
      versionId: pendingTaskPreparation?.versionId ?? project?.currentVersionId,
      documentId: pendingTaskPreparation?.documentId,
      documentStageId: pendingTaskPreparation?.documentStageId,
      targetSummary: pendingTaskPreparation?.targetSummary,
      progress: nextProgress,
    });

    if (pendingTaskPreparation) {
      persistTaskPreparation(pendingTaskPreparation);
      setPendingTaskPreparation(null);
      resetTaskPreparationForm();
    }
  };

  const handleDevelopmentEventSubmit = () => {
    if (!project || !currentVersion || !selectedDevelopmentStageOption || !developmentTitle.trim()) {
      return;
    }

    const nextStatus: TaskStatus =
      developmentMode === 'done' || normalizedDevelopmentProgress >= 100
        ? 'done'
        : 'in_progress';
    const nextSyncKey =
      normalizedDevelopmentSyncKey ||
      `${currentVersion.id}:${selectedDevelopmentStageOption.stageId}:${developmentTitle.trim().toLowerCase()}`;
    const nextDescription = developmentDescription.trim();
    const nextTargetSummary =
      buildTaskTargetSummary(
        selectedDevelopmentStageOption.documentTitle,
        selectedDevelopmentStageOption.stageTitle
      ) ?? `${currentVersion.label} · ${selectedDevelopmentStageOption.stageTitle}`;
    const existingTask =
      currentVersionTasks.find((task) => task.syncKey === nextSyncKey) ??
      currentVersionTasks.find(
        (task) =>
          task.documentStageId === selectedDevelopmentStageOption.stageId &&
          task.title.trim() === developmentTitle.trim()
      );

    if (existingTask) {
      updateTask(existingTask.id, {
        title: developmentTitle.trim(),
        description: nextDescription || existingTask.description,
        priority: developmentPriority,
        documentId: selectedDevelopmentStageOption.documentId,
        documentStageId: selectedDevelopmentStageOption.stageId,
        versionId: currentVersion.id,
        progress: normalizedDevelopmentProgress,
        status: nextStatus,
        targetSummary: nextTargetSummary,
        syncKey: nextSyncKey,
        sourceType: 'development_event' as TaskSourceType,
      });
      setShowDevelopmentEventModal(false);
      resetDevelopmentEventForm();
      return;
    }

    if (!developmentGoalUpdateNote.trim() || !developmentImplementationUpdateNote.trim()) {
      return;
    }

    const preparedAt = getCurrentTimestamp();
    const record: ProjectTaskPreparationRecord = {
      id: generateUUID(),
      versionId: currentVersion.id,
      targetDocumentId: selectedDevelopmentStageOption.documentId,
      targetDocumentTitle: selectedDevelopmentStageOption.documentTitle,
      targetStageId: selectedDevelopmentStageOption.stageId,
      targetStageTitle: selectedDevelopmentStageOption.stageTitle,
      goalUpdateNote: developmentGoalUpdateNote.trim(),
      implementationUpdateNote: developmentImplementationUpdateNote.trim(),
      preparedAt,
    };

    const createdTask = createTask(
      project.id,
      developmentTitle.trim(),
      nextDescription || `通过开发事件自动接入，归属到 ${selectedDevelopmentStageOption.stageTitle}。`,
      undefined,
      developmentPriority,
      []
    );

    updateTask(createdTask.id, {
      orderIndex: getNextTaskOrderIndex(currentVersionTasks),
      versionId: currentVersion.id,
      documentId: selectedDevelopmentStageOption.documentId,
      documentStageId: selectedDevelopmentStageOption.stageId,
      progress: normalizedDevelopmentProgress,
      status: nextStatus,
      targetSummary: nextTargetSummary,
      syncKey: nextSyncKey,
      sourceType: 'development_event' as TaskSourceType,
    });

    persistTaskPreparationRecord(record, selectedDevelopmentStageOption.stageTitle);
    setShowDevelopmentEventModal(false);
    resetDevelopmentEventForm();
  };

  const handleUpdateTask = (data: {
    title: string;
    description: string;
    dueDate?: string;
    status: TaskStatus;
    priority: TaskPriority;
    tags: string[];
  }) => {
    if (!editingTask) return;
    const nextProgress =
      data.status === 'done'
        ? 100
        : data.status === 'in_progress'
          ? Math.max(editingTask.progress ?? 0, 20)
          : 0;
    updateTask(editingTask.id, {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      status: data.status,
      progress: nextProgress,
      priority: data.priority,
      tags: data.tags,
    });
    setEditingTask(null);
  };

  const handleDeleteTask = () => {
    if (!editingTask) return;
    deleteTask(editingTask.id);
    setEditingTask(null);
    setShowTaskModal(false);
  };

  const handleTaskStatusChange = (taskId: string, newStatus: TaskStatus) => {
    const targetTask = projectTasks.find((task) => task.id === taskId);
    const nextProgress =
      newStatus === 'done'
        ? 100
        : newStatus === 'in_progress'
          ? Math.max(targetTask?.progress ?? 0, 20)
          : 0;

    updateTask(taskId, {
      status: newStatus,
      progress: nextProgress,
    });
  };

  const handleTaskClick = (task: Task) => {
    setPendingTaskPreparation(null);
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const handleTaskModalClose = () => {
    setShowTaskModal(false);
    setEditingTask(null);

    if (!editingTask) {
      setPendingTaskPreparation(null);
      resetTaskPreparationForm();
    }
  };

  const handleSaveGoal = (goal: ProjectGoal) => {
    updateProject(project!.id, { goal });
  };

  const handleDeleteProject = () => {
    void removeProjectDirectoryHandle(project!.id);
    void removeProjectRegistryEntry(project!.id);
    removeProjectFolder(project!.id);
    deleteTasksByProject(project!.id);
    deleteProject(project!.id);
    navigateToPath('/projects', navigate);
  };

  const handleExport = () => {
    const currentProjectTasks = id ? getTasksByProject(id) : [];
    exportData(project ? [project] : [], currentProjectTasks);
  };

  const handleImport = async (file: File) => {
    setImportError(null);
    try {
      const data = await readImportFile(file);
      const validation = validateImportData(data);
      if (!validation.valid) {
        setImportError(validation.error || t.noData);
        return;
      }
      const projectTasksToImport = data.tasks.filter(t => t.projectId === id);
      projectTasksToImport.forEach(task => {
        hydrateTask(task);
      });
      setShowImportModal(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t.noData);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setTagFilter([]);
  };

  const toggleTagFilter = (tagId: string) => {
    setTagFilter(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const goalProgress = project?.goal
    ? Math.round((project.goal.currentCount / project.goal.targetCount) * 100)
    : 0;

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
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateToPath('/projects', navigate)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {project.description || t.noData}
            </p>
          </div>
        </div>

        {project.versions && project.versions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {project.versions.map((version) => (
              <button
                type="button"
                key={version.id}
                onClick={() => handleSelectVersion(version.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  version.id === activeVersionId
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800'
                }`}
              >
                {version.label}
              </button>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
                {t.import || '导入'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExport}>
                {t.export || '导出'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowGoalModal(true)}>
                {project.goal ? t.edit : t.create} {t.projectGoal}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleOpenVersionModal}>
                {project.versions?.length ? '新增版本' : '初始化版本'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenDevelopmentEventModal}
                disabled={!canPrepareTaskCreation}
              >
                开发接入
              </Button>
              <Button size="sm" onClick={handleNewTask} disabled={!canPrepareTaskCreation}>
                {t.createTask}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
                {t.deleteProject}
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {!currentVersion && (
        <Card className="border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/60 dark:bg-indigo-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-base">先初始化当前版本</CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                这个项目还没有版本工作台。先新增一个版本，系统会自动生成目标文档、施工文档和阶段模板，之后再新增任务或接入开发事件。
              </p>
            </div>
            <Button onClick={handleOpenVersionModal}>
              初始化版本
            </Button>
          </div>
        </Card>
      )}

      {currentVersion && (
        <ProjectWorkspacePanel
          project={project}
          tasks={projectTasks}
          activeVersionId={activeVersionId}
        />
      )}

      {currentVersion && (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {language === 'zh' ? `任务栏 · ${currentVersion.label}` : `Tasks · ${currentVersion.label}`}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {language === 'zh'
                    ? '下面保留任务的筛选、看板和列表能力。'
                    : 'Task filtering, kanban, and list views stay here.'}
                </p>
              </div>
              <Button size="sm" onClick={handleNewTask} disabled={!canPrepareTaskCreation}>
                {t.createTask}
              </Button>
            </div>

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

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-500">{t.filterByTags}:</span>
                {tags.map((tag) => (
                  <button
                    type="button"
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
              {!isDesktop && (
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    effectiveViewMode === 'list'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {language === 'zh' ? '列表' : 'List'}
                </button>
              )}
              {!isDesktop ? (
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    effectiveViewMode === 'kanban'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {language === 'zh' ? '看板' : 'Kanban'}
                </button>
              ) : (
                <span className="px-3 py-1 text-sm rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {language === 'zh' ? '三列看板' : '3-Column Kanban'}
                </span>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {effectiveViewMode === 'kanban' ? (
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
                        disabled={!canPrepareTaskCreation}
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
                                {formatTaskOrder(task.orderIndex) && (
                                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                    #{formatTaskOrder(task.orderIndex)}
                                  </span>
                                )}
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
                              {task.targetSummary && (
                                <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-300">
                                  对应阶段：{task.targetSummary}
                                </p>
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
        </>
      )}

      <Card className="overflow-hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-4 text-left"
          onClick={() => setShowMorePanel((current) => !current)}
        >
          <div>
            <CardTitle className="text-base">
              {language === 'zh' ? '更多信息与工具' : 'More Details & Tools'}
            </CardTitle>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {language === 'zh'
                ? '把不常看的模块收起来，需要时再展开。'
                : 'Keep secondary modules folded until you need them.'}
            </p>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {showMorePanel ? (language === 'zh' ? '收起' : 'Collapse') : (language === 'zh' ? '展开' : 'Expand')}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {showMorePanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-gray-100 px-4 py-4 dark:border-slate-700"
            >
              <div className="space-y-4">
                <FolderSync project={project} />

                {project.goal && (
                  <Card className="bg-gray-50/80 dark:bg-slate-900/50">
                    <CardTitle className="text-base">{project.goal.description}</CardTitle>
                    <div className="mt-3 flex items-center gap-4">
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
                  </Card>
                )}

                {currentVersion && (
                  <Card className="bg-amber-50/60 dark:bg-amber-950/20">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <CardTitle className="text-base">新增任务规范</CardTitle>
                        <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                          {taskCreationRules.map((rule) => (
                            <p key={rule}>• {rule}</p>
                          ))}
                        </div>
                        {taskCreationBlockedReason && (
                          <p className="mt-3 text-sm text-red-600 dark:text-red-300">
                            {taskCreationBlockedReason}
                          </p>
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">最近一次准备</CardTitle>
                        {latestTaskPreparation ? (
                          <div className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                            <p>{latestTaskPreparation.targetStageTitle}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {dayjs(latestTaskPreparation.preparedAt).format('YYYY-MM-DD HH:mm')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                              目标文档：{latestTaskPreparation.goalUpdateNote}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                              施工文档：{latestTaskPreparation.implementationUpdateNote}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                            还没有任务准备记录。
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {currentVersion && (
                  <Card className="bg-sky-50/60 dark:bg-sky-950/20">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <CardTitle className="text-base">开发接入接口</CardTitle>
                        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                          第一次上报会自动建任务，后续同一个接入键会继续推进同一任务。
                        </p>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200">
                        <p>{potentialDevelopmentTask ? '已识别现有任务' : '会自动创建新任务'}</p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {potentialDevelopmentTask
                            ? `匹配任务：${potentialDevelopmentTask.title}`
                            : `当前版本：${currentVersion.label}`}
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                <StatsPanel projectId={project.id} versionId={activeVersionId} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Modal
        isOpen={showVersionModal}
        onClose={() => {
          setShowVersionModal(false);
          resetVersionForm();
        }}
        title={project.versions?.length ? '新增版本' : '初始化项目版本'}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowVersionModal(false);
                resetVersionForm();
              }}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleCreateVersion}
              disabled={
                !newVersionNumber.trim() ||
                !newVersionSummary.trim() ||
                !newVersionGoal.trim() ||
                !newVersionStageTitle.trim() ||
                !newVersionStageSummary.trim()
              }
            >
              保存版本
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                版本号 *
              </label>
              <Input
                value={newVersionNumber}
                onChange={(e) => setNewVersionNumber(e.target.value)}
                placeholder="例如 1.2 / 2.0"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                新增阶段标题 *
              </label>
              <Input
                value={newVersionStageTitle}
                onChange={(e) => setNewVersionStageTitle(e.target.value)}
                placeholder="例如 接口联调 / 施工排程 / 权限重构"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              版本概述 *
            </label>
            <textarea
              value={newVersionSummary}
              onChange={(e) => setNewVersionSummary(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              rows={3}
              placeholder="说明这个新版本要解决什么问题、覆盖什么范围。"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              版本目标 *
            </label>
            <textarea
              value={newVersionGoal}
              onChange={(e) => setNewVersionGoal(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              rows={3}
              placeholder="说明这个版本最终想交付什么结果。"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              新阶段说明 *
            </label>
            <textarea
              value={newVersionStageSummary}
              onChange={(e) => setNewVersionStageSummary(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              rows={3}
              placeholder="说明这个新阶段的交付内容、边界和完成条件。"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDevelopmentEventModal}
        onClose={() => {
          setShowDevelopmentEventModal(false);
          resetDevelopmentEventForm();
        }}
        title="开发接入"
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDevelopmentEventModal(false);
                resetDevelopmentEventForm();
              }}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleDevelopmentEventSubmit}
              disabled={
                !developmentTitle.trim() ||
                !selectedDevelopmentStageOption ||
                (!potentialDevelopmentTask &&
                  (!developmentGoalUpdateNote.trim() || !developmentImplementationUpdateNote.trim()))
              }
            >
              {potentialDevelopmentTask ? '更新任务' : '自动创建并推进任务'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              用同一个接入键持续上报开发状态。第一次会自动创建任务，后续再上报时会直接更新同一任务。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                功能 / 接口名称 *
              </label>
              <Input
                value={developmentTitle}
                onChange={(e) => setDevelopmentTitle(e.target.value)}
                placeholder="例如 订单结算接口 / 神工排班页"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                接入键
              </label>
              <Input
                value={developmentSyncKey}
                onChange={(e) => setDevelopmentSyncKey(e.target.value)}
                placeholder="例如 api:order-settlement"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                归属阶段 *
              </label>
              <select
                value={developmentStageKey}
                onChange={(e) => setDevelopmentStageKey(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">请选择阶段</option>
                {currentVersionStageOptions.map((option) => (
                  <option
                    key={`${option.documentId}-${option.stageId}`}
                    value={`${option.documentId}::${option.stageId}`}
                  >
                    {option.documentTitle} / {option.stageTitle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                事件类型 *
              </label>
              <select
                value={developmentMode}
                onChange={(e) => setDevelopmentMode(e.target.value as DevelopmentEventMode)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="start">开始开发</option>
                <option value="progress">推进中</option>
                <option value="done">开发完成</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                优先级
              </label>
              <select
                value={developmentPriority}
                onChange={(e) => setDevelopmentPriority(e.target.value as TaskPriority)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>推进度</span>
              <span>{normalizedDevelopmentProgress}%</span>
            </div>
            <input
              type="range"
              min={developmentMode === 'start' ? 15 : 0}
              max={100}
              step={5}
              value={developmentMode === 'done' ? 100 : developmentProgress}
              disabled={developmentMode === 'done'}
              onChange={(e) => setDevelopmentProgress(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              开发说明
            </label>
            <textarea
              value={developmentDescription}
              onChange={(e) => setDevelopmentDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              rows={3}
              placeholder="说明当前开发动作，例如完成了接口、推进了联调、修复了什么阻塞。"
            />
          </div>

          {potentialDevelopmentTask ? (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
              已识别现有任务：{potentialDevelopmentTask.title}。本次提交会直接更新这个任务。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  目标文档更新说明 *
                </label>
                <textarea
                  value={developmentGoalUpdateNote}
                  onChange={(e) => setDevelopmentGoalUpdateNote(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  rows={3}
                  placeholder="首次自动创建任务时，这里说明目标文档补充了什么。"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  施工文档更新说明 *
                </label>
                <textarea
                  value={developmentImplementationUpdateNote}
                  onChange={(e) => setDevelopmentImplementationUpdateNote(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  rows={3}
                  placeholder="首次自动创建任务时，这里说明施工文档补充了什么。"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 任务编辑弹窗 */}
      <Modal
        isOpen={showTaskPreparationModal}
        onClose={closeTaskPreparationModal}
        title="先更新文档，再新增任务"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeTaskPreparationModal}>
              {t.cancel}
            </Button>
            <Button
              onClick={handlePrepareTaskCreation}
              disabled={
                !goalUpdateNote.trim() ||
                !implementationUpdateNote.trim() ||
                !selectedStageOption
              }
            >
              继续填写任务
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              当前准备为 {currentVersion?.label ?? '当前版本'} 新增任务。先补充两份文档的更新说明，再选择这次任务要归属的文档阶段。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {goalDocument?.title ?? '目标文档'} 更新说明 *
              </label>
              <textarea
                value={goalUpdateNote}
                onChange={(e) => setGoalUpdateNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                rows={4}
                placeholder="说明这次新增任务前，目标文档补充了什么目标、边界或验收要求。"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {implementationDocument?.title ?? '施工文档'} 更新说明 *
              </label>
              <textarea
                value={implementationUpdateNote}
                onChange={(e) => setImplementationUpdateNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                rows={4}
                placeholder="说明这次新增任务前，施工文档补充了什么施工步骤、代码落点或出口条件。"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              任务归属阶段 *
            </label>
            <select
              value={selectedStageKey}
              onChange={(e) => setSelectedStageKey(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">请选择一个文档阶段</option>
              {currentVersionStageOptions.map((option) => (
                <option
                  key={`${option.documentId}-${option.stageId}`}
                  value={`${option.documentId}::${option.stageId}`}
                >
                  {option.documentTitle} / {option.stageTitle}
                </option>
              ))}
            </select>
            {selectedStageOption && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {selectedStageOption.stageSummary}
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* 任务编辑弹窗 */}
      <TaskModal
        key={`${editingTask?.id ?? 'new'}-${showTaskModal ? 'open' : 'closed'}`}
        isOpen={showTaskModal}
        onClose={handleTaskModalClose}
        task={editingTask}
        projectId={project.id}
        onSave={editingTask ? handleUpdateTask : handleCreateTask}
        onDelete={editingTask ? handleDeleteTask : undefined}
      />

      {/* 目标编辑弹窗 */}
      <GoalEditor
        key={`${project.id}-${project.goal?.description ?? 'empty'}-${showGoalModal ? 'open' : 'closed'}`}
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
