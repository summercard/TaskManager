import { isDesktopApp } from './desktop';

export function navigateToPath(path: string, navigate?: (path: string) => void): void {
  if (navigate) {
    navigate(path);
    return;
  }

  if (isDesktopApp() && typeof window !== 'undefined') {
    window.location.hash = `#${path}`;
    return;
  }

  if (typeof window !== 'undefined') {
    window.location.assign(path);
  }
}
