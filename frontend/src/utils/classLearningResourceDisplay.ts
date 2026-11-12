export const CHAPTER_LEVEL_RESOURCE_LESSON = '__eduflow_chapter_level__';

export function isChapterLevelResourceLesson(lesson: string): boolean {
  return lesson === CHAPTER_LEVEL_RESOURCE_LESSON;
}
