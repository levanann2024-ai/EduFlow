const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { generateText, generateJson, generateGroundedJson } = require('../services/ai.service');
const getStudentChatContext = require('../services/studentChatContext.service').createStudentChatContextService();
const getTeacherChatContext = require('../services/teacherChatContext.service').createTeacherChatContextService();
const aiChatHistory = require('../services/aiChatHistory.service');

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${field} không được để trống.`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

function parseOptionalJson(value, field) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    const error = new Error(`${field} không đúng định dạng.`);
    error.statusCode = 400;
    throw error;
  }
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
  const requestStartedAt = performance.now();
  const performanceMetrics = {
    requestId: randomUUID(),
    contextPreparationMs: null,
    geminiRequestSetupMs: null,
    queueWaitMs: null,
    geminiResponseMs: null,
    retryCount: 0,
  };
  try {
    const message = requireText(req.body?.message, 'Message');
    const isStudent = req.auth?.role === 'student';
    const isTeacher = req.auth?.role === 'lecturer';
    const imageAttachment = req.file ? aiChatHistory.validateImageAttachment(req.file) : null;
    const subject = optionalContext(req.body?.subject, 'chưa chọn môn');
    const explanationStyle = ['concise', 'detailed', 'thinking'].includes(req.body?.explanationStyle)
      ? req.body.explanationStyle
      : 'detailed';
    const styleInstruction = explanationStyle === 'concise'
      ? 'Giải thẳng vào yêu cầu, đưa lời giải hoặc đáp án trực tiếp, dùng ít lời; không hỏi gợi mở ở cuối. Chỉ hỏi lại khi thiếu dữ kiện thiết yếu.'
      : explanationStyle === 'thinking'
        ? 'Dẫn dắt người dùng tự suy nghĩ từng bước: nêu một gợi ý ngắn rồi hỏi một câu cụ thể để người dùng trả lời. Chưa đưa đáp án cuối cùng ngay, trừ khi người dùng yêu cầu xem lời giải trực tiếp.'
        : 'Giải trực tiếp và đầy đủ từng bước, giải thích lý do và nêu kết quả rõ ràng; không hỏi gợi mở ở cuối. Chỉ hỏi lại khi thiếu dữ kiện thiết yếu.';
    if (message.length > 12000) {
      const error = new Error('Câu hỏi không được vượt quá 12.000 ký tự.');
      error.statusCode = 413;
      throw error;
    }
    const conversationId = req.body?.conversationId ?? null;
    const previousConversation = conversationId
      ? await aiChatHistory.getConversation(req.auth, conversationId)
      : null;
    const conversationHistory = previousConversation?.messages.slice(-20).map(({ role, content }) => ({
      role,
      content,
    })) ?? [];
    const studentContext = isStudent
      ? await getStudentChatContext(req.auth, parseOptionalJson(req.body?.weeklyPlanContext, 'Kế hoạch tuần'))
      : null;
    const teacherContext = isTeacher ? await getTeacherChatContext(req.auth) : null;
    const grade = isStudent
      ? optionalContext(String(studentContext.classes[0]?.grade ?? ''), 'chưa xác định')
      : optionalContext(req.body?.grade, 'chưa xác định');
    const contextPrompt = [
      conversationHistory.length
        ? `Lịch sử trò chuyện gần đây (JSON):\n${JSON.stringify(conversationHistory)}`
        : '',
      isStudent
        ? `Dữ liệu học tập riêng của học sinh (JSON; chỉ dùng phần liên quan trực tiếp đến câu hỏi):\n${JSON.stringify(studentContext)}`
        : '',
      isTeacher
        ? `Dữ liệu công việc giáo viên được phân công (JSON; chỉ dùng phần liên quan trực tiếp đến câu hỏi):\n${JSON.stringify(teacherContext)}`
        : '',
      isStudent || isTeacher ? `Câu hỏi hiện tại: ${message}` : `Người dùng hỏi: ${message}`,
    ].filter(Boolean).join('\n');
    const prompt = isStudent ? [
      `Khối lớp: ${grade}.`,
      `Môn học từ ngữ cảnh trước (chỉ dùng nếu phù hợp): ${subject}.`,
      `Phong cách trả lời đã chọn: ${styleInstruction}`,
      contextPrompt,
    ].join('\n') : isTeacher ? [
      `Phong cách trả lời đã chọn: ${styleInstruction}`,
      contextPrompt,
    ].join('\n') : [
      `Phong cách trả lời đã chọn: ${styleInstruction}`,
      contextPrompt,
    ].join('\n');
    const generationPrompt = imageAttachment
      ? [
        { text: prompt },
        { inlineData: { mimeType: imageAttachment.mimeType, data: imageAttachment.content.toString('base64') } },
      ]
      : prompt;
    performanceMetrics.contextPreparationMs = performance.now() - requestStartedAt;
    const generatedReply = await generateText({
      type: isStudent ? 'student-chat' : isTeacher ? 'teacher-chat' : 'chat',
      teacherGender: isTeacher ? req.auth?.gender : null,
      performanceMetrics,
      prompt: generationPrompt,
    });
    const subjectMatch = isStudent ? generatedReply.match(/^\[\[SUBJECT:([^\]]+)\]\]\s*/) : null;
    const allowedSubjects = ['Toán học', 'Ngữ văn', 'Vật lý', 'Hóa học', 'Tiếng Anh', 'Tin học', 'Sinh học', 'Lịch sử', 'Địa lý', 'Giáo dục thể chất', 'Chưa phân loại'];
    const detectedSubject = subjectMatch && allowedSubjects.includes(subjectMatch[1])
      ? subjectMatch[1]
      : '';
    const reply = subjectMatch ? generatedReply.slice(subjectMatch[0].length).trim() : generatedReply;
    const savedTurn = await aiChatHistory.saveConversationTurn(req.auth, {
      conversationId,
      message,
      reply,
      subject: detectedSubject === 'Chưa phân loại' ? '' : detectedSubject,
      image: req.file ?? null,
    });
    return res.json({
      success: true,
      data: {
        reply,
        ...(isStudent ? { subject: detectedSubject || 'Chưa phân loại' } : {}),
        conversationId: savedTurn.conversationId,
        userMessageId: savedTurn.userMessageId,
        assistantMessageId: savedTurn.assistantMessageId,
      },
    });
  } catch (error) {
    return sendError(res, error, 'Không thể trả lời trợ lý AI.');
  } finally {
    console.log([
      '[AI PERFORMANCE]',
      `Request ID: ${performanceMetrics.requestId}`,
      `Queue wait: ${formatPerformanceDuration(performanceMetrics.queueWaitMs)}`,
      `Context preparation: ${formatPerformanceDuration(performanceMetrics.contextPreparationMs)}`,
      `Gemini request setup: ${formatPerformanceDuration(performanceMetrics.geminiRequestSetupMs)}`,
      `Gemini response: ${formatPerformanceDuration(performanceMetrics.geminiResponseMs)}`,
      `Retry count: ${performanceMetrics.retryCount}`,
      `Total duration: ${formatPerformanceDuration(performance.now() - requestStartedAt)}`,
    ].join('\n'));
  }
}

function formatPerformanceDuration(durationMs) {
  return Number.isFinite(durationMs) ? `${(durationMs / 1000).toFixed(2)}s` : 'N/A';
}

async function listAIConversations(req, res) {
  try {
    const conversations = await aiChatHistory.listConversations(req.auth);
    return res.json({ success: true, data: { conversations } });
  } catch (error) {
    return sendError(res, error, 'Không thể tải lịch sử trò chuyện.');
  }
}

async function getAIConversation(req, res) {
  try {
    const conversation = await aiChatHistory.getConversation(req.auth, req.params.conversationId);
    return res.json({ success: true, data: { conversation } });
  } catch (error) {
    return sendError(res, error, 'Không thể tải cuộc trò chuyện.');
  }
}

async function getAIConversationImage(req, res) {
  try {
    const image = await aiChatHistory.getConversationImage(
      req.auth,
      req.params.conversationId,
      req.params.messageId,
    );
    res.set('Content-Type', image.mimeType);
    const encodedFileName = encodeURIComponent(image.fileName).replace(/['()*]/g, (character) => (
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`
    ));
    res.set('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    return res.send(image.content);
  } catch (error) {
    return sendError(res, error, 'Không thể tải ảnh trong cuộc trò chuyện.');
  }
}

async function deleteAIConversation(req, res) {
  try {
    const result = await aiChatHistory.deleteConversation(req.auth, req.params.conversationId);
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendError(res, error, 'Không thể xóa cuộc trò chuyện.');
  }
}

async function importLegacyAIConversations(req, res) {
  try {
    const result = await aiChatHistory.importLegacyConversations(req.auth, req.body?.conversations);
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendError(res, error, 'Không thể chuyển lịch sử chat cũ.');
  }
}

async function formatStudentAnswer(req, res) {
  const text = req.body?.text;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, message: 'Câu trả lời không được để trống.' });
  }
  if (text.length > 12000) {
    return res.status(400).json({ success: false, message: 'Câu trả lời cần chuẩn hóa không được vượt quá 12.000 ký tự.' });
  }

  try {
    const formattedText = await generateText({
      type: 'student-answer-format',
      modelName: process.env.GEMINI_FORMAT_MODEL || 'gemini-3.5-flash-lite',
      prompt: `Hãy chuẩn hóa câu trả lời sau:\n<student_answer>\n${text.trim()}\n</student_answer>`,
    });
    const normalizedText = formattedText
      .replace(/^```(?:text|markdown)?\s*|\s*```$/gi, '')
      .trim();
    if (!normalizedText) {
      throw new Error('Gemini không trả về câu trả lời đã chuẩn hóa.');
    }
    if (normalizedText.length > 20000) {
      throw new Error('Câu trả lời sau khi chuẩn hóa vượt quá giới hạn lưu trữ.');
    }
    return res.json({ success: true, data: { formattedText: normalizedText } });
  } catch (error) {
    return sendError(res, error, 'Không thể chuẩn hóa ký hiệu trong câu trả lời.');
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
    const subjectContext = typeof subject === 'string' && subject.trim()
      ? ` môn ${subject.trim()}`
      : '';
    const gradeContext = typeof grade === 'string' && grade.trim()
      ? `, khối lớp ${grade.trim()}`
      : '';
    const questionPrompt = [
        `Tạo chính xác ${safeQuantity} câu hỏi${subjectContext}${gradeContext}, chủ đề/nội dung "${prompt}", mức độ ${difficulty || 'medium'}.`,
        'Bám sát phạm vi kiến thức trong chủ đề/nội dung được cung cấp; nếu không nêu môn học, tự xác định lĩnh vực phù hợp từ nội dung, không tự gắn môn học hoặc đưa kiến thức ngoài phạm vi.',
        formatInstruction,
        req.body?.useWebGrounding === true ? [
          'Bắt buộc sử dụng kết quả tìm kiếm Google Search được cung cấp qua công cụ grounding, không dựa riêng vào trí nhớ của mô hình.',
          'Chỉ nêu thông tin thực tế có thể đối chiếu với các nguồn tìm được; ưu tiên nguồn sơ cấp/chính thức, nhà xuất bản, cơ quan giáo dục hoặc tổ chức uy tín.',
          'Không bịa nhan đề, tác giả, trích dẫn, xuất xứ, dữ kiện, câu hỏi, đáp án hoặc nội dung văn bản. Không coi đoạn trích kết quả tìm kiếm ngắn là toàn văn.',
          'Nếu giáo viên đã dán toàn văn, dùng chính văn bản đó và tìm nguồn web để kiểm chứng thông tin liên quan. Nếu chưa có toàn văn, chỉ dùng toàn văn truy cập được từ nguồn công cộng thuộc phạm vi công cộng hoặc có giấy phép mở; không chép tác phẩm có bản quyền.',
          'Không tạo câu hỏi đọc hiểu nếu chỉ tìm thấy tiêu đề, mô tả hoặc đoạn trích ngắn mà không truy cập được toàn văn hợp pháp. Khi không tìm thấy nguồn đáng tin cậy hoặc không thể xác minh, trả về [] thay vì suy đoán.',
          'Trong câu đọc hiểu đầu tiên, ghi nhan đề và URL nguồn chính thống để học sinh có thể mở văn bản gốc. Không sao chép dài nội dung có bản quyền vào câu hỏi.',
        ].join('\n') : '',
        'Trả về JSON array. Mỗi phần tử phải có id, type, question, options, correctIndex, correctAnswer, correctAnswers, points, explanation, difficulty.',
        'type phải là multiple-choice, true-false, short-answer hoặc essay.',
        'multiple-choice: options có đúng 4 phương án, correctIndex từ 0 đến 3, correctAnswer ghi nguyên văn đáp án đúng.',
        'true-false: options có đúng 4 nhận định ngắn, correctAnswers là mảng 4 giá trị boolean tương ứng, correctAnswer ghi tóm tắt các nhận định đúng/sai.',
        'short-answer: options là mảng rỗng, correctAnswer chứa đáp án ngắn và các đáp án tương đương (nếu có) phân tách bằng ||; không bịa đáp án duy nhất nếu câu hỏi mở.',
        'essay: options là mảng rỗng, correctAnswer chứa các ý cần có hoặc hướng dẫn chấm, giáo viên sẽ chấm thủ công.',
        'points là điểm tối đa của câu, không mặc định tất cả đều 1: dùng mức nền gợi ý multiple-choice 0.25, true-false 1, short-answer 0.5, essay 2; tăng/giảm theo độ khó, công sức và độ phức tạp. Đúng/sai có 4 ý và áp dụng điểm thành phần theo rubric.',
        'Với nội dung Toán, Lý, Hóa, dùng cú pháp LaTeX hợp lệ cho công thức: $...$ cho công thức trong dòng và $$...$$ cho công thức riêng dòng. Trong chuỗi JSON, escape dấu gạch chéo ngược theo chuẩn JSON. Không dùng dấu $ thừa, không đặt toàn bộ câu hỏi trong công thức.',
        'Giải thích ngắn gọn cách xác định đáp án; bảo đảm đáp án nhất quán với câu hỏi và lựa chọn.',
      ].filter(Boolean).join('\n');
    const generated = req.body?.useWebGrounding === true
      ? await generateGroundedJson({
        type: 'questions',
        prompt: questionPrompt,
        schema: 'questions',
      })
      : await generateJson({
        type: 'questions',
        prompt: questionPrompt,
        schema: 'questions',
      });
    const questions = req.body?.useWebGrounding === true ? generated.data : generated;
    if (!Array.isArray(questions) || questions.length !== safeQuantity) {
      const error = new Error('Không đủ nguồn đáng tin cậy để tạo đủ số câu mà không suy đoán.');
      error.statusCode = 422;
      throw error;
    }
    return res.json({
      success: true,
      data: questions,
      ...(req.body?.useWebGrounding === true ? {
        sources: generated.sources,
        searchQueries: generated.searchQueries,
      } : {}),
    });
  } catch (error) {
    return sendError(res, error, 'Không thể tạo câu hỏi.');
  }
}

async function generateSlides(req, res) {
  try {
    const { topic, subject, content, textbook, volume, grade, slideCount, style } = req.body || {};
    const lessonTopic = requireText(topic, 'Topic');
    const bookContext = [textbook, volume]
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim())
      .join(', ');
    const slides = await generateJson({
      type: 'slides',
      prompt: [
        `Tạo cấu trúc ${Number.parseInt(slideCount, 10) || 8} slide về "${lessonTopic}".`,
        `Môn học: ${typeof subject === 'string' && subject.trim() ? subject.trim() : 'chưa được cung cấp'}.`,
        `Bộ sách và tập tham chiếu: ${bookContext || 'chưa được cung cấp'}.`,
        `Khối lớp: ${typeof grade === 'string' && grade.trim() ? grade.trim() : 'chưa được cung cấp'}.`,
        `Nội dung chính: ${content || 'Tự đề xuất nội dung phù hợp'}.`,
        `Phong cách: ${style || 'Trực quan'}.`,
        'Bám sát môn học đã chọn, bộ sách, tập, khối lớp và chủ đề; không suy đoán môn khác hoặc thêm nội dung ngoài phạm vi.',
      ].join('\n'),
      schema: 'slides',
    });
    return res.json({ success: true, data: slides });
  } catch (error) {
    return sendError(res, error, 'Không thể tạo slide.');
  }
}

async function generateLessonPlan(req, res) {
  try {
    const { textbook, volume, grade, topic, subject, duration, method, difficulty } = req.body || {};
    const lessonTopic = requireText(topic, 'Topic');
    const bookContext = [textbook, volume]
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim())
      .join(', ');
    const data = await generateText({
      type: 'lesson-plan',
      prompt: `Tạo giáo án môn ${typeof subject === 'string' && subject.trim() ? subject.trim() : 'chưa được giáo viên chọn'}, cho ${grade || ''}, theo sách giáo khoa ${bookContext || 'chưa được cung cấp'}. Chủ đề: ${lessonTopic}. Thời lượng: ${duration || 45} phút. Phương pháp: ${method || ''}. Mức độ: ${difficulty || 'medium'}. Chỉ triển khai kiến thức thuộc môn học đã chọn; không suy đoán hoặc đưa nội dung không liên quan.`,
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
  listAIConversations,
  getAIConversation,
  getAIConversationImage,
  deleteAIConversation,
  importLegacyAIConversations,
  formatStudentAnswer,
  generateQuestions,
  generateSlides,
  generateLessonPlan,
  generateAI,
};
