import io
def edit(name, pairs):
    p = name
    s = io.open(p, encoding='utf-8', newline='').read().replace('\r\n', '\n')
    for a, b in pairs:
        assert s.count(a) == 1, (name, a[:60], s.count(a))
        s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n'))

ERR = '''      {bookmarks.error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{bookmarks.error}</p>}
'''
ALERT = '''      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
'''

edit('ExamManagement.tsx', [
 ("import { useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useRef, useState } from 'react';"),
 ("import { ExamEditor } from '@/pages/teacher/ExamEditor';\n", "import { ExamEditor } from '@/pages/teacher/ExamEditor';\nimport { BookmarkButton, useTeacherBookmarks } from '@/pages/teacher/teacherSavedItems';\n"),
 ("export function ExamManagement({ onCreateExamRoom }: { onCreateExamRoom: (exam: SavedExam) => void }) {\n",
  "export function ExamManagement({ onCreateExamRoom, openExamId }: { onCreateExamRoom: (exam: SavedExam) => void; openExamId?: string }) {\n  const bookmarks = useTeacherBookmarks();\n  const openedExamId = useRef<string | null>(null);\n"),
 ("  const grades = useMemo(() => [...new Set(exams", "  useEffect(() => {\n    if (!openExamId || openedExamId.current === openExamId) return;\n    const target = exams.find((exam) => exam.id === openExamId);\n    if (!target) return;\n    openedExamId.current = openExamId;\n    setSelectedExam(target);\n  }, [exams, openExamId]);\n\n  const grades = useMemo(() => [...new Set(exams"),
 (ALERT, ALERT + ERR),
 ('''                  <button onClick={() => setSelectedExam(exam)} className="inline-flex items-center gap-1.5 rounded-lg border''',
  '''                  <BookmarkButton
                    saved={bookmarks.isSaved('exam', exam.id)}
                    busy={bookmarks.loading || bookmarks.isPending('exam', exam.id)}
                    label={`đề ${exam.title}`}
                    onToggle={() => void bookmarks.toggle({
                      id: exam.id,
                      type: 'exam',
                      title: exam.title || 'Đề chưa đặt tên',
                      subject: exam.subject,
                      savedAt: new Date().toISOString(),
                      assessmentId: exam.id,
                    })}
                  />
                  <button onClick={() => setSelectedExam(exam)} className="inline-flex items-center gap-1.5 rounded-lg border'''),
])

edit('AssignmentManagement.tsx', [
 ("import { useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useRef, useState } from 'react';"),
 ("import { ExamEditor } from '@/pages/teacher/ExamEditor';\n", "import { ExamEditor } from '@/pages/teacher/ExamEditor';\nimport { BookmarkButton, useTeacherBookmarks } from '@/pages/teacher/teacherSavedItems';\n"),
 ("  onAssignToClass,\n}: {\n  onAssignToClass: (draft: { title: string; subject: string; content: string }) => void;\n}) {\n",
  "  onAssignToClass,\n  openAssignmentId,\n}: {\n  onAssignToClass: (draft: { title: string; subject: string; content: string }) => void;\n  openAssignmentId?: string;\n}) {\n  const bookmarks = useTeacherBookmarks();\n  const openedAssignmentId = useRef<string | null>(null);\n"),
 ('''                  <button onClick={() => setSelectedAssignment(assignment)} className="inline-flex items-center gap-1.5 rounded-lg border''',
  '''                  <BookmarkButton
                    saved={bookmarks.isSaved('assignment', assignment.id)}
                    busy={bookmarks.loading || bookmarks.isPending('assignment', assignment.id)}
                    label={`bài tập ${assignment.title}`}
                    onToggle={() => void bookmarks.toggle({
                      id: assignment.id,
                      type: 'assignment',
                      title: assignment.title || 'Bài tập chưa đặt tên',
                      subject: assignment.subject,
                      savedAt: new Date().toISOString(),
                      assessmentId: assignment.id,
                    })}
                  />
                  <button onClick={() => setSelectedAssignment(assignment)} className="inline-flex items-center gap-1.5 rounded-lg border'''),
])