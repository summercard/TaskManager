import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Card, CardTitle, Input, Modal } from '@/components/common';
import { useProjectStore } from '@/stores/projectStore';
import { useTaskStore } from '@/stores/taskStore';
import { useTagStore } from '@/stores/tagStore';
import { useI18n } from '@/i18n';
import type { Project, ProjectStatus } from '@/types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_LABELS_EN, DEFAULT_TAG_COLORS } from '@/types';
import dayjs from 'dayjs';

export function ProjectList() {
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const {
    projects,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
    getArchivedProjects,
    getActiveProjects,
  } = useProjectStore();
  const { loadTasks } = useTaskStore();
  const { tags, loadTags, createTag, deleteTag } = useTagStore();

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

  useEffect(() => {
    loadProjects();
    loadTasks();
    loadTags();
  }, [loadProjects, loadTasks, loadTags]);

  const activeProjects = useMemo(() => getActiveProjects(), [projects]);
  const archivedProjects = useMemo(() => getArchivedProjects(), [projects]);

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

  const handleCreateProject = useCallback(() => {
    if (!newProjectName.trim()) return;
    createProject(newProjectName.trim(), newProjectDesc.trim());
    setNewProjectName('');
    setNewProjectDesc('');
    setIsCreateModalOpen(false);
  }, [newProjectName, newProjectDesc, createProject]);

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
    deleteProject(projectToDelete.id);
    setProjectToDelete(null);
  }, [projectToDelete, deleteProject]);

  const handleCreateTag = useCallback(() => {
    if (!newTagName.trim()) return;
    createTag(newTagName.trim(), newTagColor);
    setNewTagName('');
    setNewTagColor(DEFAULT_TAG_COLORS[0]);
  }, [newTagName, newTagColor, createTag]);

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
          <Button onClick={() => setIsCreateModalOpen(true)}>
            {t.createProject}
          </Button>
        </div>
      </div>

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
                <Card
                  hover
                  className="h-full flex flex-col"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {project.name}
                    </h3>
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
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="mt-auto pt-4 flex items-center justify-between">
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
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingProject(null);
          setNewProjectName('');
          setNewProjectDesc('');
        }}
        title={editingProject ? t.editProject : t.createProject}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingProject(null);
              }}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={editingProject ? handleUpdateProject : handleCreateProject}
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
