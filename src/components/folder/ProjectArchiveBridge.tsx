import { useEffect, useRef, useState } from 'react';
import { useFolderStore } from '@/stores/folderStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTaskStore } from '@/stores/taskStore';
import {
  getProjectDirectoryHandle,
  getProjectRegistryEntries,
} from '@/utils/directoryHandles';
import { readProjectArchive, syncProjectArchive, type ProjectArchiveData } from '@/utils/projectArchive';

function getArchiveSignature(archive: ProjectArchiveData): string {
  return JSON.stringify({
    savedAt: archive.savedAt,
    projectUpdatedAt: archive.project.updatedAt,
    currentVersionId: archive.project.currentVersionId ?? null,
    versionCount: archive.project.versions?.length ?? 0,
    tasks: archive.tasks.map((task) => ({
      id: task.id,
      orderIndex: task.orderIndex ?? null,
      versionId: task.versionId ?? null,
      documentStageId: task.documentStageId ?? null,
      status: task.status,
      progress: task.progress ?? 0,
      updatedAt: task.updatedAt,
    })),
    comments: archive.comments.map((comment) => ({
      id: comment.id,
      updatedAt: comment.updatedAt,
    })),
  });
}

export function ProjectArchiveBridge() {
  const { configs, setProjectFolder, updateSyncStatus, updateLastSyncedAt } = useFolderStore();
  const { projects, hydrateProject } = useProjectStore();
  const { tasks, comments, replaceProjectSnapshot } = useTaskStore();

  const hydratedProjectsRef = useRef<Set<string>>(new Set());
  const lastHydratedSignatureRef = useRef<Record<string, string>>({});
  const lastPersistSignatureRef = useRef<Record<string, string>>({});
  const [hydrationReady, setHydrationReady] = useState<Record<string, boolean>>({});
  const [registryProjectIds, setRegistryProjectIds] = useState<string[]>([]);

  useEffect(() => {
    let isCancelled = false;

    const hydrateRegistryList = async () => {
      try {
        const registryEntries = await getProjectRegistryEntries();
        if (isCancelled) {
          return;
        }

        setRegistryProjectIds(registryEntries.map((entry) => entry.projectId));
        registryEntries.forEach((entry) => {
          const currentConfig = configs[entry.projectId];
          if (
            currentConfig &&
            currentConfig.folderName === entry.folderName &&
            currentConfig.folderPath === entry.folderPath
          ) {
            return;
          }

          setProjectFolder(entry.projectId, entry.folderName, {
            folderPath: entry.folderPath,
            syncStatus: currentConfig?.syncStatus ?? 'pending',
            lastSyncedAt: currentConfig?.lastSyncedAt ?? entry.updatedAt,
            errorMessage: currentConfig?.errorMessage,
          });
        });
      } catch {
        // If registry bootstrap fails we keep the current in-memory state.
      }
    };

    void hydrateRegistryList();

    return () => {
      isCancelled = true;
    };
  }, [configs, setProjectFolder]);

  useEffect(() => {
    let isCancelled = false;

    const hydrateLinkedProjects = async () => {
      const projectIds = registryProjectIds.length > 0 ? registryProjectIds : Object.keys(configs);

      for (const projectId of projectIds) {
        if (hydrationReady[projectId]) {
          continue;
        }

        try {
          const handle = await getProjectDirectoryHandle(projectId);
          if (!handle) {
            updateSyncStatus(projectId, 'pending', '未找到已保存的本地项目文件夹授权');
            if (!isCancelled) {
              setHydrationReady((current) => ({ ...current, [projectId]: true }));
            }
            continue;
          }

          const archive = await readProjectArchive(handle);
          if (!archive || isCancelled) {
            if (!isCancelled) {
              setHydrationReady((current) => ({ ...current, [projectId]: true }));
            }
            continue;
          }

          lastHydratedSignatureRef.current[projectId] = getArchiveSignature(archive);
          hydrateProject(archive.project);
          replaceProjectSnapshot(projectId, archive.tasks, archive.comments);
          updateSyncStatus(projectId, 'synced');
          updateLastSyncedAt(projectId);
          hydratedProjectsRef.current.add(projectId);
          setHydrationReady((current) => ({ ...current, [projectId]: true }));
        } catch (err) {
          if (!isCancelled) {
            updateSyncStatus(projectId, 'error', (err as Error).message);
            setHydrationReady((current) => ({ ...current, [projectId]: true }));
          }
        }
      }
    };

    void hydrateLinkedProjects();

    return () => {
      isCancelled = true;
    };
  }, [
    configs,
    hydrateProject,
    hydrationReady,
    registryProjectIds,
    replaceProjectSnapshot,
    updateLastSyncedAt,
    updateSyncStatus,
  ]);

  useEffect(() => {
    let isCancelled = false;

    const refreshLinkedProjects = async () => {
      const projectIds = registryProjectIds.length > 0 ? registryProjectIds : Object.keys(configs);

      for (const projectId of projectIds) {
        if (!hydrationReady[projectId]) {
          continue;
        }

        try {
          const handle = await getProjectDirectoryHandle(projectId);
          if (!handle) {
            continue;
          }

          const archive = await readProjectArchive(handle);
          if (!archive || isCancelled) {
            continue;
          }

          const archiveSignature = getArchiveSignature(archive);
          if (lastHydratedSignatureRef.current[projectId] === archiveSignature) {
            continue;
          }

          lastHydratedSignatureRef.current[projectId] = archiveSignature;
          hydrateProject(archive.project);
          replaceProjectSnapshot(projectId, archive.tasks, archive.comments);
          updateSyncStatus(projectId, 'synced');
          updateLastSyncedAt(projectId);
        } catch (err) {
          if (!isCancelled) {
            updateSyncStatus(projectId, 'error', (err as Error).message);
          }
        }
      }
    };

    const handleWindowFocus = () => {
      void refreshLinkedProjects();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshLinkedProjects();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshLinkedProjects();
      }
    }, 5000);

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void refreshLinkedProjects();

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    configs,
    hydrateProject,
    hydrationReady,
    registryProjectIds,
    replaceProjectSnapshot,
    updateLastSyncedAt,
    updateSyncStatus,
  ]);

  useEffect(() => {
    let isCancelled = false;

    const persistLinkedProjects = async () => {
      for (const project of projects) {
        const config = configs[project.id];
        if (!config) {
          continue;
        }

        if (!hydrationReady[project.id]) {
          continue;
        }

        const projectTasks = tasks.filter((task) => task.projectId === project.id);
        const projectTaskIds = new Set(projectTasks.map((task) => task.id));
        const projectComments = comments.filter((comment) => projectTaskIds.has(comment.taskId));
        const signature = JSON.stringify({
          updatedAt: project.updatedAt,
          taskCount: projectTasks.length,
          commentCount: projectComments.length,
          tasks: projectTasks.map((task) => ({
            id: task.id,
            updatedAt: task.updatedAt,
            status: task.status,
            progress: task.progress ?? 0,
          })),
          comments: projectComments.map((comment) => ({
            id: comment.id,
            updatedAt: comment.updatedAt,
          })),
        });

        if (lastPersistSignatureRef.current[project.id] === signature) {
          continue;
        }

        try {
          const handle = await getProjectDirectoryHandle(project.id);
          if (!handle) {
            updateSyncStatus(project.id, 'pending', '请重新关联项目文件夹以继续写入本地存档');
            continue;
          }

          await syncProjectArchive(handle, project, projectTasks, projectComments);
          if (isCancelled) {
            return;
          }

          lastPersistSignatureRef.current[project.id] = signature;
          updateSyncStatus(project.id, 'synced');
          updateLastSyncedAt(project.id);
        } catch (err) {
          if (!isCancelled) {
            updateSyncStatus(project.id, 'error', (err as Error).message);
          }
        }
      }
    };

    void persistLinkedProjects();

    return () => {
      isCancelled = true;
    };
  }, [comments, configs, hydrationReady, projects, tasks, updateLastSyncedAt, updateSyncStatus]);

  return null;
}
