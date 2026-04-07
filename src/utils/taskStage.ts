export function buildTaskTargetSummary(documentTitle?: string, stageTitle?: string): string | undefined {
  const normalizedDocumentTitle = documentTitle?.trim();
  const normalizedStageTitle = stageTitle?.trim();

  if (normalizedDocumentTitle && normalizedStageTitle) {
    return `${normalizedDocumentTitle} / ${normalizedStageTitle}`;
  }

  return normalizedDocumentTitle || normalizedStageTitle || undefined;
}
