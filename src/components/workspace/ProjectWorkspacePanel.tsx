import { useEffect, useMemo, useState } from 'react';
import { Card, CardTitle } from '@/components/common';
import { useI18n } from '@/i18n';
import type { Project, ProjectVersionDocument, Task } from '@/types';
import { getProjectDirectoryHandle } from '@/utils/directoryHandles';
import {
  createDirectoryHandleFromPath,
  ensureDirectoryPermission,
  readTextFileByPath,
} from '@/utils/fileSystem';
import {
  buildVersionGoalDocument,
  buildVersionImplementationDocument,
} from '@/utils/taskManagerDocs';
import {
  getCurrentProjectVersion,
  getProjectVersionById,
  getProjectVersionDocuments,
  getVersionTasks,
} from '@/utils/projectVersion';
import { getWorkspaceDocuments } from '@/workspace/selfTracking';

interface ProjectWorkspacePanelProps {
  project: Project;
  tasks: Task[];
  activeVersionId?: string | null;
}

function getFallbackDocumentContent(
  project: Project,
  document: ProjectVersionDocument,
  tasks: Task[]
): string {
  const version =
    project.versions?.find((item) => item.id === document.versionId);

  if (!version) {
    return '暂无文档内容。';
  }

  if (document.type === 'goal') {
    return buildVersionGoalDocument(project, version);
  }

  if (document.type === 'implementation') {
    return buildVersionImplementationDocument(project, version, tasks);
  }

  return `${document.title}\n\n${document.summary}`;
}

function normalizeDocumentPath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

export function ProjectWorkspacePanel({
  project,
  tasks,
  activeVersionId,
}: ProjectWorkspacePanelProps) {
  const { language } = useI18n();
  const [loadedDocumentContents, setLoadedDocumentContents] = useState<Record<string, string>>({});

  const activeVersion =
    getProjectVersionById(project, activeVersionId ?? undefined) ??
    getCurrentProjectVersion(project);
  const versionDocuments = getProjectVersionDocuments(project, activeVersion?.id).filter(
    (document) => document.type === 'goal' || document.type === 'implementation'
  );
  const versionTasks = activeVersion
    ? getVersionTasks(tasks, project.id, activeVersion.id)
    : [];
  const completionRate =
    versionTasks.length === 0
      ? 0
      : Math.round(
          (versionTasks.filter((task) => task.status === 'done').length / versionTasks.length) * 100
        );

  const orderedDocuments = useMemo(() => {
    const documentOrder = {
      goal: 0,
      implementation: 1,
    } as const;

    return [...versionDocuments].sort((left, right) => {
      const leftOrder = documentOrder[left.type as 'goal' | 'implementation'] ?? 99;
      const rightOrder = documentOrder[right.type as 'goal' | 'implementation'] ?? 99;
      return leftOrder - rightOrder;
    });
  }, [versionDocuments]);

  const fallbackDocumentContents = useMemo(() => {
    return orderedDocuments.reduce<Record<string, string>>((accumulator, document) => {
      accumulator[document.id] = getFallbackDocumentContent(project, document, tasks);
      return accumulator;
    }, {});
  }, [orderedDocuments, project, tasks]);

  const documentContents = useMemo(() => {
    return orderedDocuments.reduce<Record<string, string>>((accumulator, document) => {
      accumulator[document.id] = loadedDocumentContents[document.id] ?? fallbackDocumentContents[document.id];
      return accumulator;
    }, {});
  }, [fallbackDocumentContents, loadedDocumentContents, orderedDocuments]);

  useEffect(() => {
    if (!activeVersion || orderedDocuments.length === 0) {
      return;
    }

    let isCancelled = false;

    const loadDocumentContents = async () => {
      const nextContents: Record<string, string> = {};

      try {
        const workspaceDocuments = getWorkspaceDocuments(project, activeVersion.id);
        const workspaceContentMap = new Map(
          workspaceDocuments.map((document) => [document.id, document.content])
        );

        let directoryHandle = await getProjectDirectoryHandle(project.id);
        if (!directoryHandle && project.path && project.path.startsWith('/')) {
          directoryHandle = createDirectoryHandleFromPath(project.path);
        }

        const canReadDirectory = directoryHandle
          ? await ensureDirectoryPermission(directoryHandle, {
              mode: 'read',
              request: false,
            })
          : false;

        for (const document of orderedDocuments) {
          const workspaceContent = workspaceContentMap.get(document.id);
          if (workspaceContent) {
            nextContents[document.id] = workspaceContent;
            continue;
          }

          const normalizedDocumentPath = normalizeDocumentPath(document.path);

          if (
            directoryHandle &&
            canReadDirectory &&
            normalizedDocumentPath.startsWith('.task-manager/')
          ) {
            try {
              nextContents[document.id] = await readTextFileByPath(directoryHandle, normalizedDocumentPath);
              continue;
            } catch {
              // Fall back to generated content below.
            }
          }

          nextContents[document.id] = fallbackDocumentContents[document.id];
        }
      } catch {
        // Keep the fallback content that was already rendered.
        for (const document of orderedDocuments) {
          nextContents[document.id] = fallbackDocumentContents[document.id];
        }
      }

      if (!isCancelled) {
        setLoadedDocumentContents(nextContents);
      }
    };

    void loadDocumentContents();

    return () => {
      isCancelled = true;
    };
  }, [activeVersion, fallbackDocumentContents, orderedDocuments, project]);

  if (!activeVersion) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:border-blue-900 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                {language === 'zh' ? '版本概览' : 'Version Overview'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">{activeVersion.label}</CardTitle>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                  {language === 'zh' ? '版本内容页' : 'Version View'}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
                {activeVersion.summary}
              </p>
            </div>
            <div className="min-w-[180px] text-right">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {language === 'zh' ? '当前版本进度' : 'Version Progress'}
              </p>
              <p className="mt-1 text-3xl font-semibold text-blue-600 dark:text-blue-300">
                {completionRate}%
              </p>
            </div>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500"
              style={{ width: `${Math.min(completionRate, 100)}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {orderedDocuments.map((document) => (
          <Card key={document.id} className="h-[34rem]">
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-gray-100 pb-3 dark:border-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{document.title}</CardTitle>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {document.summary}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                    {document.type === 'goal'
                      ? (language === 'zh' ? '目标文档' : 'Target Document')
                      : (language === 'zh' ? '施工文档' : 'Implementation Document')}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
                  {document.path}
                </p>
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="h-full overflow-y-auto px-4 py-4">
                  <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-slate-200">
                    {documentContents[document.id] ?? (language === 'zh' ? '正在读取文档内容...' : 'Loading document content...')}
                  </pre>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
