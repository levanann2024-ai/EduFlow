const express = require('express');
const multer = require('multer');
const { requireRole } = require('../auth/middleware');
const {
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
} = require('../controllers/ai.controller');

const router = express.Router();
const chatImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 12, parts: 13 },
}).single('image');

function parseChatRequest(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  chatImageUpload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        success: false,
        code: tooLarge ? 'AI_CHAT_IMAGE_TOO_LARGE' : 'AI_CHAT_INVALID_UPLOAD',
        message: tooLarge ? 'Ảnh đính kèm không được vượt quá 5 MB.' : 'Yêu cầu tải ảnh không hợp lệ.',
      });
    }
    if (error) return next(error);
    return next();
  });
}

router.post('/test', testAI);
router.post('/chat', parseChatRequest, chatAI);
router.get('/conversations', listAIConversations);
router.post('/conversations/import-legacy', importLegacyAIConversations);
router.get('/conversations/:conversationId/messages/:messageId/image', getAIConversationImage);
router.get('/conversations/:conversationId', getAIConversation);
router.delete('/conversations/:conversationId', deleteAIConversation);
router.post('/format-answer', requireRole('student'), formatStudentAnswer);
router.post('/questions', generateQuestions);
router.post('/slides', generateSlides);
router.post('/lesson-plan', generateLessonPlan);
router.post('/', generateAI);

module.exports = router;
