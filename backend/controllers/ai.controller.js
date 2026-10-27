const { generateText, generateJson } = require('../services/ai.service');

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${field} không được để trống.`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

async function testAI(req, res) {
  try {
    const prompt = requireText(req.body?.prompt, 'Prompt');
    const reply = await generateText({ type: 'test', prompt });
    return res.json({ success: true, data: { reply } });
  } catch (error) {
    return sendError(res, error, 'AI test thất bại.');
  }
}

async function chatAI(req, res) {
  try {
    const message = requireText(req.body?.message, 'Message');
    const isStudent = req.body?.role === 'student';
    const userName = optionalContext(req.body?.userName, 'bạn');
    const grade = optionalContext(req.body?.grade, 'chưa xác định');
    const subject = optionalContext(req.body?.subject, 'chưa chọn môn');
    const explanationStyle = req.body?.explanationStyle === 'concise' ? 'concise' : 'detailed';
    const generatedReply = await generateText({
      type: isStudent ? 'student-chat' : 'chat',
      prompt: isStudent ? [
        `Tên học sinh: ${userName}.`,
        `Khối lớp: ${grade}.`,
        `Môn học từ ngữ cảnh trước (chỉ dùng nếu phù hợp): ${subject}.`,
        `Cách giải thích: ${explanationStyle === 'concise' ? 'ngắn gọn, tập trung vào ý chính' : 'chi tiết, từng bước và kèm ví dụ phù hợp'}.`,
        `Câu hỏi của học sinh: ${message}`,
      ].join('\n') : `Người dùng hỏi: ${message}`,
    });
    if (!isStudent) {
      return res.json({ success: true, data: { reply: generatedReply } });
    }

    const subjectMatch = generatedReply.match(/^\[\[SUBJECT:([^\]]+)\]\]\s*/);
    const allowedSubjects = ['Toán học', 'Ngữ văn', 'Vật lý', 'Hóa học', 'Tiếng Anh', 'Tin học', 'Sinh học', 'Lịch sử', 'Địa lý', 'Giáo dục thể chất', 'Chưa phân loại'];
    const detectedSubject = subjectMatch && allowedSubjects.includes(subjectMatch[1])
      ? subjectMatch[1]
      : 'Chưa phân loại';
    const reply = subjectMatch ? generatedReply.slice(subjectMatch[0].length).trim() : generatedReply;
    return res.json({ success: true, data: { reply, subject: detectedSubject } });
  } catch (error) {
    return sendError(res, error, 'Không thể trả lời trợ lý AI.');
  }
}

function optionalContext(value, fallback) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 80)
    : fallback;
}

async function generateQuestions(req, res) {
  try {
    const {
      subject,
      grade,
      topic,
      quantity,
      difficulty,
      questionFormat = 'multiple-choice',
      questionStructure,
    } = req.body || {};
    const prompt = requireText(topic, 'Topic');
    const supportedTypes = ['multiple-choice', 'true-false', 'short-answer', 'essay'];
    const safeQuantity = Number(quantity);
    if (!Number.isInteger(safeQuantity) || safeQuantity < 1 || safeQuantity > 50) {
      const error = new Error('Số câu hỏi phải là số nguyên từ 1 đến 50.');
      error.statusCode = 400;
      throw error;
    }
    if (!['free', ...supportedTypes].includes(questionFormat)) {
      const error = new Error('Hình thức câu hỏi không được hỗ trợ.');
      error.statusCode = 400;
      throw error;
    }
    const structure = Array.isArray(questionStructure)
      ? questionStructure.filter((section) => (
        section
        && supportedTypes.includes(section.type)
        && Number.isInteger(section.count)
        && section.count > 0
      )).slice(0, 4)
      : [];
    const structureCount = structure.reduce((total, section) => total + section.count, 0);
    if (questionStructure !== undefined && structureCount !== safeQuantity) {
      const error = new Error('Tổng số câu trong cấu trúc đề không khớp số câu yêu cầu.');
      error.statusCode = 400;
      throw error;
    }
    const formatInstruction = structure.length
      ? `Tạo đúng số câu theo thứ tự và số lượng từng dạng sau: ${structure.map((section) => `${section.type}: ${section.count} câu`).join('; ')}.`
      : questionFormat === 'free'
        ? 'Tự chọn ngẫu nhiên và phối hợp các dạng trắc nghiệm, đúng/sai, trả lời ngắn và tự luận. Nếu có từ 4 câu trở lên, phải có ít nhất một câu mỗi dạng; không để trắc nghiệm chiếm quá một nửa số câu. Mỗi lần tạo có thể phối hợp khác nhau.'
        : `Tất cả câu hỏi phải thuộc dạng ${questionFormat}.`;
    const questions = await generateJson({
      type: 'questions',
      prompt: [
        `Tạo chính xác ${safeQuantity} câu hỏi môn ${subject || 'bất kỳ'}, ${grade || ''}, chủ đề/nội dung "${prompt}", mức độ ${difficulty || 'medium'}.`,
        formatInstruction,
        'Trả về JSON array. Mỗi phần tử phải có id, type, question, options, correctIndex, correctAnswer, correctAnswers, explanation, difficulty.',
        'type phải là multiple-choice, true-false, short-answer hoặc essay.',
        'multiple-choice: options có đúng 4 phương án, correctIndex từ 0 đến 3, correctAnswer ghi nguyên văn đáp án đúng.',
        'true-false: options có 4 nhận định ngắn, correctAnswers là mảng 4 giá trị boolean tương ứng, correctAnswer ghi tóm tắt các nhận định đúng/sai.',
        'short-answer và essay: options là mảng rỗng, correctAnswer chứa đáp án tham khảo hoặc các ý cần có; không bịa đáp án duy nhất nếu câu hỏi mở.',
        'Với nội dung Toán, Lý, Hóa, dùng cú pháp LaTeX hợp lệ cho công thức: $...$ cho công thức trong dòng và $$...$$ cho công thức riêng dòng. Trong chuỗi JSON, escape dấu gạch chéo ngược theo chuẩn JSON. Không dùng dấu $ thừa, không đặt toàn bộ câu hỏi trong công thức.',
        'Giải thích ngắn gọn cách xác định đáp án; bảo đảm đáp án nhất quán với câu hỏi và lựa chọn.',
      ].join('\n'),
      schema: 'questions',
    });
    return res.json({ success: true, data: questions });
  } catch (error) {
    return sendError(res, error, 'Không thể tạo câu hỏi.');
  }
}

async function generateSlides(req, res) {
  try {
    const { topic, content, slideCount, style } = req.body || {};
    const subject = requireText(topic, 'Topic');
    const slides = await generateJson({
      type: 'slides',
      prompt: `Tạo cấu trúc ${Number.parseInt(slideCount, 10) || 8} slide về "${subject}". Nội dung chính: ${content || 'Tự đề xuất nội dung phù hợp'}. Phong cách: ${style || 'Trực quan'}.`,
      schema: 'slides',
    });
    return res.json({ success: true, data: slides });
  } catch (error) {
    return sendError(res, error, 'Không thể tạo slide.');
  }
}

async function generateLessonPlan(req, res) {
  try {
    const { subject, grade, topic, duration, method, difficulty } = req.body || {};
    const lessonTopic = requireText(topic, 'Topic');
    const data = await generateText({
      type: 'lesson-plan',
      prompt: `Tạo giáo án môn ${subject || ''}, ${grade || ''}. Chủ đề: ${lessonTopic}. Thời lượng: ${duration || 45} phút. Phương pháp: ${method || ''}. Mức độ: ${difficulty || 'medium'}.`,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'Không thể tạo giáo án.');
  }
}

async function generateAI(req, res) {
  const { type, prompt } = req.body || {};

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ success: false, message: 'Prompt không được để trống.' });
  }

  try {
    const data = await generateText({ type, prompt: prompt.trim() });
    return res.json({ success: true, data });
  } catch (error) {
    console.error('AI generation failed:', error);
    return sendError(res, error, 'Không thể tạo nội dung AI.');
  }
}

function sendError(res, error, fallback) {
  console.error('AI request failed:', error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallback,
  });
}

module.exports = {
  testAI,
  chatAI,
  generateQuestions,
  generateSlides,
  generateLessonPlan,
  generateAI,
};
