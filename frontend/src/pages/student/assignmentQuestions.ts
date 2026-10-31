export interface AssignmentQuestionBlock {
  number: string;
  title: string;
  content: string;
}

export interface ParsedAssignmentContent {
  introduction: string;
  questions: AssignmentQuestionBlock[];
  teacherNote: string;
}

const assignmentAnswersFormat = 'eduflow-assignment-answers-v1';

export function parseAssignmentContent(content: string): ParsedAssignmentContent | null {
  const noteMatch = content.match(/(?:^|\n{2,})Lời nhắn của giáo viên:[ \t]*\r?\n([\s\S]*)$/i);
  const teacherNote = noteMatch?.[1].trim() ?? '';
  const withoutNote = noteMatch ? content.slice(0, noteMatch.index).trimEnd() : content;
  const headers = Array.from(withoutNote.matchAll(/^[ \t]*Câu[ \t]*(\d+)[ \t]*(?:[-–—:.)][ \t]*|$)(.*)$/gim));
  if (!headers.length) return null;

  const questions = headers.map((header, index): AssignmentQuestionBlock => {
    const start = header.index ?? 0;
    const end = headers[index + 1]?.index ?? withoutNote.length;
    const block = withoutNote.slice(start, end).trim();
    const firstLineEnd = block.search(/\r?\n/);
    const title = firstLineEnd < 0 ? block : block.slice(0, firstLineEnd).trim();
    const body = firstLineEnd < 0 ? '' : block.slice(firstLineEnd).trim();
    return {
      number: header[1],
      title,
      content: [title, body].filter(Boolean).join('\n\n'),
    };
  });

  return {
    introduction: withoutNote.slice(0, headers[0].index ?? 0).trim(),
    questions,
    teacherNote,
  };
}

export function serializeAssignmentAnswers(answers: string[]): string {
  return JSON.stringify({ format: assignmentAnswersFormat, answers });
}

export function parseAssignmentAnswers(responseText: string, questionCount: number): string[] | null {
  try {
    const value: unknown = JSON.parse(responseText);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const payload = value as { format?: unknown; answers?: unknown };
    if (payload.format !== assignmentAnswersFormat
      || !Array.isArray(payload.answers)
      || payload.answers.length !== questionCount
      || !payload.answers.every((answer) => typeof answer === 'string')) {
      return null;
    }
    return payload.answers;
  } catch {
    return null;
  }
}
