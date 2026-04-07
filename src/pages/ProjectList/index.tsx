import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Card, CardTitle, Input, Modal } from '@/components/common';
import { useFolderStore } from '@/stores/folderStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTaskStore } from '@/stores/taskStore';
import { useTagStore } from '@/stores/tagStore';
import { useI18n } from '@/i18n';
import type { Project, ProjectStatus } from '@/types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_LABELS_EN, DEFAULT_TAG_COLORS } from '@/types';
import {
  saveProjectDirectoryHandle,
  saveProjectRegistryEntry,
  removeProjectDirectoryHandle,
  removeProjectRegistryEntry,
} from '@/utils/directoryHandles';
import {
  getDirectoryHandlePath,
  type FileSystemDirectoryHandle,
  pickDirectory,
  verifyDirectoryPermission,
} from '@/utils/fileSystem';
import { syncProjectArchive } from '@/utils/projectArchive';
import { readProjectArchive } from '@/utils/projectArchive';
import { getCurrentProjectVersion, getCurrentVersionCompletionRate } from '@/utils/projectVersion';
import { sortTasksByOrder } from '@/utils/taskOrdering';
import { navigateToPath } from '@/utils/navigation';
import dayjs from 'dayjs';

export function ProjectList() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const {
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
    getArchivedProjects,
    getActiveProjects,
    hydrateProject,
  } = useProjectStore();
  const { tasks, loadTasks, deleteTasksByProject, replaceProjectSnapshot } = useTaskStore();
  const { tags, loadTags, createTag, deleteTag } = useTagStore();
  const { setProjectFolder, removeProjectFolder } = useFolderStore();

  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLORS[0]);
  const [selectedProjectFolderName, setSelectedProjectFolderName] = useState('');
  const [selectedProjectDirectoryHandle, setSelectedProjectDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [projectFolderError, setProjectFolderError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isImportingProject, setIsImportingProject] = useState(false);

  useEffect(() => {
    loadProjects();
    loadTasks();
    loadTags();
  }, [loadProjects, loadTasks, loadTags]);

  const activeProjects = getActiveProjects();
  const archivedProjects = getArchivedProjects();

  const filteredProjects = useMemo(() => {
    let result = showArchived ? archivedProjects : activeProjects;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      result = result.filter((p) => p.status === statusFilter);
    }

    return result;
  }, [showArchived, archivedProjects, activeProjects, searchQuery, statusFilter]);

  const resetProjectModal = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingProject(null);
    setNewProjectName('');
    setNewProjectDesc('');
    setSelectedProjectFolderName('');
    setSelectedProjectDirectoryHandle(null);
    setProjectFolderError(null);
  }, []);

  const handlePickProjectFolder = useCallback(async () => {
    setProjectFolderError(null);

    try {
      const handle = await pickDirectory();
      if (!handle) {
        return;
      }

      const hasPermission = await verifyDirectoryPermission(handle);
      if (!hasPermission) {
        setProjectFolderError('无法获取项目文件夹写入权限');
        return;
      }

      setSelectedProjectDirectoryHandle(handle);
      setSelectedProjectFolderName(handle.name);
    } catch (err) {
      setProjectFolderError((err as Error).message);
    }
  }, []);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    if (!selectedProjectDirectoryHandle) {
      setProjectFolderError('新项目需要先选择一个本地项目文件夹');
      return;
    }

    try {
      const project = createProject(newProjectName.trim(), newProjectDesc.trim(), {
        path: getDirectoryHandlePath(selectedProjectDirectoryHandle) ?? selectedProjectFolderName,
      });

      await saveProjectDirectoryHandle(project.id, selectedProjectDirectoryHandle);
      await saveProjectRegistryEntry(
        project.id,
        selectedProjectFolderName || selectedProjectDirectoryHandle.name,
        getDirectoryHandlePath(selectedProjectDirectoryHandle) ?? undefined
      );
      setProjectFolder(project.id, selectedProjectFolderName || selectedProjectDirectoryHandle.name, {
        folderPath: getDirectoryHandlePath(selectedProjectDirectoryHandle) ?? undefined,
      });
      await syncProjectArchive(selectedProjectDirectoryHandle, project, [], []);
      resetProjectModal();
    } catch (err) {
      setProjectFolderError((err as Error).message);
    }
  }, [
    createProject,
    newProjectDesc,
    newProjectName,
    resetProjectModal,
    selectedProjectDirectoryHandle,
    selectedProjectFolderName,
    setProjectFolder,
  ]);

  const handleUpdateProject = useCallback(() => {
    if (!editingProject || !newProjectName.trim()) return;
    updateProject(editingProject.id, {
      name: newProjectName.trim(),
      description: newProjectDesc.trim(),
    });
    setEditingProject(null);
    setNewProjectName('');
    setNewProjectDesc('');
  }, [editingProject, newProjectName, newProjectDesc, updateProject]);

  const handleDeleteProject = useCallback(() => {
    if (!projectToDelete) return;
    void removeProjectDirectoryHandle(projectToDelete.id);
    void removeProjectRegistryEntry(projectToDelete.id);
    removeProjectFolder(projectToDelete.id);
    deleteTasksByProject(projectToDelete.id);
    deleteProject(projectToDelete.id);
    setProjectToDelete(null);
  }, [projectToDelete, deleteProject, deleteTasksByProject, removeProjectFolder]);

  const handleCreateTag = useCallback(() => {
    if (!newTagName.trim()) return;
    createTag(newTagName.trim(), newTagColor);
    setNewTagName('');
    setNewTagColor(DEFAULT_TAG_COLORS[0]);
  }, [newTagName, newTagColor, createTag]);

  const handleImportExistingProject = useCallback(async () => {
    setImportMessage(null);
    setIsImportingProject(true);

    try {
      const handle = await pickDirectory();
      if (!handle) {
        return;
      }

      const hasPermission = await verifyDirectoryPermission(handle);
      if (!hasPermission) {
        throw new Error('无法获取项目文件夹写入权限');
      }

      const archive = await readProjectArchive(handle);
      if (!archive) {
        throw new Error('这个目录下没有可导入的 `.task-manager/project-archive.json`，请先确认它是已同步过的项目文件夹。');
      }

      const absolutePath = getDirectoryHandlePath(handle) ?? archive.project.path ?? handle.name;
      const importedProject: Project = {
        ...archive.project,
        path: absolutePath,
        tracking: archive.project.tracking
          ? {
              ...archive.project.tracking,
              childWorkspaceName: archive.project.tracking.childWorkspaceName || handle.name,
              childWorkspacePath: absolutePath,
            }
          : archive.project.tracking,
      };

      hydrateProject(importedProject);
      replaceProjectSnapshot(importedProject.id, archive.tasks, archive.comments);
      await saveProjectDirectoryHandle(importedProject.id, handle);
      await saveProjectRegistryEntry(importedProject.id, handle.name, absolutePath);
      setProjectFolder(importedProject.id, handle.name, {
        folderPath: absolutePath,
        syncStatus: 'synced',
        lastSyncedAt: archive.savedAt,
      });
      setImportMessage(`已导入项目：${importedProject.name}`);
    } catch (err) {
      setImportMessage((err as Error).message);
    } finally {
      setIsImportingProject(false);
    }
  }, [hydrateProject, replaceProjectSnapshot, setProjectFolder]);

  useEffect(() => {
    if (!importMessage) {
      return;
    }

    const timer = window.setTimeout(() => setImportMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [importMessage]);

  const getStatusLabel = (status: ProjectStatus) => {
    return language === 'zh'
      ? PROJECT_STATUS_LABELS[status]
      : PROJECT_STATUS_LABELS_EN[status];
  };

  const statusOptions: ProjectStatus[] = ['planning', 'in_progress', 'completed', 'suspended'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.projects}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {showArchived ? t.archivedProjects : t.projects}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIsTagModalOpen(true)}>
            {t.tags}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? t.projects : t.archivedProjects}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleImportExistingProject()}
            disabled={isImportingProject}
          >
            {language === 'zh' ? '关联已有项目' : 'Import Existing Project'}
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            {t.createProject}
          </Button>
        </div>
      </div>

      {importMessage && (
        <Card className="py-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">{importMessage}</p>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | '')}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">{t.filterByStatus}</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {getStatusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {/* Project Grid */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardTitle>{t.noProjects}</CardTitle>
          <p className="text-gray-500 mt-2">
            {showArchived ? t.noData : t.noProjects}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                {(() => {
                  const currentVersion = getCurrentProjectVersion(project);
                  const currentProgress = getCurrentVersionCompletionRate(project, tasks);
                  const scopedTasks = sortTasksByOrder(tasks.filter((task) =>
                    task.projectId === project.id &&
                    (project.currentVersionId ? task.versionId === project.currentVersionId : true)
                  ));
                  const currentTask =
                    scopedTasks.find((task) => task.status !== 'done') ??
                    scopedTasks[0];

                  return (
                    <Card
                      hover
                      padding="sm"
                      className="h-full flex flex-col"
                      onClick={() => navigateToPath(`/projects/${project.id}`, navigate)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {project.name}
                          </h3>
                          {currentVersion && (
                            <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-300">
                              {language === 'zh' ? '当前版本' : 'Current Version'}: {currentVersion.label}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            project.status === 'completed'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : project.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : project.status === 'suspended'
                              ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          }`}
                        >
                          {getStatusLabel(project.status)}
                        </span>
                      </div>
                      {project.description && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                          {project.description}
                        </p>
                      )}
                      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/80 p-2.5 dark:border-gray-700 dark:bg-gray-800/70">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>{language === 'zh' ? '当前进度' : 'Current Progress'}</span>
                          <span className="font-medium text-gray-700 dark:text-gray-200">
                            {currentProgress}%
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500"
                            style={{ width: `${Math.min(currentProgress, 100)}%` }}
                          />
                        </div>
                        <div className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {language === 'zh' ? '当前任务：' : 'Current Task: '}
                          </span>
                          <span className="font-medium">
                            {currentTask
                              ? currentTask.title
                              : (language === 'zh' ? '暂无任务' : 'No current task')}
                          </span>
                        </div>
                      </div>
                      <div className="mt-auto pt-3 flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          {dayjs(project.createdAt).format('YYYY-MM-DD')}
                        </span>
                        <div
                          className="flex gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {project.isArchived ? (
                            <button
                              onClick={() => unarchiveProject(project.id)}
                              className="text-xs text-blue-500 hover:text-blue-600"
                            >
                              {t.unarchiveProject}
                            </button>
                          ) : (
                            <button
                              onClick={() => archiveProject(project.id)}
                              className="text-xs text-gray-500 hover:text-gray-600"
                            >
                              {t.archiveProject}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingProject(project);
                              setNewProjectName(project.name);
                              setNewProjectDesc(project.description);
                              setIsCreateModalOpen(true);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-600 ml-2"
                          >
                            {t.edit}
                          </button>
                          <button
                            onClick={() => setProjectToDelete(project)}
                            className="text-xs text-red-500 hover:text-red-600 ml-2"
                          >
                            {t.delete}
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })()}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={resetProjectModal}
        title={editingProject ? t.editProject : t.createProject}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={resetProjectModal}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={() => void (editingProject ? handleUpdateProject() : handleCreateProject())}
            >
              {editingProject ? t.save : t.create}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.projectName} *
            </label>
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder={t.projectName}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.projectDescription}
            </label>
            <textarea
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              rows={3}
              placeholder={t.projectDescription}
            />
          </div>
          {!editingProject && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                项目文件夹 *
              </label>
              <div className="flex gap-2">
                <Input
                  value={selectedProjectFolderName}
                  readOnly
                  placeholder="选择这个项目自己的本地文件夹"
                  className="flex-1"
                />
                <Button variant="secondary" onClick={() => void handlePickProjectFolder()}>
                  {selectedProjectFolderName ? '重新选择' : '选择文件夹'}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                项目完整内容会写入这个文件夹下的 `.task-manager/project-archive.json`。
              </p>
              {projectFolderError && (
                <p className="text-sm text-red-500">{projectFolderError}</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        title={t.deleteProject}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setProjectToDelete(null)}>
              {t.cancel}
            </Button>
            <Button onClick={handleDeleteProject}>{t.delete}</Button>
          </div>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          {t.deleteProjectConfirm}
        </p>
      </Modal>

      {/* Tags Management Modal */}
      <Modal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title={t.tags}
        size="md"
      >
        <div className="space-y-4">
          {/* Existing tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-white text-sm"
                  style={{ backgroundColor: tag.color }}
                >
                  <span>{tag.name}</span>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="ml-1 hover:opacity-80"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {tags.length === 0 && (
            <p className="text-gray-400 text-sm">{t.noTags}</p>
          )}

          {/* Create new tag */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.createTag}
            </h4>
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder={t.tagName}
                className="flex-1"
              />
              <div className="flex gap-1">
                {DEFAULT_TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={`w-6 h-6 rounded-full ${
                      newTagColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleCreateTag} className="mt-2" size="sm">
              {t.createTag}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
