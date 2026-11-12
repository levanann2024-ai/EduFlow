import { authenticatedFetch } from '@/auth/authApi';

export type LessonDocumentAssistantNode = {
  id: string;
  kind: 'text' | 'formula';
  text: string;
  context?: string;
  display?: boolean;
  canChangeDisplay?: boolean;
};

export type LessonDocumentAssistantNodeResult = {
  id: string;
  text: string;
  display?: boolean;
};

export type LessonDocumentAssistantResult = {
  content: string;
  report: string;
};

export type LessonDocumentAssistantNodesResult = {
  items: LessonDocumentAssistantNodeResult[];
  report: string;
};

const combinedInstructions = [
  'Hãy xử lý toàn bộ tài liệu trong một lần, đồng thời thực hiện cả ba việc:',
  '1. Rà soát và sửa lỗi chính tả, ngữ pháp, diễn đạt và lỗi công thức nếu có; chỉ sửa lỗi rõ ràng, không tự thêm kiến thức, số liệu hoặc ý mới.',
  '2. Chuẩn hóa công thức Toán, Lý, Hóa theo cú pháp LaTeX dùng được với KaTeX, giữ nguyên ý nghĩa. Công thức trong dòng đặt giữa $...$, công thức độc lập đặt giữa $$...$$. Công thức hóa học dùng \\mathrm{}, ví dụ $\\mathrm{N_2 + 3H_2 \\rightleftharpoons 2NH_3}$; không dùng \\ce hoặc \\text{} cho từng ký hiệu. Đơn vị dùng \\mathrm{} hoặc \\text{}.',
  '3. Phân tích ngữ cảnh để quyết định công thức nào nên nằm riêng một dòng; chỉ tách dòng khi giúp dễ đọc, không xuống dòng tùy tiện.',
  'Giữ nguyên cấu trúc, thứ tự, tiêu đề, danh sách, bảng, tên riêng, dữ liệu và giọng văn của tài liệu. Không viết lời dẫn hoặc kết luận ngoài nội dung.',
  'Trình bày gọn: không chèn quá một dòng trống liên tiếp, không để dòng trống giữa các mục danh sách hoặc giữa tiêu đề và nội dung ngay sau nó, không dùng dòng "---" ngăn cách thừa.',
].join('\n');

async function requestAssistant(prompt: string): Promise<string> {
  const response = await authenticatedFetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'lesson-document',
      prompt,
    }),
  });
  let result: { success?: boolean; data?: string; message?: string };
  try {
    result = await response.json() as typeof result;
  } catch {
    throw new Error('Trợ lý AI trả về dữ liệu không hợp lệ.');
  }
  if (!response.ok || !result.success || !result.data?.trim()) {
    throw new Error(result.message || 'Không thể xử lý nội dung bằng trợ lý AI.');
  }
  return result.data.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

function parseAssistantJson(rawResult: string): unknown {
  try {
    const jsonResult = rawResult.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    return JSON.parse(jsonResult);
  } catch {
    throw new Error('Trợ lý AI trả về kết quả không đúng định dạng; nội dung bài chưa được thay đổi.');
  }
}

function readReport(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2000) {
    throw new Error('Trợ lý AI trả về phần kiểm tra lỗi không hợp lệ; nội dung bài chưa được thay đổi.');
  }
  return value.trim();
}

export async function runLessonDocumentAssistant(content: string): Promise<LessonDocumentAssistantResult> {
  if (!content.trim()) throw new Error('Chưa có nội dung để xử lý.');

  const rawResult = await requestAssistant([
    combinedInstructions,
    'Trả về duy nhất một JSON object hợp lệ theo dạng {"content":"nội dung Markdown đã xử lý","report":"tóm tắt ngắn các lỗi đã sửa hoặc xác nhận không thấy lỗi rõ ràng"}. Không thêm markdown fence.',
    'Trong content, giữ đúng cấu trúc Markdown. Dùng dòng mới cho công thức độc lập khi cần thiết.',
    JSON.stringify({ content }),
  ].join('\n\n'));
  const parsed = parseAssistantJson(rawResult);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Trợ lý AI trả về nội dung không hợp lệ; bài chưa được thay đổi.');
  }
  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.content !== 'string'
    || !candidate.content.trim()
    || candidate.content.length > Math.max(1000, content.length * 8)) {
    throw new Error('Trợ lý AI trả về nội dung không an toàn; bài chưa được thay đổi.');
  }

  return {
    content: candidate.content.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim(),
    report: readReport(candidate.report),
  };
}

export async function runLessonDocumentAssistantOnNodes(
  nodes: LessonDocumentAssistantNode[],
): Promise<LessonDocumentAssistantNodesResult> {
  if (nodes.length === 0) throw new Error('Chưa có nội dung phù hợp để xử lý.');

  const prompt = [
    combinedInstructions,
    'Đầu vào là một mảng JSON các mục có id, kind ("text" hoặc "formula"), text, context và các thuộc tính công thức display/canChangeDisplay.',
    'Xử lý tất cả mục cùng lúc và dùng context để kiểm tra lỗi. Với text, chỉ sửa lỗi rõ ràng; giữ nguyên ý nghĩa và không chèn ký tự xuống dòng vì cấu trúc văn bản sẽ được giữ nguyên.',
    'Với formula, chỉ sửa nguồn LaTeX và giữ nguyên ý nghĩa toán học. Nếu canChangeDisplay là true, đặt display=true khi công thức cần đứng riêng một dòng, ngược lại display=false. Nếu canChangeDisplay là false, giữ nguyên display.',
    'Trả về duy nhất JSON object {"items":[{"id":"...","text":"...","display":false}],"report":"tóm tắt ngắn các lỗi đã sửa hoặc xác nhận không thấy lỗi rõ ràng"}. Mỗi id đầu vào phải xuất hiện đúng một lần, giữ nguyên id; display chỉ có ở mục formula. Không thêm markdown fence hay giải thích ngoài JSON.',
    'Giữ nguyên khoảng trắng đầu/cuối trong text. Không trả chuỗi rỗng.',
    JSON.stringify(nodes),
  ].join('\n\n');
  const parsed = parseAssistantJson(await requestAssistant(prompt));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Trợ lý AI trả về danh sách không hợp lệ; nội dung bài chưa được thay đổi.');
  }
  const candidate = parsed as Record<string, unknown>;
  if (!Array.isArray(candidate.items)) {
    throw new Error('Trợ lý AI trả về danh sách không hợp lệ; nội dung bài chưa được thay đổi.');
  }

  const expectedById = new Map(nodes.map((node) => [node.id, node]));
  const items: LessonDocumentAssistantNodeResult[] = [];
  for (const item of candidate.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Trợ lý AI trả về mục không hợp lệ; nội dung bài chưa được thay đổi.');
    }
    const result = item as Record<string, unknown>;
    if (typeof result.id !== 'string'
      || typeof result.text !== 'string'
      || !expectedById.has(result.id)) {
      throw new Error('Trợ lý AI trả về danh sách không khớp; nội dung bài chưa được thay đổi.');
    }
    const original = expectedById.get(result.id);
    if (!original) {
      throw new Error('Trợ lý AI trả về danh sách không khớp; nội dung bài chưa được thay đổi.');
    }
    expectedById.delete(result.id);
    if ((original.text.trim() && !result.text.trim())
      || result.text.length > Math.max(1000, original.text.length * 8)
      || (original.kind === 'text' && /[\r\n]/.test(result.text))) {
      throw new Error('Trợ lý AI trả về nội dung không an toàn; bài chưa được thay đổi.');
    }
    if (original.kind === 'formula') {
      if (typeof result.display !== 'boolean'
        || (original.canChangeDisplay === false && result.display !== original.display)) {
        throw new Error('Trợ lý AI trả về cách xuống dòng công thức không hợp lệ; bài chưa được thay đổi.');
      }
      items.push({ id: result.id, text: result.text, display: result.display });
    } else {
      if (result.display !== undefined) {
        throw new Error('Trợ lý AI trả về định dạng mục văn bản không hợp lệ; bài chưa được thay đổi.');
      }
      items.push({ id: result.id, text: result.text });
    }
  }
  if (expectedById.size > 0) {
    throw new Error('Trợ lý AI chưa xử lý hết nội dung; bài chưa được thay đổi.');
  }

  return { items, report: readReport(candidate.report) };
}
