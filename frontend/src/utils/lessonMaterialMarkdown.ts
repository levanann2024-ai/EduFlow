const romanHeading = /^\s*(?:#{1,6}\s*)?([ivxlcdm]+)\.\s+(.+?)\s*$/i;
const numberedHeading = /^\s*(?:#{1,6}\s*)?(\d+)\.\s+(.+?)\s*$/;

export function normalizeLessonMaterialMarkdown(content: string): string {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const normalized: string[] = [];
  let codeFence: string | null = null;
  let inMathBlock = false;
  let inTable = false;

  lines.forEach((line) => {
    const fence = line.match(/^\s*(```+|~~~+)/)?.[1];
    if (fence) {
      if (!codeFence) codeFence = fence.slice(0, 3);
      else if (fence.startsWith(codeFence)) codeFence = null;
      normalized.push(line);
      return;
    }
    if (codeFence) {
      normalized.push(line);
      return;
    }

    if (/^\s*\$\$\s*$/.test(line)) {
      inMathBlock = !inMathBlock;
      normalized.push(line);
      return;
    }
    if (inMathBlock) {
      normalized.push(line);
      return;
    }

    const isTableLine = /^\s*\|.*\|\s*$/.test(line);
    if (isTableLine || (inTable && /^\s*[-|:\s]+\s*$/.test(line))) {
      inTable = true;
      normalized.push(line);
      return;
    }
    if (inTable && !line.trim()) {
      inTable = false;
      normalized.push(line);
      return;
    }
    inTable = false;

    const romanMatch = line.match(romanHeading);
    if (romanMatch) {
      pushHeading(normalized, `## ${romanMatch[1].toUpperCase()}. ${romanMatch[2].trim()}`);
      return;
    }

    const numberedMatch = line.match(numberedHeading);
    if (numberedMatch && numberedMatch[2].length <= 120 && !/[.!?;]$/.test(numberedMatch[2])) {
      pushHeading(normalized, `### ${numberedMatch[1]}. ${numberedMatch[2].trim()}`);
      return;
    }

    const additionalPoint = line.match(/^(\s*)\+\)\s+(.+)$/);
    if (additionalPoint) {
      normalized.push(`${additionalPoint[1]}  - ${additionalPoint[2]}`);
      return;
    }
    normalized.push(line);
  });

  return normalized.join('\n').trim();
}

function pushHeading(lines: string[], heading: string) {
  if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
  lines.push(heading);
  lines.push('');
}
