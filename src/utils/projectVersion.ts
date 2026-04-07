import type {
  Project,
  ProjectDocumentStageStatus,
  ProjectTaskPreparationRecord,
  ProjectVersion,
  ProjectVersionDocument,
  Task,
} from '@/types';
import { generateUUID, getCurrentTimestamp } from '@/utils';
import { sortTasksByOrder } from './taskOrdering';

export interface VersionTargetSummary {
  documentId: string;
  documentTitle: string;
  stageId: string;
  stageTitle: string;
  stageSummary: string;
  status: ProjectDocumentStageStatus;
  isComplete: boolean;
}

export interface VersionStageOption {
  documentId: string;
  documentTitle: string;
  stageId: string;
  stageTitle: string;
  stageSummary: string;
}

interface CreateProjectVersionTemplateOptions {
  summary: string;
  goalDescription: string;
  customStageTitle: string;
  customStageSummary: string;
}

const DOCUMENT_TYPE_ORDER = {
  goal: 0,
  implementation: 1,
  spec: 2,
  note: 3,
} as const;

function slugify(value: string): string {
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

function normalizeVersion(version: string): { version: string; label: string } {
  const trimmed = version.trim();
  const withoutPrefix = trimmed.replace(/^v/i, '');

  return {
    version: withoutPrefix,
    label: `v${withoutPrefix}`,
  };
}

function createVersionDocuments(
  projectName: string,
  versionId: string,
  versionLabel: string,
  customStageTitle: string,
  customStageSummary: string,
  updatedAt: string
): ProjectVersionDocument[] {
  const versionSlug = slugify(versionLabel);
  const customStageSlug = slugify(customStageTitle || 'delivery-focus');

  return [
    {
      id: `${versionId}-goal-document`,
      versionId,
      title: `目标文档 ${versionLabel}`,
      type: 'goal',
      summary: `定义 ${projectName} ${versionLabel} 的目标范围、关键阶段和验收要求。`,
      path: `.task-manager/${versionSlug}/TargetDocument.md`,
      updatedAt,
      stages: [
        {
          id: `goal-${versionSlug}-scope`,
          title: '版本目标与范围',
          summary: `明确 ${versionLabel} 需要覆盖的业务边界与核心目标。`,
          status: 'todo',
        },
        {
          id: `goal-${versionSlug}-${customStageSlug}`,
          title: customStageTitle,
          summary: customStageSummary,
          status: 'todo',
        },
        {
          id: `goal-${versionSlug}-acceptance`,
          title: '版本验收与发布',
          summary: `整理 ${versionLabel} 的验收标准、交付物与发布条件。`,
          status: 'todo',
        },
      ],
    },
    {
      id: `${versionId}-implementation-document`,
      versionId,
      title: `施工文档 ${versionLabel}`,
      type: 'implementation',
      summary: `记录 ${projectName} ${versionLabel} 的施工步骤、代码落点与联调方案。`,
      path: `.task-manager/${versionSlug}/ImplementationDocument.md`,
      updatedAt,
      stages: [
        {
          id: `implementation-${versionSlug}-analysis`,
          title: '设计与拆解',
          summary: `拆分 ${versionLabel} 的模块、接口与开发顺序。`,
          status: 'todo',
        },
        {
          id: `implementation-${versionSlug}-${customStageSlug}`,
          title: `${customStageTitle} 开发`,
          summary: customStageSummary,
          status: 'todo',
        },
        {
          id: `implementation-${versionSlug}-release`,
          title: '联调与发布',
          summary: `完成 ${versionLabel} 的联调、回归与发布收口。`,
          status: 'todo',
        },
      ],
    },
  ];
}

function sortDocuments(version: ProjectVersion): ProjectVersion['documents'] {
  return [...version.documents].sort((left, right) => {
    const leftOrder = DOCUMENT_TYPE_ORDER[left.type] ?? 99;
    const rightOrder = DOCUMENT_TYPE_ORDER[right.type] ?? 99;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.title.localeCompare(right.title);
  });
}

export function getCurrentProjectVersion(project?: Project): ProjectVersion | undefined {
  if (!project?.versions || project.versions.length === 0) {
    return undefined;
  }

  return project.versions.find((version) => version.id === project.currentVersionId) ?? project.versions[0];
}

export function getProjectVersionById(project: Project | undefined, versionId?: string): ProjectVersion | undefined {
  if (!project?.versions || project.versions.length === 0) {
    return undefined;
  }

  if (!versionId) {
    return getCurrentProjectVersion(project);
  }

  return project.versions.find((version) => version.id === versionId);
}

export function getProjectVersionDocuments(project: Project | undefined, versionId?: string): ProjectVersionDocument[] {
  const version = getProjectVersionById(project, versionId);
  return version?.documents ?? [];
}

export function getVersionTasks(tasks: Task[], projectId: string, versionId?: string): Task[] {
  return sortTasksByOrder(tasks.filter((task) => {
    if (task.projectId !== projectId) {
      return false;
    }

    if (!versionId) {
      return true;
    }

    return task.versionId === versionId;
  }));
}

export function deriveStageStatus(
  tasks: Task[],
  fallbackStatus: ProjectDocumentStageStatus
): ProjectDocumentStageStatus {
  if (tasks.length === 0) {
    return fallbackStatus;
  }

  if (tasks.every((task) => task.status === 'done')) {
    return 'done';
  }

  if (tasks.some((task) => task.status === 'in_progress' || task.status === 'done')) {
    return 'in_progress';
  }

  return 'todo';
}

export function getCurrentVersionCompletionRate(project: Project | undefined, tasks: Task[]): number {
  if (!project) {
    return 0;
  }

  const version = getCurrentProjectVersion(project);
  const scopedTasks = getVersionTasks(tasks, project.id, version?.id);

  if (scopedTasks.length === 0) {
    return 0;
  }

  const doneCount = scopedTasks.filter((task) => task.status === 'done').length;
  return Math.round((doneCount / scopedTasks.length) * 100);
}

export function getNextVersionTarget(
  project: Project | undefined,
  tasks: Task[],
  versionId?: string
): VersionTargetSummary | undefined {
  if (!project) {
    return undefined;
  }

  const version = getProjectVersionById(project, versionId);
  if (!version) {
    return undefined;
  }

  const versionTasks = getVersionTasks(tasks, project.id, version.id);
  const stageEntries = sortDocuments(version).flatMap((document) =>
    document.stages.map((stage) => {
      const stageTasks = versionTasks.filter(
        (task) => task.documentId === document.id && task.documentStageId === stage.id
      );

      return {
        document,
        stage,
        status: deriveStageStatus(stageTasks, stage.status),
      };
    })
  );

  const activeStage =
    stageEntries.find((entry) => entry.status === 'in_progress') ??
    stageEntries.find((entry) => entry.status === 'todo');

  if (activeStage) {
    return {
      documentId: activeStage.document.id,
      documentTitle: activeStage.document.title,
      stageId: activeStage.stage.id,
      stageTitle: activeStage.stage.title,
      stageSummary: activeStage.stage.summary,
      status: activeStage.status,
      isComplete: false,
    };
  }

  const fallbackDocument = sortDocuments(version)[0];
  const fallbackStage = fallbackDocument?.stages[fallbackDocument.stages.length - 1];

  if (!fallbackDocument || !fallbackStage) {
    return undefined;
  }

  return {
    documentId: fallbackDocument.id,
    documentTitle: fallbackDocument.title,
    stageId: fallbackStage.id,
    stageTitle: fallbackStage.title,
    stageSummary: version.goal?.description ?? '当前版本目标已全部完成。',
    status: 'done',
    isComplete: true,
  };
}

export function getVersionStageOptions(version?: ProjectVersion): VersionStageOption[] {
  if (!version) {
    return [];
  }

  return sortDocuments(version).flatMap((document) =>
    document.stages.map((stage) => ({
      documentId: document.id,
      documentTitle: document.title,
      stageId: stage.id,
      stageTitle: stage.title,
      stageSummary: stage.summary,
    }))
  );
}

export function createProjectVersionTemplate(
  projectName: string,
  versionInput: string,
  options: CreateProjectVersionTemplateOptions
): ProjectVersion {
  const normalizedVersion = normalizeVersion(versionInput);
  const updatedAt = getCurrentTimestamp();
  const versionId = `${slugify(projectName)}-${slugify(normalizedVersion.version)}-${generateUUID().slice(0, 8)}`;
  const documents = createVersionDocuments(
    projectName,
    versionId,
    normalizedVersion.label,
    options.customStageTitle,
    options.customStageSummary,
    updatedAt
  );

  return {
    id: versionId,
    version: normalizedVersion.version,
    label: normalizedVersion.label,
    summary: options.summary,
    status: 'active',
    goal: {
      targetCount: 6,
      currentCount: 0,
      description: options.goalDescription,
    },
    documents,
    taskCreationRules: [
      '新增任务前，先补充当前版本的目标文档更新说明。',
      '新增任务前，先补充当前版本的施工文档更新说明。',
      '开发中如果触发自动接入，也必须明确任务归属阶段。',
    ],
    taskPreparationHistory: [],
    updatedAt,
  };
}

export function getLatestTaskPreparation(
  version?: ProjectVersion
): ProjectTaskPreparationRecord | undefined {
  if (!version?.taskPreparationHistory || version.taskPreparationHistory.length === 0) {
    return undefined;
  }

  return [...version.taskPreparationHistory].sort(
    (left, right) => new Date(right.preparedAt).valueOf() - new Date(left.preparedAt).valueOf()
  )[0];
}
