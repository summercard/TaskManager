import { create } from 'zustand';
import type { Project, ProjectStatus } from '../types';
import { generateUUID, getCurrentTimestamp } from '../utils';
import { projectStorage } from '../utils/storage';

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;

  // CRUD 操作
  loadProjects: () => void;
  createProject: (name: string, description: string) => Project;
  updateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string | null) => void;

  // 归档操作
  archiveProject: (id: string) => void;
  unarchiveProject: (id: string) => void;
  getArchivedProjects: () => Project[];
  getActiveProjects: () => Project[];

  // 辅助方法
  getProjectById: (id: string) => Project | undefined;
  getProjectsByStatus: (status: ProjectStatus) => Project[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  isLoading: false,

  loadProjects: () => {
    set({ isLoading: true });
    const projects = projectStorage.getAll() as Project[];
    set({ projects, isLoading: false });
  },

  createProject: (name: string, description: string) => {
    const now = getCurrentTimestamp();
    const newProject: Project = {
      id: generateUUID(),
      name,
      description,
      status: 'planning',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    projectStorage.save(newProject);
    set((state) => ({ projects: [...state.projects, newProject] }));
    return newProject;
  },

  updateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
    const now = getCurrentTimestamp();
    projectStorage.update(id, { ...updates, updatedAt: now });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: now } : p
      ),
    }));
  },

  deleteProject: (id: string) => {
    projectStorage.delete(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
    }));
  },

  selectProject: (id: string | null) => {
    set({ selectedProjectId: id });
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
