export interface AISubjectExamples {
  topic: string;
  content: string;
  outline: string;
}

const subjectExamples: Record<string, AISubjectExamples> = {
  'Toán học': {
    topic: 'Hàm số bậc hai và đồ thị parabol',
    content: 'Ôn tập đỉnh, trục đối xứng và cách vẽ đồ thị parabol qua ví dụ.',
    outline: '- Ôn tập hàm số bậc nhất\n- Khảo sát hàm số bậc hai\n- Luyện tập vẽ đồ thị parabol',
  },
  'Ngữ văn': {
    topic: 'Đọc hiểu truyện ngắn và phân tích nhân vật',
    content: 'Tìm hiểu tình huống truyện, nhân vật, ngôi kể và chủ đề tác phẩm.',
    outline: '- Đọc và xác định tình huống truyện\n- Phân tích chi tiết về nhân vật\n- Luyện viết đoạn văn nghị luận văn học',
  },
  'Tiếng Anh': {
    topic: 'Thì hiện tại hoàn thành và trải nghiệm cá nhân',
    content: 'Ôn cấu trúc, cách dùng, dấu hiệu nhận biết và luyện hội thoại ngắn.',
    outline: '- Ôn cấu trúc thì hiện tại hoàn thành\n- Phân biệt với thì quá khứ đơn\n- Luyện tập qua câu hỏi và hội thoại',
  },
  'Vật lý': {
    topic: 'Định luật Newton và chuyển động của vật',
    content: 'Phân tích lực tác dụng, lập biểu thức định luật II Newton và giải bài tập.',
    outline: '- Nhận biết các lực tác dụng lên vật\n- Phát biểu và vận dụng định luật Newton\n- Giải bài tập chuyển động',
  },
  'Hóa học': {
    topic: 'Liên kết ion và liên kết cộng hóa trị',
    content: 'So sánh sự hình thành liên kết và vận dụng để giải thích tính chất chất.',
    outline: '- Ôn cấu hình electron lớp ngoài cùng\n- Mô tả sự hình thành các loại liên kết\n- Luyện tập viết công thức hóa học',
  },
  'Sinh học': {
    topic: 'ADN, gene và cơ chế di truyền',
    content: 'Tìm hiểu cấu trúc ADN, gene và mối liên hệ với thông tin di truyền.',
    outline: '- Ôn cấu trúc phân tử ADN\n- Tìm hiểu gene và thông tin di truyền\n- Luyện tập sơ đồ hóa kiến thức',
  },
  'Lịch sử': {
    topic: 'Cách mạng tháng Tám năm 1945',
    content: 'Hệ thống bối cảnh, diễn biến chính, kết quả và ý nghĩa lịch sử.',
    outline: '- Xác định bối cảnh lịch sử\n- Sắp xếp các mốc diễn biến chính\n- Phân tích kết quả và ý nghĩa',
  },
  'Địa lý': {
    topic: 'Dân cư và phân bố dân cư Việt Nam',
    content: 'Đọc bảng số liệu, nhận xét đặc điểm dân cư và giải thích sự phân bố.',
    outline: '- Nhận biết đặc điểm dân số\n- Phân tích bản đồ và bảng số liệu\n- Giải thích sự khác biệt giữa các vùng',
  },
  'Tin học': {
    topic: 'Thuật toán và biểu diễn thuật toán',
    content: 'Mô tả bài toán, xác định đầu vào/đầu ra và biểu diễn các bước xử lý.',
    outline: '- Xác định bài toán và dữ liệu\n- Mô tả thuật toán bằng các bước\n- Kiểm tra thuật toán qua ví dụ',
  },
};

export function getAISubjectExamples(subject: string): AISubjectExamples {
  return subjectExamples[subject] ?? {
    topic: subject ? `Một chủ đề trọng tâm trong môn ${subject}` : 'Nhập môn học và chủ đề cần chuẩn bị',
    content: subject
      ? `Ghi các kiến thức, kỹ năng và ví dụ cần triển khai trong môn ${subject}.`
      : 'Ghi các kiến thức, kỹ năng và ví dụ cần triển khai trong bài học.',
    outline: subject
      ? `- Ôn kiến thức nền môn ${subject}\n- Khám phá nội dung trọng tâm\n- Luyện tập vận dụng`
      : '- Ôn kiến thức nền\n- Khám phá nội dung trọng tâm\n- Luyện tập vận dụng',
  };
}
