import { useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { Dashboard } from '@/pages/Dashboard';
import { ProjectList } from '@/pages/ProjectList';
import { ProjectDetail } from '@/pages/ProjectDetail';
import { ErrorBoundary } from '@/components/common';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

function App() {
  const { language, setLanguage } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();

  const handleToggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const handleToggleLanguage = useCallback(() => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  }, [language, setLanguage]);

  const handleOpenSettings = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-settings'));
  }, []);

  useKeyboardShortcuts([
    {
      key: 't',
      ctrl: true,
      shift: true,
      handler: handleToggleTheme,
    },
    {
      key: 'l',
      ctrl: true,
      shift: true,
      handler: handleToggleLanguage,
    },
    {
      key: ',',
      ctrl: true,
      handler: handleOpenSettings,
    },
  ]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
