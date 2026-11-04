import { Trophy } from 'lucide-react';
import { StudentFeaturePage } from './StudentFeaturePage';

export function Leaderboard() {
  return (
    <StudentFeaturePage
      icon={Trophy}
      title="Bảng xếp hạng & Huy hiệu"
      description="Thành tích học tập, thứ hạng và các huy hiệu bạn đạt được sẽ hiển thị tại đây."
    />
  );
}
