import type { Project, Task, TaskComment } from '@/types';
import {
  TASK_MANAGER_FOLDER_NAME,
  type FileSystemDirectoryHandle,
  syncTaskManagerWorkspaceFiles,
  writeProjectStateFile,
} from './fileSystem';
import { mergeArchiveTasksWithTaskFiles } from './taskManagerTaskFile';

export const PROJECT_ARCHIVE_FILE_NAME = 'project-archive.json';
const PROJECT_ARCHIVE_VERSION = '1.0';

export interface ProjectArchiveData {
  version: string;
  savedAt: string;
  project: Project;
  tasks: Task[];
  comments: TaskComment[];
}

async function writeTextFile(
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string,
  content: string
): Promise<void> {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function ensureTaskManagerDirectory(
  directoryHandle: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle> {
  return directoryHandle.getDirectoryHandle(TASK_MANAGER_FOLDER_NAME, { create: true });
}

export async function readProjectArchive(
  directoryHandle: FileSystemDirectoryHandle
): Promise<ProjectArchiveData | null> {
  try {
    const taskManagerDirectory = await directoryHandle.getDirectoryHandle(TASK_MANAGER_FOLDER_NAME);
    const fileHandle = await taskManagerDirectory.getFileHandle(PROJECT_ARCHIVE_FILE_NAME);
    const file = await fileHandle.getFile();
    const content = await file.text();
    const archive = JSON.parse(content) as ProjectArchiveData;

    return {
      ...archive,
      tasks: await mergeArchiveTasksWithTaskFiles(directoryHandle, archive.project, archive.tasks),
    };
  } catch (err) {
    if ((err as Error).name === 'NotFoundError') {
      return null;
    }
    throw err;
  }
}

export async function writeProjectArchive(
  directoryHandle: FileSystemDirectoryHandle,
  archive: ProjectArchiveData
): Promise<void> {
  const taskManagerDirectory = await ensureTaskManagerDirectory(directoryHandle);
  await writeTextFile(taskManagerDirectory, PROJECT_ARCHIVE_FILE_NAME, JSON.stringify(archive, null, 2));
}

export async function deleteProjectArchive(
  directoryHandle: FileSystemDirectoryHandle
): Promise<void> {
  try {
    const taskManagerDirectory = await directoryHandle.getDirectoryHandle(TASK_MANAGER_FOLDER_NAME);
    await taskManagerDirectory.removeEntry(PROJECT_ARCHIVE_FILE_NAME);
  } catch (err) {
    if ((err as Error).name !== 'NotFoundError') {
      throw err;
    }
  }
}

export async function syncProjectArchive(
  directoryHandle: FileSystemDirectoryHandle,
  project: Project,
  tasks: Task[],
  comments: TaskComment[] = []
): Promise<void> {
  const savedAt = new Date().toISOString();

  await syncTaskManagerWorkspaceFiles(directoryHandle, project, tasks);
  await writeProjectStateFile(directoryHandle, {
    version: project.currentVersionId ?? 'unversioned',
    projectId: project.id,
    projectName: project.name,
    projectStatus: project.status,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    })),
    goal: project.goal,
    lastSyncedAt: savedAt,
  });
  await writeProjectArchive(directoryHandle, {
    version: PROJECT_ARCHIVE_VERSION,
    savedAt,
    project,
    tasks,
    comments,
  });
}
