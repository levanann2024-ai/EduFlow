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
    const { subject, grade, topic, quantity, difficulty } = req.body || {};
    const prompt = requireText(topic, 'Topic');
    const questions = await generateJson({
      type: 'questions',
      prompt: `Tạo ${Number(quantity) || 5} câu hỏi trắc nghiệm môn ${subject || 'bất kỳ'}, ${grade || ''}, chủ đề "${prompt}", mức độ ${difficulty || 'medium'}.`,
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
