import { authenticatedFetch } from '@/auth/authApi';

export type LessonDocumentAssistantAction = 'latex' | 'polish' | 'check';
export type LessonDocumentAssistantNode = { id: string; text: string; context?: string };
export type LessonDocumentAssistantNodeResult = { id: string; text: string };

const compactRule = ' Trình bày gọn: không chèn quá một dòng trống liên tiếp, không để dòng trống giữa các mục danh sách hoặc giữa tiêu đề và nội dung ngay sau nó, không dùng dòng "---" ngăn cách thừa.';

const requests: Record<LessonDocumentAssistantAction, string> = {
  latex: `Hãy sửa và chuẩn hóa các công thức Toán, Lý, Hóa trong tài liệu sau bằng cú pháp LaTeX đúng chuẩn KaTeX: công thức trong dòng đặt giữa $...$, công thức độc lập đặt giữa $$...$$. Công thức hóa học viết bằng \\mathrm{}, ví dụ $\\mathrm{N_2 + 3H_2 \\rightleftharpoons 2NH_3}$ (không dùng \\text{} cho từng ký hiệu, không dùng \\ce). Đơn vị viết bằng \\mathrm{} hoặc \\text{}. Không dùng ký hiệu in nghiêng bằng dấu * bao quanh công thức. Giữ nguyên nội dung khác và chỉ trả về bản đã xử lý.${compactRule}`,
  polish: `Hãy trình bày lại tài liệu sau cho rõ ràng, đẹp, có tiêu đề và danh sách hợp lý nếu phù hợp. Giữ nguyên ý nghĩa và chỉ trả về nội dung đã trình bày.${compactRule}`,
  check: 'Hãy kiểm tra tài liệu sau về lỗi chính tả, ngữ pháp, diễn đạt và công thức. Không viết lại tài liệu; trả về danh sách lỗi phát hiện và đề xuất sửa, hoặc xác nhận chưa thấy lỗi rõ ràng.',
};

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

export async function runLessonDocumentAssistant(
  action: LessonDocumentAssistantAction,
  content: string,
): Promise<string> {
  if (!content.trim()) throw new Error('Chưa có nội dung để xử lý.');
  return requestAssistant(`${requests[action]}\n\n${content}`);
}

export async function runLessonDocumentAssistantOnNodes(
  action: Exclude<LessonDocumentAssistantAction, 'check'>,
  nodes: LessonDocumentAssistantNode[],
): Promise<LessonDocumentAssistantNodeResult[]> {
  if (nodes.length === 0) throw new Error('Chưa có nội dung phù hợp để xử lý.');

  const instructions = action === 'latex'
    ? 'Chuẩn hóa từng công thức LaTeX riêng lẻ để dùng được với KaTeX. Chỉ sửa trường text (nguồn LaTeX), không thêm dấu phân cách $, không đổi ý nghĩa toán học.'
    : 'Cải thiện chính tả và cách diễn đạt cho từng mẩu văn bản, dùng context để hiểu ý. Giữ nguyên ý nghĩa, tên riêng, số liệu và ranh giới của từng mẩu. Chỉ trả plain text, không thêm cú pháp Markdown.';
  const prompt = [
    instructions,
    'Đầu vào là một mảng JSON các mục có id, text và có thể có context.',
    'Chỉ trả về một mảng JSON hợp lệ gồm đúng một mục {id, text} cho mỗi id đầu vào; giữ nguyên id, không thêm hoặc bỏ mục, không kèm giải thích hay markdown fence.',
    'Với nội dung text có khoảng trắng đầu/cuối, giữ nguyên các khoảng trắng đó.',
    JSON.stringify(nodes),
  ].join('\n\n');
  const rawResult = await requestAssistant(prompt);
  let parsed: unknown;
  try {
    const jsonResult = rawResult.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    parsed = JSON.parse(jsonResult);
  } catch {
    throw new Error('Trợ lý AI trả về kết quả không đúng định dạng; nội dung bài chưa được thay đổi.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Trợ lý AI trả về danh sách không hợp lệ; nội dung bài chưa được thay đổi.');
  }

  const expectedIds = new Set(nodes.map(({ id }) => id));
  const originalById = new Map(nodes.map(({ id, text }) => [id, text]));
  const results: LessonDocumentAssistantNodeResult[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Trợ lý AI trả về mục không hợp lệ; nội dung bài chưa được thay đổi.');
    }
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== 'string'
      || !expectedIds.delete(candidate.id)
      || typeof candidate.text !== 'string') {
      throw new Error('Trợ lý AI trả về danh sách không khớp; nội dung bài chưa được thay đổi.');
    }
    const original = originalById.get(candidate.id) ?? '';
    if ((original.trim() && !candidate.text.trim())
      || candidate.text.length > Math.max(1000, original.length * 8)) {
      throw new Error('Trợ lý AI trả về nội dung không an toàn; nội dung bài chưa được thay đổi.');
    }
    results.push({ id: candidate.id, text: candidate.text });
  }
  if (expectedIds.size > 0) {
    throw new Error('Trợ lý AI chưa xử lý hết nội dung; nội dung bài chưa được thay đổi.');
  }
  return results;
}
