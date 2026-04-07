import goalDocumentContent from '@/content/self-project/TargetDocument.md?raw';
import implementationDocumentContent from '@/content/self-project/ImplementationDocument.md?raw';
import type {
  Project,
  ProjectDocumentRef,
  ProjectDocumentStage,
  ProjectVersion,
  ProjectVersionDocument,
  Task,
} from '@/types';
import { projectStorage, taskStorage } from '@/utils/storage';
import { getCurrentTimestamp } from '@/utils';
import { getPersistentStorage } from '@/utils/persistentStorage';

export interface WorkspaceDocument extends ProjectVersionDocument {
  content: string;
}

export interface WorkspaceVersion extends Omit<ProjectVersion, 'documents'> {
  documents: WorkspaceDocument[];
}

const BOOTSTRAP_KEY = 'taskmanager-self-tracking-bootstrapped-v1-5';
const persistentStorage = getPersistentStorage();

export const SELF_TRACKING_WORKSPACE_ID = 'taskmanager-main-workspace';
export const SELF_TRACKING_PROJECT_ID = 'taskmanager-main-project';
export const SELF_TRACKING_VERSION_ID = 'taskmanager-main-project-v1-1';

const STATIC_UPDATED_AT = '2026-04-06T00:00:00.000Z';

const GOAL_DOCUMENT_STAGES: ProjectDocumentStage[] = [
  {
    id: 'goal-g1',
    title: 'G1 主端与子项目工作台模型',
    summary: '明确主端统一管理、子项目承接版本和任务的结构。',
    status: 'done',
  },
  {
    id: 'goal-g2',
    title: 'G2 版本化文档体系',
    summary: '建立按版本组织的目标文档与施工文档。',
    status: 'done',
  },
  {
    id: 'goal-g3',
    title: 'G3 文档阶段与任务映射',
    summary: '让任务知道自己属于哪个版本的哪份文档、哪个阶段。',
    status: 'done',
  },
  {
    id: 'goal-g4',
    title: 'G4 工程自跟踪样板',
    summary: '让当前工程自己成为第一个版本化样板项目。',
    status: 'done',
  },
  {
    id: 'goal-g5',
    title: 'G5 项目总页版本目标透出',
    summary: '让多项目主页能直接看到当前版本进度和下一个目标。',
    status: 'done',
  },
  {
    id: 'goal-g6',
    title: 'G6 任务新增前文档更新规范',
    summary: '让新增任务前必须先完成两份文档更新说明和阶段归属确认。',
    status: 'done',
  },
  {
    id: 'goal-g7',
    title: 'G7 老项目新版本迭代',
    summary: '让老项目能在原项目下继续新增新版本并切换当前版本。',
    status: 'done',
  },
  {
    id: 'goal-g8',
    title: 'G8 开发事件自动接入',
    summary: '让开发中的接口、模块或功能能自动转成任务并持续推进。',
    status: 'done',
  },
];

const IMPLEMENTATION_DOCUMENT_STAGES: ProjectDocumentStage[] = [
  {
    id: 'implementation-i1',
    title: 'I1 版本化数据结构',
    summary: '补齐项目版本、文档阶段与任务映射的数据模型。',
    status: 'done',
  },
  {
    id: 'implementation-i2',
    title: 'I2 当前工程 v1.1 自举',
    summary: '自动生成 TaskManager v1.1 样板项目、文档和默认任务。',
    status: 'done',
  },
  {
    id: 'implementation-i3',
    title: 'I3 项目详情版本面板',
    summary: '在项目详情中显示当前版本、文档和阶段任务。',
    status: 'done',
  },
  {
    id: 'implementation-i4',
    title: 'I4 阶段任务映射',
    summary: '把任务正式关联到某个文档阶段，并在界面中可读。',
    status: 'done',
  },
  {
    id: 'implementation-i5',
    title: 'I5 项目总页版本概览',
    summary: '在多项目主页展示当前版本完成率和当前目标。',
    status: 'done',
  },
  {
    id: 'implementation-i6',
    title: 'I6 文档先行的任务新增流程',
    summary: '新增任务前先记录两份文档更新说明并确认阶段归属。',
    status: 'done',
  },
  {
    id: 'implementation-i7',
    title: 'I7 老项目版本模板与切换',
    summary: '为旧项目补齐新增版本入口和版本模板生成逻辑。',
    status: 'done',
  },
  {
    id: 'implementation-i8',
    title: 'I8 开发事件自动接入',
    summary: '让开发事件第一次自动建任务，后续自动推进对应任务。',
    status: 'done',
  },
];

const WORKSPACE_VERSIONS: WorkspaceVersion[] = [
  {
    id: SELF_TRACKING_VERSION_ID,
    version: '1.1',
    label: 'v1.1',
    summary: '建立 TaskManager 的版本化结构，并把项目总页总览、老项目升版与开发事件自动接入都接进 v1.1。',
    status: 'released',
    goal: {
      targetCount: 9,
      currentCount: 9,
      description: '完成 TaskManager v1.1 的版本化结构、主页版本总览、老项目升版和开发事件自动接入',
    },
    taskCreationRules: [
      '新增任务前，先同步当前版本的目标文档更新说明。',
      '新增任务前，先同步当前版本的施工文档更新说明。',
      '新增任务时必须确认任务归属的文档阶段，任务完成率计入当前版本。',
    ],
    taskPreparationHistory: [
      {
        id: 'taskmanager-v1-1-preparation-project-overview',
        versionId: SELF_TRACKING_VERSION_ID,
        targetDocumentId: 'taskmanager-implementation-document-v1-1',
        targetDocumentTitle: '施工文档 v1.1',
        targetStageId: 'implementation-i6',
        targetStageTitle: 'I6 文档先行的任务新增流程',
        goalUpdateNote: '补充 v1.1 在多项目主页展示当前版本进度与下一个目标的目标要求。',
        implementationUpdateNote: '补充项目列表的版本目标展示逻辑，以及新增任务前先完成两份文档更新说明的流程。',
        preparedAt: STATIC_UPDATED_AT,
      },
    ],
    updatedAt: STATIC_UPDATED_AT,
    documents: [
      {
        id: 'taskmanager-goal-document-v1-1',
        versionId: SELF_TRACKING_VERSION_ID,
        title: '目标文档 v1.1',
        type: 'goal',
        summary: '定义 TaskManager v1.1 的目标范围、阶段边界和验收标准。',
        path: 'src/content/self-project/TargetDocument.md',
        updatedAt: STATIC_UPDATED_AT,
        stages: GOAL_DOCUMENT_STAGES,
        content: goalDocumentContent,
      },
      {
        id: 'taskmanager-implementation-document-v1-1',
        versionId: SELF_TRACKING_VERSION_ID,
        title: '施工文档 v1.1',
        type: 'implementation',
        summary: '定义 TaskManager v1.1 的施工阶段、代码落点和出口条件。',
        path: 'src/content/self-project/ImplementationDocument.md',
        updatedAt: STATIC_UPDATED_AT,
        stages: IMPLEMENTATION_DOCUMENT_STAGES,
        content: implementationDocumentContent,
      },
      {
        id: 'taskmanager-usage-guide-v1-1',
        versionId: SELF_TRACKING_VERSION_ID,
        title: 'TaskManager 使用说明',
        type: 'note',
        summary: '记录主工具当前可用的工作流、版本规则和开发接入方式。',
        path: 'docs/TaskManager-Guide.md',
        updatedAt: STATIC_UPDATED_AT,
        stages: [],
        content: 'See docs/TaskManager-Guide.md',
      },
      {
        id: 'taskmanager-development-log-v1-1',
        versionId: SELF_TRACKING_VERSION_ID,
        title: 'TaskManager 开发日志',
        type: 'note',
        summary: '记录当前工程在 v1.1 中完成的关键开发节点。',
        path: 'docs/DevelopmentLog.md',
        updatedAt: STATIC_UPDATED_AT,
        stages: [],
        content: 'See docs/DevelopmentLog.md',
      },
    ],
  },
];

function serializeWorkspaceDocument(document: WorkspaceDocument): ProjectVersionDocument {
  return {
    id: document.id,
    versionId: document.versionId,
    title: document.title,
    type: document.type,
    summary: document.summary,
    path: document.path,
    updatedAt: document.updatedAt,
    stages: document.stages.map((stage) => ({ ...stage })),
  };
}

function serializeWorkspaceVersion(version: WorkspaceVersion): ProjectVersion {
  return {
    id: version.id,
    version: version.version,
    label: version.label,
    summary: version.summary,
    status: version.status,
    goal: version.goal,
    documents: version.documents.map(serializeWorkspaceDocument),
    taskCreationRules: version.taskCreationRules,
    taskPreparationHistory: version.taskPreparationHistory,
    updatedAt: version.updatedAt,
  };
}

function createLegacyDocumentRefs(version: WorkspaceVersion): ProjectDocumentRef[] {
  return version.documents.map((document) => ({
    id: document.id,
    title: document.title,
    type: document.type,
    summary: document.summary,
    path: document.path,
    updatedAt: document.updatedAt,
  }));
}

function getCurrentWorkspaceVersionSeed(): WorkspaceVersion {
  return WORKSPACE_VERSIONS[0];
}

function createDefaultProject(): Project {
  const now = getCurrentTimestamp();
  const currentVersion = getCurrentWorkspaceVersionSeed();

  return {
    id: SELF_TRACKING_PROJECT_ID,
    name: 'TaskManager 主工程',
    description: '当前工程的版本化样板项目，用来推进主端/子项目模型、文档阶段映射和后续自动化联动。',
    status: 'completed',
    goal: currentVersion.goal,
    path: 'TaskManager-main',
    workspaceId: SELF_TRACKING_WORKSPACE_ID,
    currentVersionId: currentVersion.id,
    versions: [serializeWorkspaceVersion(currentVersion)],
    documents: createLegacyDocumentRefs(currentVersion),
    tracking: {
      interfaceName: '工程跟踪接口',
      currentVersionId: currentVersion.id,
      currentVersionLabel: currentVersion.label,
      statusLabel: 'v1.1 已完成',
      progress: 100,
      currentFocus: '当前版本已具备项目总页总览、老项目升版入口，以及开发事件自动建任务与推进状态的流程。',
      childWorkspaceName: 'TaskManager-main',
      childWorkspacePath: 'src/ + src/content/self-project/',
      lastUpdatedAt: now,
    },
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
}

function createDefaultTasks(): Task[] {
  const now = getCurrentTimestamp();
  const currentVersion = getCurrentWorkspaceVersionSeed();
  const goalDocument = currentVersion.documents.find((document) => document.type === 'goal')!;
  const implementationDocument = currentVersion.documents.find((document) => document.type === 'implementation')!;

  return [
    {
      id: 'taskmanager-workspace-task-version-structure',
      projectId: SELF_TRACKING_PROJECT_ID,
      versionId: currentVersion.id,
      documentId: implementationDocument.id,
      documentStageId: 'implementation-i1',
      title: '建立 v1.1 版本化数据结构',
      description: '为项目、文档和任务补齐版本归属与阶段映射字段。',
      status: 'done',
      priority: 'high',
      progress: 100,
      targetSummary: '让 TaskManager 具备项目 -> 版本 -> 文档阶段 -> 任务的基础结构',
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'taskmanager-workspace-task-version-docs',
      projectId: SELF_TRACKING_PROJECT_ID,
      versionId: currentVersion.id,
      documentId: goalDocument.id,
      documentStageId: 'goal-g2',
      title: '整理 v1.1 版本文档',
      description: '把目标文档和施工文档改造成真正的 v1.1 版本文档。',
      status: 'done',
      priority: 'high',
      progress: 100,
      targetSummary: '让当前文档明确属于 v1.1，并定义阶段编号',
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'taskmanager-workspace-task-stage-mapping',
      projectId: SELF_TRACKING_PROJECT_ID,
      versionId: currentVersion.id,
      documentId: goalDocument.id,
      documentStageId: 'goal-g3',
      title: '建立任务与文档阶段映射',
      description: '让默认任务知道自己属于 v1.1 的哪份文档、哪个阶段。',
      status: 'done',
      priority: 'high',
      progress: 100,
      targetSummary: '让每个关键任务都能回溯到 v1.1 文档中的阶段',
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'taskmanager-workspace-task-version-panel',
      projectId: SELF_TRACKING_PROJECT_ID,
      versionId: currentVersion.id,
      documentId: implementationDocument.id,
      documentStageId: 'implementation-i3',
      title: '落地 v1.1 版本工作台面板',
      description: '在项目详情中展示当前版本、文档切换、阶段和版本任务。',
      status: 'done',
      priority: 'medium',
      progress: 100,
      targetSummary: '让用户能直接看出当前在做 v1.1 的哪个阶段',
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'taskmanager-workspace-task-sample-project',
      projectId: SELF_TRACKING_PROJECT_ID,
      versionId: currentVersion.id,
      documentId: goalDocument.id,
      documentStageId: 'goal-g4',
      title: '把 TaskManager 做成 v1.1 样板工程',
      description: '让当前工程自己成为第一个版本化、可追踪、可展示阶段任务的样板项目。',
      status: 'done',
      priority: 'medium',
      progress: 100,
      targetSummary: '让当前工程自己验证 v1.1 模型是否可用',
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'taskmanager-workspace-task-project-list-progress',
      projectId: SELF_TRACKING_PROJECT_ID,
      versionId: currentVersion.id,
      documentId: implementationDocument.id,
      documentStageId: 'implementation-i5',
      title: '让项目总页显示当前版本进度与目标',
      description: '在多项目主页中显示每个项目的当前版本完成率和下一个正在进行或未完成的目标。',
      status: 'done',
      priority: 'high',
      progress: 100,
      targetSummary: '让主端一眼看出每个项目当前版本推进到了哪里',
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'taskmanager-workspace-task-document-first-task-flow',
      projectId: SELF_TRACKING_PROJECT_ID,
      versionId: currentVersion.id,
      documentId: implementationDocument.id,
      documentStageId: 'implementation-i6',
      title: '建立新增任务前的文档更新流程',
      description: '要求新增任务前先填写目标文档和施工文档的更新说明，再选择阶段并创建任务。',
      status: 'done',
      priority: 'high',
      progress: 100,
      targetSummary: '让文档更新成为新增任务前的固定步骤，而不是补做动作',
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'taskmanager-workspace-task-version-template-upgrade',
      projectId: SELF_TRACKING_PROJECT_ID,
      versionId: currentVersion.id,
      documentId: implementationDocument.id,
      documentStageId: 'implementation-i7',
      title: '为老项目补齐新增版本模板',
      description: '让已有项目可以直接新增新版本，并自动生成版本文档和阶段模板。',
      status: 'done',
      priority: 'high',
      progress: 100,
      targetSummary: '让老项目无需重建也能继续版本迭代',
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'taskmanager-workspace-task-development-event-sync',
      projectId: SELF_TRACKING_PROJECT_ID,
      versionId: currentVersion.id,
      documentId: implementationDocument.id,
      documentStageId: 'implementation-i8',
      title: '建立开发事件自动接入接口',
      description: '让开发中的接口、模块和功能通过接入键自动创建任务或推进已有任务状态。',
      status: 'done',
      priority: 'high',
      progress: 100,
      targetSummary: '让开发过程中的状态更新直接反映到版本任务',
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function mergeWorkspaceVersions(existingVersions: Project['versions']): ProjectVersion[] {
  const existingVersionMap = new Map((existingVersions ?? []).map((version) => [version.id, version]));

  return WORKSPACE_VERSIONS.map((workspaceVersion) => {
    const existingVersion = existingVersionMap.get(workspaceVersion.id);
    const serializedVersion = serializeWorkspaceVersion(workspaceVersion);

    if (!existingVersion) {
      return serializedVersion;
    }

    return {
      ...serializedVersion,
      status: existingVersion.status ?? serializedVersion.status,
      goal: existingVersion.goal ?? serializedVersion.goal,
      taskCreationRules: existingVersion.taskCreationRules ?? serializedVersion.taskCreationRules,
      taskPreparationHistory:
        existingVersion.taskPreparationHistory ?? serializedVersion.taskPreparationHistory,
      updatedAt: existingVersion.updatedAt ?? serializedVersion.updatedAt,
    };
  });
}

function ensureSelfTrackingTasks(forceDefaultState: boolean): void {
  createDefaultTasks().forEach((defaultTask) => {
    const existingTask = taskStorage.getById(defaultTask.id) as Task | undefined;

    if (!existingTask) {
      taskStorage.save(defaultTask);
      return;
    }

    const mergedTask: Task = forceDefaultState
      ? {
          ...existingTask,
          ...defaultTask,
          createdAt: existingTask.createdAt ?? defaultTask.createdAt,
          updatedAt: getCurrentTimestamp(),
        }
      : {
          ...existingTask,
          versionId: existingTask.versionId ?? defaultTask.versionId,
          documentId: existingTask.documentId ?? defaultTask.documentId,
          documentStageId: existingTask.documentStageId ?? defaultTask.documentStageId,
          progress: existingTask.progress ?? defaultTask.progress,
          targetSummary: existingTask.targetSummary ?? defaultTask.targetSummary,
        };

    taskStorage.update(defaultTask.id, mergedTask);
  });
}

export function bootstrapSelfTrackingWorkspace(): void {
  const hasBootstrapped = persistentStorage.getItem(BOOTSTRAP_KEY) === 'true';
  const projects = projectStorage.getAll() as Project[];
  const existingProject = projects.find((project) => project.id === SELF_TRACKING_PROJECT_ID);
  const currentVersion = getCurrentWorkspaceVersionSeed();
  const defaultProject = createDefaultProject();

  if (existingProject) {
    const patch: Partial<Project> = {};

    if (!hasBootstrapped) {
      patch.status = defaultProject.status;
      patch.goal = defaultProject.goal;
      patch.workspaceId = defaultProject.workspaceId;
      patch.currentVersionId = defaultProject.currentVersionId;
      patch.versions = defaultProject.versions;
      patch.documents = createLegacyDocumentRefs(currentVersion);
      patch.tracking = defaultProject.tracking;
    } else {
      if (!existingProject.workspaceId) {
        patch.workspaceId = SELF_TRACKING_WORKSPACE_ID;
      }
      if (!existingProject.currentVersionId) {
        patch.currentVersionId = currentVersion.id;
      }
      if (!existingProject.versions || existingProject.versions.length === 0) {
        patch.versions = mergeWorkspaceVersions(existingProject.versions);
      } else {
        const hasCurrentVersion = existingProject.versions.some((version) => version.id === currentVersion.id);
        if (!hasCurrentVersion) {
          patch.versions = mergeWorkspaceVersions(existingProject.versions);
        }
      }
      if (!existingProject.documents || existingProject.documents.length === 0) {
        patch.documents = createLegacyDocumentRefs(currentVersion);
      }
      if (!existingProject.goal) {
        patch.goal = currentVersion.goal;
      }
      if (!existingProject.tracking) {
        patch.tracking = defaultProject.tracking;
      } else if (!existingProject.tracking.currentVersionId || !existingProject.tracking.currentVersionLabel) {
        patch.tracking = {
          ...existingProject.tracking,
          currentVersionId: existingProject.tracking.currentVersionId ?? currentVersion.id,
          currentVersionLabel: existingProject.tracking.currentVersionLabel ?? currentVersion.label,
        };
      }
    }

    if (
      hasBootstrapped &&
      existingProject.tracking &&
      (!existingProject.tracking.currentVersionId || !existingProject.tracking.currentVersionLabel)
    ) {
      patch.tracking = {
        ...existingProject.tracking,
        currentVersionId: existingProject.tracking.currentVersionId ?? currentVersion.id,
        currentVersionLabel: existingProject.tracking.currentVersionLabel ?? currentVersion.label,
      };
    }

    if (Object.keys(patch).length > 0) {
      projectStorage.update(existingProject.id, patch);
    }

    ensureSelfTrackingTasks(!hasBootstrapped);
    persistentStorage.setItem(BOOTSTRAP_KEY, 'true');
    return;
  }

  projectStorage.save(createDefaultProject());
  ensureSelfTrackingTasks(true);
  persistentStorage.setItem(BOOTSTRAP_KEY, 'true');
}

export function getWorkspaceVersions(project: Project): WorkspaceVersion[] {
  if (project.workspaceId !== SELF_TRACKING_WORKSPACE_ID) {
    return [];
  }

  const versionIds = new Set(project.versions?.map((version) => version.id) ?? []);
  return WORKSPACE_VERSIONS.filter((version) => versionIds.has(version.id));
}

export function getCurrentWorkspaceVersion(project: Project): WorkspaceVersion | undefined {
  const versions = getWorkspaceVersions(project);

  if (versions.length === 0) {
    return undefined;
  }

  return versions.find((version) => version.id === project.currentVersionId) ?? versions[0];
}

export function getWorkspaceDocuments(project: Project, versionId?: string): WorkspaceDocument[] {
  const versions = getWorkspaceVersions(project);

  if (versions.length === 0) {
    return [];
  }

  const targetVersionId = versionId ?? project.currentVersionId ?? versions[0].id;
  return versions.find((version) => version.id === targetVersionId)?.documents ?? [];
}
