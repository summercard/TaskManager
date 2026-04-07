import type { Project, ProjectVersion, Task, TaskPriority, TaskStatus } from '@/types';
import type { FileSystemDirectoryHandle } from './fileSystem';
import { generateUUID, getCurrentTimestamp } from './index';
import { buildTaskTargetSummary } from './taskStage';
import { getVersionFolderName } from './taskManagerDocs';
import { formatTaskOrder, getNextTaskOrderIndex, sortTasksByOrder } from './taskOrdering';

export const TASK_MANAGER_TASK_FILE_NAME = 'Tasks.md';

const TASK_TITLE_PREFIX = '## 任务：';
const TASK_TITLE_PLACEHOLDER = '请把这里改成任务标题';
const DEFAULT_SCOPE_HEADING = '## 默认归属';

interface TaskPlacement {
  documentId?: string;
  documentTitle?: string;
  stageId?: string;
  stageTitle?: string;
}

interface ParsedTaskDraft {
  title: string;
  orderIndex?: string;
  targetStageLabel?: string;
  syncKey?: string;
  status?: string;
  priority?: string;
  progress?: string;
  documentTitle?: string;
  stageTitle?: string;
  tags?: string;
  targetSummary?: string;
  description?: string;
}

function normalizeTaskStatus(value?: string): TaskStatus {
  switch ((value ?? '').trim().toLowerCase()) {
    case '进行中':
    case 'in progress':
    case 'in_progress':
      return 'in_progress';
    case '已完成':
    case 'done':
      return 'done';
    case '待处理':
    case 'todo':
    default:
      return 'todo';
  }
}

function normalizeTaskPriority(value?: string): TaskPriority {
  switch ((value ?? '').trim().toLowerCase()) {
    case '低':
    case 'low':
      return 'low';
    case '高':
    case 'high':
      return 'high';
    case '中':
    case 'medium':
    default:
      return 'medium';
  }
}

function clampProgress(value?: string, fallback = 0): number {
  const parsed = Number.parseInt((value ?? '').trim(), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, parsed));
}

function normalizeTaskOrder(value?: string, fallback?: number): number | undefined {
  if (!value && !fallback) {
    return undefined;
  }

  const parsed = Number.parseInt((value ?? '').trim(), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeSyncKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildDerivedSyncKey(version: ProjectVersion, title: string): string {
  return `${version.id}:${normalizeSyncKey(title)}`;
}

function getVersionTasks(project: Project, version: ProjectVersion, tasks: Task[]): Task[] {
  return tasks.filter((task) => task.projectId === project.id && task.versionId === version.id);
}

function getDefaultPlacement(version: ProjectVersion): TaskPlacement {
  const implementationDocument = version.documents.find((document) => document.type === 'implementation');
  const fallbackDocument = implementationDocument ?? version.documents[0];
  const preferredStage = implementationDocument?.stages[1] ?? implementationDocument?.stages[0] ?? fallbackDocument?.stages[0];

  return {
    documentId: fallbackDocument?.id,
    documentTitle: fallbackDocument?.title,
    stageId: preferredStage?.id,
    stageTitle: preferredStage?.title,
  };
}

function resolvePlacement(
  version: ProjectVersion,
  documentTitle?: string,
  stageTitle?: string,
  fallback?: TaskPlacement
): TaskPlacement {
  const normalizedDocumentTitle = (documentTitle ?? '').trim();
  const normalizedStageTitle = (stageTitle ?? '').trim();

  const matchedDocument = normalizedDocumentTitle
    ? version.documents.find(
        (document) =>
          document.title === normalizedDocumentTitle ||
          document.title.startsWith(normalizedDocumentTitle) ||
          document.type === normalizedDocumentTitle.toLowerCase()
      )
    : undefined;

  const document = matchedDocument ?? version.documents.find((item) => item.id === fallback?.documentId) ?? version.documents[0];
  const matchedStage = normalizedStageTitle
    ? document?.stages.find((stage) => stage.title === normalizedStageTitle) ??
      version.documents.flatMap((item) => item.stages).find((stage) => stage.title === normalizedStageTitle)
    : undefined;
  const stage = matchedStage ?? document?.stages.find((item) => item.id === fallback?.stageId) ?? document?.stages[0];

  return {
    documentId: document?.id,
    documentTitle: document?.title,
    stageId: stage?.id,
    stageTitle: stage?.title,
  };
}

function formatTaskBlock(version: ProjectVersion, task: Task, fallback: TaskPlacement): string {
  const placement = resolvePlacement(version, undefined, undefined, {
    documentId: task.documentId ?? fallback.documentId,
    stageId: task.documentStageId ?? fallback.stageId,
    documentTitle: fallback.documentTitle,
    stageTitle: fallback.stageTitle,
  });

  const lines = [
    `${TASK_TITLE_PREFIX}${task.title}`,
    `- 编号：${formatTaskOrder(task.orderIndex) ?? ''}`,
    `- 对应阶段：${buildTaskTargetSummary(placement.documentTitle, placement.stageTitle) ?? ''}`,
    `- 状态：${task.status}`,
    `- 优先级：${task.priority}`,
    `- 进度：${task.progress ?? 0}`,
    `- 文档：${placement.documentTitle ?? fallback.documentTitle ?? ''}`,
    `- 阶段：${placement.stageTitle ?? fallback.stageTitle ?? ''}`,
    `- 标签：${task.tags.join(', ')}`,
    `- 目标：${task.targetSummary ?? ''}`,
  ];

  if (task.syncKey) {
    lines.push(`- 任务键：${task.syncKey}`);
  }

  lines.push('- 描述：');

  const descriptionLines = (task.description || '请补充任务说明。')
    .split(/\r?\n/)
    .map((line) => `  ${line}`);

  return [...lines, ...descriptionLines].join('\n');
}

function parseLabelValue(line: string): { label: string; value: string } | null {
  const match = line.match(/^\s*-\s*([^：:]+)[：:]\s*(.*)$/);
  if (!match) {
    return null;
  }

  return {
    label: match[1].trim(),
    value: match[2].trim(),
  };
}

export function getVersionTaskFilePath(version: ProjectVersion): string {
  return `.task-manager/${getVersionFolderName(version)}/${TASK_MANAGER_TASK_FILE_NAME}`;
}

export function buildVersionTaskFile(project: Project, version: ProjectVersion, tasks: Task[]): string {
  const defaultPlacement = getDefaultPlacement(version);
  const versionTasks = sortTasksByOrder(getVersionTasks(project, version, tasks));
  const taskBlocks = versionTasks.length === 0
    ? `${TASK_TITLE_PREFIX}示例：补充 ${version.label} 的一个开发任务\n- 编号：01\n- 对应阶段：${buildTaskTargetSummary(defaultPlacement.documentTitle, defaultPlacement.stageTitle) ?? ''}\n- 状态：todo\n- 优先级：medium\n- 进度：0\n- 文档：${defaultPlacement.documentTitle ?? ''}\n- 阶段：${defaultPlacement.stageTitle ?? ''}\n- 标签：\n- 目标：先补一条任务，确认任务文件和网页端已经打通\n- 描述：\n  这里写任务说明，保存后在网页端刷新或执行“从文件夹恢复当前项目”即可看到。`
    : versionTasks.map((task) => formatTaskBlock(version, task, defaultPlacement)).join('\n\n');

  return `# ${project.name} ${version.label} 任务文件

> 这个文件里的每个 \`${TASK_TITLE_PREFIX}...\` 块，都会被网页端解析成任务。
> 新增任务时，复制下面的模板块并修改标题；如果你想让任务改名后仍然保持同一条记录，可以补一个唯一的“任务键”。
> 文档 / 阶段留空时，会自动归到默认归属。

## 使用说明

1. 每个任务都从 \`${TASK_TITLE_PREFIX}${TASK_TITLE_PLACEHOLDER}\` 这种标题开始。
2. 支持字段：编号、对应阶段、状态(todo / in_progress / done)、优先级(low / medium / high)、进度(0-100)。
3. 描述支持多行，写在 \`- 描述：\` 的下一行并保持两个空格缩进。
4. 每个任务都必须明确对应到某个文档阶段；建议同时填写“对应阶段”以及下面的“文档 / 阶段”字段。
5. 编号越小代表越先执行；如果不填编号，系统会按文件顺序自动补号。
6. 保存文件后，重新打开网页或执行一次“从文件夹恢复当前项目”，就会把新增任务读回网页端。

${DEFAULT_SCOPE_HEADING}
- 文档：${defaultPlacement.documentTitle ?? ''}
- 阶段：${defaultPlacement.stageTitle ?? ''}

## 新增任务模板
${TASK_TITLE_PREFIX}${TASK_TITLE_PLACEHOLDER}
- 编号：01
- 对应阶段：${buildTaskTargetSummary(defaultPlacement.documentTitle, defaultPlacement.stageTitle) ?? ''}
- 状态：todo
- 优先级：medium
- 进度：0
- 文档：${defaultPlacement.documentTitle ?? ''}
- 阶段：${defaultPlacement.stageTitle ?? ''}
- 标签：
- 目标：
- 任务键：
- 描述：
  在这里写任务说明。

## 当前任务
${taskBlocks}
`;
}

export function parseVersionTaskFile(
  content: string,
  project: Project,
  version: ProjectVersion,
  existingTasks: Task[]
): Task[] {
  const lines = content.split(/\r?\n/);
  const defaultPlacement = getDefaultPlacement(version);
  const resolvedDefaults: TaskPlacement = { ...defaultPlacement };
  const drafts: ParsedTaskDraft[] = [];

  let activeSection: 'default' | 'task' | 'other' = 'other';
  let currentTask: ParsedTaskDraft | null = null;
  let descriptionLines: string[] = [];
  let collectingDescription = false;

  const flushTask = () => {
    if (!currentTask) {
      return;
    }

    if (descriptionLines.length > 0) {
      currentTask.description = descriptionLines.join('\n').trim();
    }

    drafts.push(currentTask);
    currentTask = null;
    descriptionLines = [];
    collectingDescription = false;
  };

  for (const line of lines) {
    if (line.startsWith(DEFAULT_SCOPE_HEADING)) {
      flushTask();
      activeSection = 'default';
      continue;
    }

    if (line.startsWith(TASK_TITLE_PREFIX)) {
      flushTask();
      activeSection = 'task';
      currentTask = { title: line.slice(TASK_TITLE_PREFIX.length).trim() };
      continue;
    }

    if (line.startsWith('## ')) {
      flushTask();
      activeSection = 'other';
      continue;
    }

    const parsedLine = parseLabelValue(line);
    if (activeSection === 'default' && parsedLine) {
      if (parsedLine.label === '文档' && parsedLine.value) {
        resolvedDefaults.documentTitle = parsedLine.value;
      }
      if (parsedLine.label === '阶段' && parsedLine.value) {
        resolvedDefaults.stageTitle = parsedLine.value;
      }
      continue;
    }

    if (!currentTask) {
      continue;
    }

    if (parsedLine) {
      collectingDescription = false;
      switch (parsedLine.label) {
        case '编号':
          currentTask.orderIndex = parsedLine.value;
          break;
        case '对应阶段': {
          currentTask.targetStageLabel = parsedLine.value;
          const [documentTitle, stageTitle] = parsedLine.value.split('/').map((value) => value.trim());
          if (documentTitle && !currentTask.documentTitle) {
            currentTask.documentTitle = documentTitle;
          }
          if (stageTitle && !currentTask.stageTitle) {
            currentTask.stageTitle = stageTitle;
          }
          break;
        }
        case '状态':
          currentTask.status = parsedLine.value;
          break;
        case '优先级':
          currentTask.priority = parsedLine.value;
          break;
        case '进度':
          currentTask.progress = parsedLine.value;
          break;
        case '文档':
          currentTask.documentTitle = parsedLine.value;
          break;
        case '阶段':
          currentTask.stageTitle = parsedLine.value;
          break;
        case '标签':
          currentTask.tags = parsedLine.value;
          break;
        case '目标':
          currentTask.targetSummary = parsedLine.value;
          break;
        case '任务键':
          currentTask.syncKey = parsedLine.value;
          break;
        case '描述':
          currentTask.description = parsedLine.value;
          descriptionLines = parsedLine.value ? [parsedLine.value] : [];
          collectingDescription = true;
          break;
        default:
          break;
      }
      continue;
    }

    if (collectingDescription && /^\s{2,}\S/.test(line)) {
      descriptionLines.push(line.trim());
    }
  }

  flushTask();

  let nextOrderIndex = getNextTaskOrderIndex(existingTasks.filter((task) => task.versionId === version.id));

  return drafts
    .filter((draft) => draft.title && draft.title !== TASK_TITLE_PLACEHOLDER && !draft.title.startsWith('示例：'))
    .map((draft) => {
      const fallbackSyncKey = buildDerivedSyncKey(version, draft.title);
      const placement = resolvePlacement(
        version,
        draft.documentTitle || resolvedDefaults.documentTitle,
        draft.stageTitle || resolvedDefaults.stageTitle,
        resolvedDefaults
      );
      const existingTask =
        existingTasks.find((task) => task.versionId === version.id && task.syncKey === (draft.syncKey || fallbackSyncKey)) ??
        existingTasks.find(
          (task) =>
            task.versionId === version.id &&
            task.title === draft.title &&
            task.documentStageId === placement.stageId
        ) ??
        existingTasks.find((task) => task.versionId === version.id && task.title === draft.title);
      const now = getCurrentTimestamp();
      const normalizedOrderIndex = normalizeTaskOrder(draft.orderIndex, existingTask?.orderIndex ?? nextOrderIndex);

      nextOrderIndex = Math.max(nextOrderIndex, normalizedOrderIndex ?? nextOrderIndex) + 1;

      return {
        id: existingTask?.id ?? generateUUID(),
        projectId: project.id,
        orderIndex: normalizedOrderIndex,
        versionId: version.id,
        documentId: placement.documentId,
        documentStageId: placement.stageId,
        syncKey: draft.syncKey || existingTask?.syncKey || fallbackSyncKey,
        sourceType: existingTask?.sourceType ?? 'external_sync',
        title: draft.title,
        description: draft.description ?? existingTask?.description ?? '',
        status: normalizeTaskStatus(draft.status ?? existingTask?.status),
        priority: normalizeTaskPriority(draft.priority ?? existingTask?.priority),
        progress: clampProgress(draft.progress, existingTask?.progress ?? 0),
        targetSummary:
          draft.targetSummary ??
          draft.targetStageLabel ??
          existingTask?.targetSummary ??
          buildTaskTargetSummary(placement.documentTitle, placement.stageTitle) ??
          `${version.label} · ${placement.stageTitle ?? '任务'}`,
        tags: (draft.tags ?? '')
          .split(/[，,]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        dueDate: existingTask?.dueDate,
        createdAt: existingTask?.createdAt ?? now,
        updatedAt: now,
      } satisfies Task;
    });
}

async function readVersionTaskFile(
  directoryHandle: FileSystemDirectoryHandle,
  version: ProjectVersion
): Promise<string | null> {
  try {
    const taskManagerDirectory = await directoryHandle.getDirectoryHandle('.task-manager');
    const versionDirectory = await taskManagerDirectory.getDirectoryHandle(getVersionFolderName(version));
    const fileHandle = await versionDirectory.getFileHandle(TASK_MANAGER_TASK_FILE_NAME);
    const file = await fileHandle.getFile();
    return file.text();
  } catch (err) {
    if ((err as Error).name === 'NotFoundError') {
      return null;
    }
    throw err;
  }
}

function findTaskIndex(tasks: Task[], versionId: string, candidate: Task): number {
  if (candidate.syncKey) {
    const bySyncKey = tasks.findIndex(
      (task) => task.versionId === versionId && task.projectId === candidate.projectId && task.syncKey === candidate.syncKey
    );
    if (bySyncKey >= 0) {
      return bySyncKey;
    }
  }

  return tasks.findIndex(
    (task) =>
      task.versionId === versionId &&
      task.projectId === candidate.projectId &&
      task.title === candidate.title &&
      task.documentStageId === candidate.documentStageId
  );
}

export async function mergeArchiveTasksWithTaskFiles(
  directoryHandle: FileSystemDirectoryHandle,
  project: Project,
  archivedTasks: Task[]
): Promise<Task[]> {
  const mergedTasks = [...archivedTasks];

  for (const version of project.versions ?? []) {
    const content = await readVersionTaskFile(directoryHandle, version);
    if (!content) {
      continue;
    }

    const parsedTasks = parseVersionTaskFile(content, project, version, mergedTasks);
    parsedTasks.forEach((task) => {
      const existingIndex = findTaskIndex(mergedTasks, version.id, task);
      if (existingIndex >= 0) {
        // Archive data is the source of truth for existing tasks.
        // Task files can still introduce brand-new tasks that do not exist in the archive.
        return;
      }

      mergedTasks.push(task);
    });
  }

  return sortTasksByOrder(mergedTasks);
}
