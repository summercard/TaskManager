import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ProjectArchiveBridge } from './components/folder'
import { I18nProvider } from './i18n'
import { useProjectStore } from './stores/projectStore'
import { useTagStore } from './stores/tagStore'
import { useTaskStore } from './stores/taskStore'
import { ThemeProvider } from './theme'
import { requestPersistentStorage } from './utils/storage'
import { bootstrapSelfTrackingWorkspace } from './workspace/selfTracking'

void requestPersistentStorage()
bootstrapSelfTrackingWorkspace()
useProjectStore.getState().loadProjects()
useTaskStore.getState().loadTasks()
useTaskStore.getState().loadComments()
useTagStore.getState().loadTags()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <ProjectArchiveBridge />
        <App />
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
)
