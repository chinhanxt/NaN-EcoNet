// Vietnamese labels for warnings emitted by the openshorts engine (English source text).
// Unknown warnings fall back to the original text.
type Rule = [RegExp, (...groups: string[]) => string];
const range = (a: string, b: string) => `${a}–${b}s`;
const rules: Rule[] = [
  [/^ASR has (\d+) low-confidence words; review transcript before publishing$/, (n) => `Có ${n} từ nhận dạng chưa chắc chắn; hãy xem lại lời thoại trước khi đăng`],
  [/^Original source ASR was not required for this edit$/, () => 'Bản chỉnh sửa này không cần nhận dạng lời thoại từ video gốc'],
  [/^No speech transcript: captions have no spoken words to render$/, () => 'Không có lời thoại: phụ đề không có từ nào để hiển thị'],
  [/^Source cut ([\d.]+)-([\d.]+)s moved to ([\d.]+)-([\d.]+)s so it does not cut speech mid-word$/, (a, b, c, d) => `Điểm cắt ${range(a, b)} đã dời sang ${range(c, d)} để không cắt giữa câu nói`],
  [/^Speaker-cut requested but no validated two-speaker conversation was detected/, () => 'Đã chọn cắt theo người nói nhưng không phát hiện được hội thoại hai người; đã ghi lại các cảnh thực tế được dùng'],
  [/^Screencast kept screen content but could not validate a stacked presenter/, () => 'Bố cục quay màn hình giữ nội dung màn hình nhưng không xác định được người thuyết trình để xếp chồng; đã ghi lại các cảnh thực tế được dùng'],
  [/^Clean revision cannot be reused for these base settings\/source ranges; rendered original source$/, () => 'Không dùng lại được bản sạch cho thiết lập/đoạn nguồn này; đã dựng từ video gốc'],
  [/^ASR returned (\d+) word\(s\) with invalid timing \(first "(.*)" at ([\d.?]+)s/, (n, w, t) => `Nhận dạng trả về ${n} từ có mốc thời gian không hợp lệ (đầu tiên là "${w}" tại ${t}s); đã giữ nguyên nhưng phụ đề sẽ bỏ qua các từ này`],
  [/^ASR end-window text at ([\d.?]+)-([\d.?]+)s \("(.*)"\) has possible hallucination signals \([^)]*\); (removed|kept)[^;]*(; speech runs to the media end)?/, (a, b, text, action, end) =>
    `Đoạn lời thoại cuối ${range(a, b)} ("${text}") có dấu hiệu nhận dạng sai; ${action === 'removed' ? 'đã bỏ khỏi phụ đề và hook' : 'đã giữ nguyên, hãy xem lại trước khi đăng'}${end ? '; lời nói kéo dài tới cuối video nên điểm cắt có thể ngắt giữa từ' : ''}`],
  [/^ASR decoded on (\S+) instead of configured (\S+); transcript numerics may differ$/, (a, b) => `Nhận dạng lời thoại chạy trên ${a} thay vì ${b} đã cấu hình; kết quả có thể chênh lệch nhẹ`],
  [/^sentence boundaries unavailable for ([\d.]+)-([\d.]+)s; cut at word pauses$/, (a, b) => `Không tìm được ranh giới câu cho độ dài ${range(a, b)}; đã cắt tại khoảng nghỉ giữa các từ`],
  [/^AI returned (\d+) non-overlapping clip\(s\) of (\d+) requested$/, (n, m) => `AI chỉ tìm được ${n}/${m} clip không trùng nhau như yêu cầu`],
  [/^Hook face clearance not verified/, () => 'Chưa kiểm tra được hook có che mặt hay không (thiếu bộ nhận diện khuôn mặt); chỉ chừa vùng phụ đề'],
  [/^Hook skipped: no region clears detected faces and captions/, () => 'Đã bỏ hook: không có vị trí hay cỡ chữ nào tránh được khuôn mặt và phụ đề'],
  [/^Hook font reduced to (\d+)% to clear faces and captions$/, (n) => `Đã giảm cỡ chữ hook còn ${n}% để tránh khuôn mặt và phụ đề`],
  [/^Hook narrowed to (\d+)% width at (\d+)% font to clear faces and captions$/, (w, f) => `Đã thu hẹp hook còn ${w}% chiều rộng, cỡ chữ ${f}% để tránh khuôn mặt và phụ đề`],
  [/^Narration trimmed at a sentence boundary to fit the clip duration$/, () => 'Lời thuyết minh đã được cắt ở cuối câu cho vừa thời lượng clip'],
  [/^Narration is shorter than the clip \((\d+) of (\d+) target syllables\)$/, (a, b) => `Lời thuyết minh ngắn hơn clip (${a}/${b} âm tiết mục tiêu)`],
  [/^Clip is longer than one TTS narration request/, () => 'Clip dài hơn giới hạn một lần đọc thuyết minh; lời thuyết minh chỉ tóm tắt và kết thúc sớm'],
  [/^Grounded clip content unavailable: ([\s\S]*)$/, (e) => `Không tạo được nội dung clip: ${e}`],
  [/^ASR repair unavailable \(([\s\S]*)\); original transcript kept$/, (e) => `Không sửa được lời thoại tự động (${e}); đã giữ bản gốc`],
  [/^ASR repair failed for words (\d+)-(\d+) \(([\s\S]*)\); original transcript kept$/, (a, b, e) => `Sửa lời thoại thất bại cho từ ${a}–${b} (${e}); đã giữ bản gốc`],
  [/^ASR repair rejected (\d+) AGY edit\(s\) that broke the constraints$/, (n) => `Đã bỏ ${n} chỉnh sửa lời thoại của AI vì vi phạm ràng buộc`],
  [/^ASR repair frames unavailable \(([\s\S]*)\); repairing from text only$/, (e) => `Không lấy được khung hình để sửa lời thoại (${e}); chỉ sửa dựa trên văn bản`],
  [/^Voice clone "(.+)" unavailable \(([\s\S]*)\); narrated with Edge voice (\S+)$/, (v, e, u) => `Máy chủ giọng nhân bản không phản hồi (${e}) nên giọng "${v}" đã được thay bằng giọng Edge ${u === 'vi-VN-HoaiMyNeural' ? 'Hoài My' : 'Nam Minh'}; hãy tạo lại khi Voice Clone hoạt động nếu cần đúng giọng`],
  [/^ASR repair skipped \(([\s\S]*)\); original transcript kept$/, (e) => `Đã bỏ qua sửa lời thoại (${e}); đã giữ bản gốc`],
];

export const videoWarningVi = (warning: string): string => {
  for (const [pattern, format] of rules) {
    const match = warning.match(pattern);
    if (match) return format(...match.slice(1).map((group) => group ?? ''));
  }
  return warning;
};

/** Translated, de-duplicated warnings for display. */
export const videoWarningsVi = (warnings?: string[] | null): string[] =>
  [...new Set((warnings || []).map(videoWarningVi))];
