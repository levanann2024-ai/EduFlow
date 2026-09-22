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
    const reply = await generateText({
      type: 'chat',
      prompt: `Người dùng hỏi: ${message}`,
    });
    return res.json({ success: true, data: { reply } });
  } catch (error) {
    return sendError(res, error, 'Không thể trả lời trợ lý AI.');
  }
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
