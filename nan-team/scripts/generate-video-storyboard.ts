import 'reflect-metadata';
import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function main() {
  config({ path: resolve('.env') });
  const directory = resolve('reports/video-pipeline');
  await mkdir(directory, { recursive: true });
  const topic = process.env.AI_VIDEO_TEST_TOPIC || 'Một buổi sáng xanh ở Sài Gòn: thức dậy đón nắng bên cửa sổ, đi bộ trong công viên, uống cà phê với bình cá nhân, đạp xe qua phố và bắt đầu ngày mới tích cực. Phim ảnh điện ảnh chân thực, một cô gái Việt Nam trưởng thành mặc áo linen màu kem xuyên suốt, ánh sáng bình minh vàng dịu, cây xanh và tông teal ấm. Lời kể cuốn hút, tự nhiên, có câu mở đầu hấp dẫn và câu kết truyền cảm hứng.';
  const { AgyMcpService } = await import('../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service');
  const { StoryboardService } = await import('../libraries/nestjs-libraries/src/videos/remotion/storyboard.service');
  const storyboard = await new StoryboardService(new AgyMcpService()).generate({topic,targetDuration:30,voice:'vi-VN-HoaiMyNeural'});
  const result = {...storyboard,targetDuration:30,voice:'vi-VN-HoaiMyNeural'};
  await writeFile(resolve(directory, 'storyboard.json'), JSON.stringify(result, null, 2));
  console.log(`Validated ${storyboard.scenes.length} AGY scenes saved in ${directory}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
