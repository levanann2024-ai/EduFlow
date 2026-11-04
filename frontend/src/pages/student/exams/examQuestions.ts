export type QuestionKind = 'choice' | 'true-false' | 'short' | 'essay';

export interface ExamQuestion {
  id: number;
  displayNumber?: number;
  kind: QuestionKind;
  prompt: string;
  points: number;
  sectionId?: string;
  sectionTitle?: string;
  sectionInstruction?: string;
  options?: string[];
  statements?: string[];
  correctAnswer: string | Record<number, string>;
}

export const examQuestions: ExamQuestion[] = [
  {
    id: 1,
    kind: 'choice',
    points: 0.5,
    prompt: 'Giá trị nhỏ nhất của hàm số f(x) = (x − 2)² + 1 là:',
    options: ['1', '2', '3', '4'],
    correctAnswer: '0',
  },
  {
    id: 2,
    kind: 'choice',
    points: 0.5,
    prompt: 'Nghiệm của phương trình 2x + 3 = 7 là:',
    options: ['1', '2', '3', '5'],
    correctAnswer: '1',
  },
  {
    id: 3,
    kind: 'choice',
    points: 0.5,
    prompt: 'Tam giác có đáy 6 cm và chiều cao 4 cm có diện tích là:',
    options: ['10 cm²', '20 cm²', '12 cm²', '24 cm²'],
    correctAnswer: '2',
  },
  {
    id: 4,
    kind: 'true-false',
    points: 0.5,
    prompt: 'Xác định mỗi mệnh đề sau là đúng hay sai.',
    statements: [
      'Đồ thị hàm số y = x² là một parabol.',
      'Phương trình x² = 9 có hai nghiệm thực.',
      'Tích của hai số âm là một số âm.',
      'Căn bậc hai số học của 25 bằng 5.',
    ],
    correctAnswer: { 0: 'Đúng', 1: 'Đúng', 2: 'Sai', 3: 'Đúng' },
  },
  {
    id: 5,
    kind: 'true-false',
    points: 0.5,
    prompt: 'Xét các phép tính và tính chất sau.',
    statements: [
      '3/4 lớn hơn 2/3.',
      'Tổng hai góc nhọn trong một tam giác luôn bằng 90°.',
      'Số 0 là số nguyên.',
      'Với mọi số thực a, a² luôn không âm.',
    ],
    correctAnswer: { 0: 'Đúng', 1: 'Sai', 2: 'Đúng', 3: 'Đúng' },
  },
  {
    id: 6,
    kind: 'short',
    points: 0.5,
    prompt: 'Tính tích phân ∫₀¹ 2x dx. Nhập đáp án hoặc biểu thức LaTeX.',
    correctAnswer: '1',
  },
  {
    id: 7,
    kind: 'short',
    points: 0.5,
    prompt: 'Tìm nghiệm dương của phương trình x² = 9. Có thể nhập đáp án bằng LaTeX.',
    correctAnswer: '3',
  },
  {
    id: 8,
    kind: 'essay',
    points: 0.5,
    prompt: 'Giải phương trình x² − 5x + 6 = 0 và trình bày các bước lập luận.',
    correctAnswer: 'x = 2, x = 3',
  },
  {
    id: 9,
    kind: 'essay',
    points: 0.5,
    prompt: 'Tính diện tích hình chữ nhật có chiều dài 3x và chiều rộng 2. Trình bày lời giải bằng biểu thức hoặc công thức LaTeX.',
    correctAnswer: '6x',
  },
  {
    id: 10,
    kind: 'essay',
    points: 0.5,
    prompt: 'Trình bày cách giải một bài toán em còn băn khoăn. Em có thể nhập công thức LaTeX hoặc tải/chụp ảnh bài làm.',
    correctAnswer: '',
  },
];
