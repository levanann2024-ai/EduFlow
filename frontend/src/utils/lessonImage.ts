export function clampLessonImageWidth(startWidth: number, deltaX: number, availableWidth: number) {
  const maxWidth = Math.max(1, Math.min(1200, availableWidth));
  const minWidth = Math.min(80, maxWidth);
  return Math.min(maxWidth, Math.max(minWidth, Math.round(startWidth + deltaX)));
}
