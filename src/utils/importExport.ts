import type { Project, Task } from '../types';

export interface ExportData {
  version: string;
  exportedAt: string;
  projects: Project[];
  tasks: Task[];
}

// 导出所有数据为 JSON
export function exportData(projects: Project[], tasks: Task[]): void {
  const data: ExportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    projects,
    tasks,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `taskmanager-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 验证导入的数据格式
export function validateImportData(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '数据格式无效' };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.version || typeof obj.version !== 'string') {
    return { valid: false, error: '缺少版本信息' };
  }

  if (!Array.isArray(obj.projects)) {
    return { valid: false, error: '项目数据格式无效' };
  }

  if (!Array.isArray(obj.tasks)) {
    return { valid: false, error: '任务数据格式无效' };
  }

  // 验证项目结构
  for (const project of obj.projects) {
    if (!project.id || !project.name) {
      return { valid: false, error: '项目数据缺少必要字段' };
    }
  }

  // 验证任务结构
  for (const task of obj.tasks) {
    if (!task.id || !task.projectId || !task.title) {
      return { valid: false, error: '任务数据缺少必要字段' };
    }
  }

  return { valid: true };
}

// 从文件读取数据
export function readImportFile(file: File): Promise<ExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text) as ExportData;
        resolve(data);
      } catch {
        reject(new Error('文件读取失败，请确保是有效的 JSON 文件'));
      }
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsText(file);
  });
}
