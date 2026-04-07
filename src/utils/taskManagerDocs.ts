import type { Project, ProjectVersion, Task } from '@/types';
import { formatTaskOrder, sortTasksByOrder } from './taskOrdering';

function toFolderSegment(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (normalized) {
    return normalized;
  }

  const fallbackSlug = Array.from(value.trim())
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter((segment): segment is string => Boolean(segment))
    .join('-');

  return `id-${fallbackSlug || 'x'}`;
}

function getCurrentVersion(project: Project): ProjectVersion | undefined {
  if (!project.versions || project.versions.length === 0) {
    return undefined;
  }

  return project.versions.find((version) => version.id === project.currentVersionId) ?? project.versions[0];
}

function getVersionTasks(project: Project, tasks: Task[], versionId?: string): Task[] {
  return sortTasksByOrder(tasks.filter((task) => {
    if (task.projectId !== project.id) {
      return false;
    }

    if (!versionId) {
      return true;
    }

    return task.versionId === versionId;
  }));
}

export function getVersionFolderName(version: ProjectVersion): string {
  return toFolderSegment(version.label || version.version || version.id);
}

export function buildTaskManagerUsageGuide(project: Project): string {
  const currentVersion = getCurrentVersion(project);
  const currentVersionLabel = currentVersion?.label ?? '未初始化';
  const currentVersionSummary = currentVersion?.summary ?? '当前项目还没有初始化版本，请先在主端中创建版本。';

  return `# TaskManager Usage Guide

## Project

- Project Name: ${project.name}
- Current Version: ${currentVersionLabel}
- Status: ${project.status}

## How To Use

1. Open this project from the TaskManager main portal.
2. If the project has no current version, create one first.
3. Before creating a manual task, update the goal document and implementation document.
4. During development, prefer using the "development integration" entry to create or update tasks.
5. Reuse the same integration key for the same API, module, or feature so TaskManager updates the same task.
6. You can also add version tasks directly in the local \`Tasks.md\` file and sync them back into the portal.

## What Will Be Synced Here

- \`.task-manager/README.md\`
- \`.task-manager/<version>/TargetDocument.md\`
- \`.task-manager/<version>/ImplementationDocument.md\`
- \`.task-manager/<version>/Tasks.md\`
- \`.task-manager.json\`

## Current Version Focus

${currentVersionSummary}
`;
}

export function buildVersionGoalDocument(project: Project, version: ProjectVersion): string {
  const goalDocument = version.documents.find((document) => document.type === 'goal');
  const stages = goalDocument?.stages ?? [];

  return `# ${project.name} ${version.label} Target Document

## Version Summary

${version.summary}

## Version Goal

${version.goal?.description ?? 'No goal description yet.'}

## Stages

${stages.length === 0
    ? '- No stages defined yet.'
    : stages
        .map((stage) => `### ${stage.title}

- Status: ${stage.status}
- Summary: ${stage.summary}`)
        .join('\n\n')}
`;
}

export function buildVersionImplementationDocument(project: Project, version: ProjectVersion, tasks: Task[]): string {
  const implementationDocument = version.documents.find((document) => document.type === 'implementation');
  const stages = implementationDocument?.stages ?? [];
  const versionTasks = getVersionTasks(project, tasks, version.id);

  return `# ${project.name} ${version.label} Implementation Document

## Version Summary

${version.summary}

## Version Tasks

${versionTasks.length === 0
    ? '- No tasks have been connected to this version yet.'
    : versionTasks
        .map(
          (task) =>
            `- ${formatTaskOrder(task.orderIndex) ? `[${formatTaskOrder(task.orderIndex)}] ` : ''}${task.title} | status: ${task.status} | progress: ${task.progress ?? 0}%`
        )
        .join('\n')}

## Stages

${stages.length === 0
    ? '- No stages defined yet.'
    : stages
        .map((stage) => `### ${stage.title}

- Status: ${stage.status}
- Summary: ${stage.summary}`)
        .join('\n\n')}
`;
}
