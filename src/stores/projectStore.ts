import { create } from 'zustand';
import type { Project, ProjectStatus } from '../types';
import { generateUUID, getCurrentTimestamp } from '../utils';
import { projectIndexStorage, projectStorage, type ProjectIndexRecord } from '../utils/storage';

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;

  // CRUD 操作
  loadProjects: () => void;
  createProject: (name: string, description: string, options?: { path?: string }) => Project;
  updateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string | null) => void;
  hydrateProject: (project: Project) => void;

  // 归档操作
  archiveProject: (id: string) => void;
  unarchiveProject: (id: string) => void;
  getArchivedProjects: () => Project[];
  getActiveProjects: () => Project[];

  // 辅助方法
  getProjectById: (id: string) => Project | undefined;
  getProjectsByStatus: (status: ProjectStatus) => Project[];
}

function toProjectIndex(project: Project): ProjectIndexRecord {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    goal: project.goal,
    path: project.path,
    workspaceId: project.workspaceId,
    currentVersionId: project.currentVersionId,
    tracking: project.tracking,
    isArchived: project.isArchived,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function fromProjectIndex(project: ProjectIndexRecord): Project {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status as ProjectStatus,
    goal: project.goal,
    path: project.path,
    workspaceId: project.workspaceId,
    currentVersionId: project.currentVersionId,
    tracking: project.tracking,
    isArchived: project.isArchived,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function persistProject(project: Project): void {
  const existingProject = projectStorage.getById(project.id) as Project | undefined;

  if (existingProject) {
    projectStorage.update(project.id, project);
    projectIndexStorage.update(project.id, toProjectIndex(project));
    return;
  }

  projectStorage.save(project);
  projectIndexStorage.save(toProjectIndex(project));
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  isLoading: false,

  loadProjects: () => {
    set({ isLoading: true });
    const cachedProjects = projectStorage.getAll() as Project[];
    const indexedProjects = (projectIndexStorage.getAll() as ProjectIndexRecord[]).map(fromProjectIndex);
    const projectMap = new Map<string, Project>();

    cachedProjects.forEach((project) => {
      projectMap.set(project.id, project);

      const existingIndex = projectIndexStorage.getById(project.id);
      if (existingIndex) {
        projectIndexStorage.update(project.id, toProjectIndex(project));
      } else {
        projectIndexStorage.save(toProjectIndex(project));
      }
    });

    indexedProjects.forEach((project) => {
      const cachedProject = projectMap.get(project.id);
      projectMap.set(
        project.id,
        cachedProject
          ? {
              ...cachedProject,
              ...project,
            }
          : project
      );
    });

    const projects = Array.from(projectMap.values());

    set({ projects, isLoading: false });
  },

  createProject: (name: string, description: string, options?: { path?: string }) => {
    const now = getCurrentTimestamp();
    const newProject: Project = {
      id: generateUUID(),
      name,
      description,
      status: 'planning',
      path: options?.path,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    persistProject(newProject);
    set((state) => ({ projects: [...state.projects, newProject] }));
    return newProject;
  },

  updateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
    const now = getCurrentTimestamp();
    const existingProject = get().projects.find((project) => project.id === id);
    if (!existingProject) {
      return;
    }

    const nextProject: Project = {
      ...existingProject,
      ...updates,
      updatedAt: now,
    };

    persistProject(nextProject);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: now } : p
      ),
    }));
  },

  deleteProject: (id: string) => {
    projectStorage.delete(id);
    projectIndexStorage.delete(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
    }));
  },

  selectProject: (id: string | null) => {
    set({ selectedProjectId: id });
  },

  hydrateProject: (project: Project) => {
    persistProject(project);
    set((state) => {
      const exists = state.projects.some((currentProject) => currentProject.id === project.id);

      return {
        projects: exists
          ? state.projects.map((currentProject) =>
              currentProject.id === project.id ? project : currentProject
            )
          : [...state.projects, project],
      };
    });
  },

  archiveProject: (id: string) => {
    get().updateProject(id, { isArchived: true, status: 'suspended' });
  },

  unarchiveProject: (id: string) => {
    get().updateProject(id, { isArchived: false });
  },

  getArchivedProjects: () => {
    return get().projects.filter((p) => p.isArchived);
  },

  getActiveProjects: () => {
    return get().projects.filter((p) => !p.isArchived);
  },

  getProjectById: (id: string) => {
    return get().projects.find((p) => p.id === id);
  },

  getProjectsByStatus: (status: ProjectStatus) => {
    return get().projects.filter((p) => p.status === status && !p.isArchived);
  },
}));
