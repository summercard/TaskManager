import { useI18n } from '@/i18n';
import { useTheme, type Theme } from '@/theme';
import { Modal } from '@/components/common';
import { SHORTCUT_DESCRIPTIONS } from '@/hooks/useKeyboardShortcuts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { language, setLanguage, t } = useI18n();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const themes: { value: Theme; label: string }[] = [
    { value: 'light', label: t.lightMode },
    { value: 'dark', label: t.darkMode },
    { value: 'system', label: t.systemTheme },
  ];

  const shortcutItems = [
    { ...SHORTCUT_DESCRIPTIONS.newTask, key: 'Ctrl+N' },
    { ...SHORTCUT_DESCRIPTIONS.newProject, key: 'Ctrl+Shift+P' },
    { ...SHORTCUT_DESCRIPTIONS.search, key: 'Ctrl+F' },
    { ...SHORTCUT_DESCRIPTIONS.toggleTheme, key: 'Ctrl+Shift+T' },
    { ...SHORTCUT_DESCRIPTIONS.toggleLanguage, key: 'Ctrl+Shift+L' },
    { ...SHORTCUT_DESCRIPTIONS.save, key: 'Ctrl+S' },
    { ...SHORTCUT_DESCRIPTIONS.escape, key: 'Esc' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.settings}>
      <div className="space-y-6">
        {/* 语言设置 */}
        <div>
          <h3 className="text-sm font-medium mb-3">{t.language}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage('zh')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                language === 'zh'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t.chinese}
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                language === 'en'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t.english}
            </button>
          </div>
        </div>

        {/* 主题设置 */}
        <div>
          <h3 className="text-sm font-medium mb-3">{t.theme}</h3>
          <div className="flex gap-2">
            {themes.map((themeItem) => (
              <button
                key={themeItem.value}
                onClick={() => setTheme(themeItem.value)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  theme === themeItem.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {themeItem.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {t.theme}: {resolvedTheme === 'dark' ? t.darkMode : t.lightMode}
          </p>
        </div>

        {/* 快捷键设置 */}
        <div>
          <h3 className="text-sm font-medium mb-3">{t.shortcuts}</h3>
          <div className="space-y-2">
            {shortcutItems.map((shortcut) => {
              const desc = shortcut.description?.[language] || '';
              return (
                <div
                  key={shortcut.key}
                  className="flex justify-between items-center py-1 px-3 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <span className="text-sm">{desc}</span>
                  <kbd className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded">
                    {shortcut.key}
                  </kbd>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
