import { useEffect, useCallback } from 'react';

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 忽略在输入框中的快捷键
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // 允许 Ctrl+Enter 保存
        if (!(event.ctrlKey && event.key === 'Enter')) {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          shiftMatch &&
          altMatch
        ) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const SHORTCUT_DESCRIPTIONS = {
  // 任务操作
  newTask: { key: 'n', ctrl: true, description: { zh: '新建任务', en: 'New Task' } },
  save: { key: 's', ctrl: true, description: { zh: '保存', en: 'Save' } },
  search: { key: 'f', ctrl: true, description: { zh: '搜索', en: 'Search' } },
  escape: { key: 'Escape', description: { zh: '关闭/取消', en: 'Close/Cancel' } },

  // 项目操作
  newProject: { key: 'p', ctrl: true, shift: true, description: { zh: '新建项目', en: 'New Project' } },

  // 主题切换
  toggleTheme: { key: 't', ctrl: true, shift: true, description: { zh: '切换主题', en: 'Toggle Theme' } },

  // 切换语言
  toggleLanguage: { key: 'l', ctrl: true, shift: true, description: { zh: '切换语言', en: 'Toggle Language' } },
};
