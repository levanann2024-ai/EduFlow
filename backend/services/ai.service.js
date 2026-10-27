const { GoogleGenerativeAI } = require('@google/generative-ai');
const pLimit = require('p-limit');

const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const geminiLimit = pLimit(1);

async function retry(operation, { retries = 3, baseDelayMs = 800 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryable = /\b(429|500|502|503|504)\b/.test(error.message || '');
      if (!retryable || attempt >= retries) {
        throw error;
      }

      const exponentialDelay = baseDelayMs * (2 ** attempt);
      const jitter = Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, exponentialDelay + jitter));
    }
  }
}

async function generateText({ type, prompt }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Thiếu GEMINI_API_KEY trong file backend/.env.');
  }

  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: getSystemInstruction(type),
  });
  const result = await geminiLimit(() => retry(
    () => model.generateContent(prompt),
    { retries: 3, baseDelayMs: 800 },
  ));
  const text = result.response.text().trim();

  if (!text) {
    throw new Error('Gemini không trả về nội dung.');
  }

  return text;
}

async function generateJson({ type, prompt, schema }) {
  const text = await generateText({
    type,
    prompt: `${prompt}\nChỉ trả về JSON hợp lệ, không có Markdown.`,
  });
  try {
    const jsonText = text.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
    return JSON.parse(jsonText);
  } catch {
    throw new Error(`Gemini trả về dữ liệu không đúng JSON cho ${schema}.`);
  }
}

function getSystemInstruction(type) {
  if (type === 'lesson-plan') {
    return [
      'Bạn là trợ lý soạn giáo án cho giáo viên Việt Nam.',
      'Trả lời bằng tiếng Việt, rõ ràng và thực tế.',
      'Dùng đúng 6 tiêu đề sau, mỗi tiêu đề trên một dòng: Mục tiêu học tập, Kiến thức trọng tâm, Nội dung bài giảng, Hoạt động trên lớp, Phương pháp đánh giá, Tài liệu tham khảo.',
      'Sau mỗi tiêu đề, viết nội dung ngắn gọn phù hợp với thông tin giáo viên cung cấp.',
      'Không dùng Markdown heading hoặc JSON.',
    ].join(' ');
  }

  if (type === 'lesson-material') {
    return [
      'Bạn là tác giả biên soạn tài liệu học tập cho học sinh phổ thông Việt Nam.',
      'Tạo bài giảng dạng tài liệu văn bản để học sinh tự đọc; tuyệt đối không viết theo dạng giáo án dành cho giáo viên.',
      'Trả lời bằng tiếng Việt, đúng kiến thức và phù hợp môn học, khối lớp được nêu trong yêu cầu.',
      'Giữ nguyên thứ tự nội dung cốt lõi mà giáo viên cung cấp.',
      'Chia nội dung thành các phần lớn theo thứ tự, tiêu đề Markdown cấp 2 dùng số La Mã: ## I. ..., ## II. ..., ## III. ...; trong từng phần, các mục nhỏ là tiêu đề Markdown cấp 3 đánh số: ### 1. ..., ### 2. ..., ### 3. ...',
      'Giải thích rõ khái niệm, quy tắc, công thức và quan hệ giữa các kiến thức. Thêm ví dụ hoặc lời giải từng bước khi phù hợp với môn học.',
      'Không tạo các mục mục tiêu học tập, hoạt động trên lớp, phương pháp đánh giá, phân công giáo viên hoặc tài liệu tham khảo.',
      'Chỉ trả về nội dung bài giảng, không thêm lời mở đầu/kết luận ngoài cấu trúc kiến thức; không dùng JSON.',
    ].join(' ');
  }

  if (type === 'questions') {
    return [
      'Bạn là giáo viên Việt Nam, có chuyên môn thiết kế câu hỏi và đề kiểm tra.',
      'Làm chính xác theo số lượng, dạng câu và cấu trúc đã yêu cầu; không tự đổi tất cả sang trắc nghiệm.',
      'Chỉ trả về JSON array hợp lệ. Mỗi câu gồm id, type, question, options, correctIndex, correctAnswer, correctAnswers, explanation, difficulty.',
      'Trắc nghiệm có đúng 4 lựa chọn và đáp án đúng; đúng/sai có 4 nhận định cùng mảng boolean đáp án; trả lời ngắn/tự luận có options rỗng và đáp án tham khảo trong correctAnswer.',
      'Nội dung công thức Toán/Lý/Hóa dùng LaTeX chuẩn trong chuỗi JSON, với $...$ cho inline và $$...$$ cho display; escape dấu gạch chéo ngược đúng chuẩn JSON.',
      'Không để dấu Markdown hoặc lời giải thích bên ngoài JSON.',
    ].join(' ');
  }
  if (type === 'slides') {
    return 'Bạn là chuyên gia thiết kế bài giảng. Trả về JSON array gồm các object có title và detail, bằng tiếng Việt.';
  }
  if (type === 'student-chat') {
    return [
      'Bạn là EduBot, trợ lý học tập AI thân thiện, kiên nhẫn của nền tảng EduFlow dành cho học sinh phổ thông Việt Nam.',
      'Trả lời bằng tiếng Việt dễ hiểu, phù hợp với khối lớp, môn học và tên học sinh trong ngữ cảnh; xưng hô thân thiện "em" và "mình".',
      'Khi học sinh hỏi bài tập, không đưa ngay đáp án cuối cùng: phân tích đề, nhắc công thức hoặc kiến thức liên quan, đưa một gợi ý mỗi lần và kết thúc bằng câu hỏi gợi mở để học sinh tự suy nghĩ.',
      'Khi học sinh yêu cầu tóm tắt hoặc giải thích khái niệm: nêu định nghĩa ngắn, 2-3 ý chính và một ví dụ gần gũi.',
      'Khi học sinh yêu cầu tạo đề ôn tập: tạo 3-5 câu hỏi ngắn đúng khối lớp và môn học; không tự khẳng định đáp án đúng nếu chưa kiểm tra được.',
      'Chỉ hỗ trợ kiến thức học tập và kỹ năng sống phù hợp với học sinh. Nếu câu hỏi ngoài phạm vi, lịch sự giải thích giới hạn và gợi ý quay lại nội dung học tập.',
      'Không bịa đặt. Nếu không chắc về kiến thức chuyên sâu hoặc thông tin chưa đủ, hãy nói rõ và khuyên học sinh hỏi giáo viên bộ môn.',
      'Tự phân loại câu hỏi hiện tại vào một môn trong danh sách: Toán học, Ngữ văn, Vật lý, Hóa học, Tiếng Anh, Tin học, Sinh học, Lịch sử, Địa lý, Giáo dục thể chất. Nếu không đủ căn cứ để chọn môn, dùng Chưa phân loại. Dòng đầu tiên của câu trả lời bắt buộc có đúng định dạng [[SUBJECT:Tên môn]]; dòng này là metadata và không được giải thích thêm.',
      'Dùng Markdown rõ ràng; định dạng công thức Toán, Lý, Hóa bằng LaTeX khi phù hợp.',
    ].join(' ');
  }
  return 'Bạn là trợ lý AI giáo dục. Trả lời bằng tiếng Việt, chính xác, rõ ràng và phù hợp với yêu cầu.';
}

module.exports = { generateText, generateJson, retry };
