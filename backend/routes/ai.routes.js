const express = require('express');
const {
  testAI,
  chatAI,
  generateQuestions,
  generateSlides,
  generateLessonPlan,
  generateAI,
} = require('../controllers/ai.controller');

const router = express.Router();

router.post('/test', testAI);
router.post('/chat', chatAI);
router.post('/questions', generateQuestions);
router.post('/slides', generateSlides);
router.post('/lesson-plan', generateLessonPlan);
router.post('/', generateAI);

module.exports = router;
