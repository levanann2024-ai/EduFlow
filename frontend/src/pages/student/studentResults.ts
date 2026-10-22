export interface StudentResult {
  id: string;
  name: string;
  subject: string;
  date: string;
  score: number;
}

export const studentResults: StudentResult[] = [
  { id: 'math-1', name: 'Kiểm tra chương 2 · Hàm số', subject: 'Toán học', date: '20/10/2026', score: 8.5 },
  { id: 'physics-1', name: 'Bài kiểm tra 15 phút · Newton', subject: 'Vật lý', date: '18/10/2026', score: 9 },
  { id: 'literature-1', name: 'Đọc hiểu văn bản', subject: 'Ngữ văn', date: '16/10/2026', score: 8 },
  { id: 'math-2', name: 'Bài tập · Phương trình', subject: 'Toán học', date: '12/10/2026', score: 8 },
  { id: 'physics-2', name: 'Thực hành · Lực ma sát', subject: 'Vật lý', date: '10/10/2026', score: 8.5 },
  { id: 'literature-2', name: 'Nghị luận văn học', subject: 'Ngữ văn', date: '08/10/2026', score: 7.5 },
  { id: 'math-3', name: 'Kiểm tra · Hàm số bậc hai', subject: 'Toán học', date: '04/10/2026', score: 7.5 },
  { id: 'physics-3', name: 'Bài tập · Chuyển động thẳng', subject: 'Vật lý', date: '02/10/2026', score: 8 },
  { id: 'literature-3', name: 'Tiếng Việt thực hành', subject: 'Ngữ văn', date: '30/09/2026', score: 8 },
];
