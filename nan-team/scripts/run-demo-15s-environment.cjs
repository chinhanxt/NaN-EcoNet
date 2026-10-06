const assert = require('node:assert/strict');
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const { resolve, join } = require('node:path');
const { execFileSync } = require('node:child_process');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { sign } = require('jsonwebtoken');

const directory = resolve('reports/video-pipeline');
const api = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const prisma = new PrismaClient();

async function main() {
  await mkdir(directory, { recursive: true });
  console.log('--- BẮT ĐẦU TẠO VIDEO AI 15S CHỦ ĐỀ BẢO VỆ MÔI TRƯỜNG ---');

  const user = await prisma.user.findFirst({
    where: { activated: true, organizations: { some: { disabled: false } } },
    select: { id: true, organizations: { where: { disabled: false }, select: { organizationId: true }, take: 1 } }
  });
  assert(user, 'No activated local user with an organization');
  const orgId = user.organizations[0].organizationId;
  const headers = {
    'Content-Type': 'application/json',
    auth: sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' }),
    showorg: orgId
  };

  const seedImageUrl = 'http://localhost:4200/uploads/2026/09/27/10a792ad2bf5e3231324dd7a982a3c9f2.jpg';
  const topic = 'Chung tay bảo vệ môi trường, giữ gìn giảng đường xanh sạch đẹp';
  const targetDuration = 15;
  const voice = 'vi-VN-HoaiMyNeural';

  console.log('\n[1/3] Đang gửi yêu cầu tạo Storyboard & sinh ảnh tương đồng (Visual DNA)...');
  console.log(`Topic: "${topic}" | Thời lượng: ${targetDuration}s | Giọng: ${voice}`);
  console.log(`Ảnh mồi: ${seedImageUrl}`);

  const storyboardRes = await fetch(`${api}/ai-video/generate-storyboard`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      topic,
      targetDuration,
      voice,
      seedImageUrl
    })
  });

  if (!storyboardRes.ok) {
    const err = await storyboardRes.text();
    throw new Error(`Tạo Storyboard thất bại (HTTP ${storyboardRes.status}): ${err}`);
  }

  const storyboard = await storyboardRes.json();
  console.log(`\n✅ Storyboard đã tạo xong: "${storyboard.title}"`);
  console.log(`Visual DNA: ${storyboard.visualDna.substring(0, 100)}...`);
  console.log(`Số cảnh (scenes): ${storyboard.scenes.length}`);

  storyboard.scenes.forEach((s, idx) => {
    console.log(`  Scene ${idx + 1}: [Thoại] "${s.voiceText}" (Từ khóa: ${s.keywordHighlight})`);
    console.log(`           [Ảnh] ${s.imageUrl}`);
  });

  await writeFile(join(directory, 'storyboard-15s-environment.json'), JSON.stringify(storyboard, null, 2));

  console.log('\n[2/3] Đang gửi yêu cầu Render Video bằng Remotion Engine...');
  const renderRes = await fetch(`${api}/ai-video/render`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: storyboard.title,
      targetDuration,
      voice,
      scenes: storyboard.scenes
    })
  });

  if (!renderRes.ok) {
    const err = await renderRes.text();
    throw new Error(`Yêu cầu render thất bại (HTTP ${renderRes.status}): ${err}`);
  }

  const { jobId } = await renderRes.json();
  console.log(`✅ Job render đã khởi chạy! Job ID: ${jobId}`);

  console.log('\n[3/3] Đang theo dõi tiến độ Render...');
  let state;
  let lastProgress = -1;
  const deadline = Date.now() + 10 * 60 * 1000;

  while (Date.now() < deadline) {
    const poll = await fetch(`${api}/ai-video/status/${jobId}`, { headers });
    if (!poll.ok) {
      console.log(`HTTP ${poll.status} khi kiểm tra trạng thái, thử lại sau 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }
    state = await poll.json();
    if (state.progress !== lastProgress) {
      console.log(`  Tiến độ: ${state.progress}% | Trạng thái: ${state.stage || state.status}`);
      lastProgress = state.progress;
    }

    if (state.status === 'completed' || state.status === 'failed') {
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (state.status !== 'completed') {
    throw new Error(`Render thất bại hoặc quá thời gian: ${state.error || JSON.stringify(state)}`);
  }

  console.log('\n🎉 RENDER VIDEO HOÀN TẤT THÀNH CÔNG!');
  console.log(`Video Media URL: ${state.media.path}`);

  // Download video artifact to reports
  const download = await fetch(state.media.path);
  if (download.ok) {
    const output = join(directory, 'demo-15s-environment.mp4');
    const bytes = Buffer.from(await download.arrayBuffer());
    await writeFile(output, bytes);

    const probe = JSON.parse(
      execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', output], {
        encoding: 'utf8'
      })
    );
    const videoStream = probe.streams.find(s => s.codec_type === 'video');
    const audioStream = probe.streams.find(s => s.codec_type === 'audio');

    console.log(`\nThông số kỹ thuật video:`);
    console.log(`- Độ phân giải: ${videoStream.width}x${videoStream.height} (Tỉ lệ 9:16 dọc)`);
    console.log(`- Tốc độ khung hình: ${videoStream.avg_frame_rate} FPS`);
    console.log(`- Tổng số frame: ${videoStream.nb_read_frames} frames`);
    console.log(`- Thời lượng: ${probe.format.duration} giây (Chuẩn 15s)`);
    console.log(`- Kích thước file: ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Lưu tại máy: ${output}`);
    console.log(`- Xem trực tiếp trên trình duyệt: ${state.media.path}`);
  }
}

main().catch(err => {
  console.error('\n❌ LỖI:', err.message || err);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
