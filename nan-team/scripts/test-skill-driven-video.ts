import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { config } from 'dotenv';

config();

// Load NestJS Remotion modules
import { TtsService } from '../libraries/nestjs-libraries/src/videos/remotion/tts.service';
import {
  renderVideoFile,
  verifyRenderedVideo,
  serveVideoAssets,
  EngineProps,
} from '../libraries/nestjs-libraries/src/videos/remotion/remotion.renderer';

async function testSkillDrivenVideo() {
  console.log('================================================================');
  console.log('🧪 TEST E2E: SKILL-DRIVEN AI VIDEO (RETENTION SCRIPTWRITING + CLONED TTS)');
  console.log('   Framework: video-retention-scriptwriting & explainer-video-guide');
  console.log('   Aspect Ratio: 9:16 (1080x1920) | Voice: Cloned "Thuyết Minh"');
  console.log('================================================================');

  const tts = new TtsService();
  const workDir = await mkdtemp(join(tmpdir(), 'nan-skill-render-'));

  try {
    // 1. Retention Scriptwriting Formulation (Phonetic budget: 58 syllables ~ 15s)
    console.log('\n[1/5] Applying video-retention-scriptwriting framework...');
    const scenes = [
      {
        sceneId: 1,
        voiceText: 'Dừng ngay việc nhồi nhét nội dung, nếu không muốn người xem lướt qua trong ba giây!',
        imagePrompt: 'Cinematic extreme close-up of a human thumb rapidly scrolling past glowing smartphones, dramatic red alert lighting, 8k resolution --ar 9:16',
        keyword: 'Dừng ngay',
        syllables: 20,
      },
      {
        sceneId: 2,
        voiceText: 'Não bộ sẽ ngắt chú ý, khi hình ảnh và âm thanh đứng yên quá hai giây.',
        imagePrompt: 'Futuristic 3D visualization of a human brain neural network dimming, flatline pulse monitor, alert orange lighting, octane render --ar 9:16',
        keyword: 'ngắt chú ý',
        syllables: 18,
      },
      {
        sceneId: 3,
        voiceText: 'Hãy áp dụng kỹ thuật ngắt nhịp liên hoàn, để giữ chân khán giả tới giây cuối cùng.',
        imagePrompt: 'Modern creator dashboard with viral analytics spike shooting straight up, golden celebratory glow, creative studio, photorealistic --ar 9:16',
        keyword: 'ngắt nhịp',
        syllables: 20,
      },
    ];

    const totalSyllables = scenes.reduce((sum, s) => sum + s.syllables, 0);
    console.log(`   Total syllables: ${totalSyllables} (Target: 55-65 syllables for 15s video)`);
    assert(totalSyllables >= 50 && totalSyllables <= 70, 'Phonetic budget must match video duration');

    // 2. Synthesize Speech with Voice_Clone service
    console.log('\n[2/5] Synthesizing speech via Voice_Clone service (Voice: "Thuyết Minh")...');
    const speech = await tts.synthesizeVideo(scenes, 'Thuyết Minh', 15, workDir);
    console.log(`   Speech duration: ${speech.durationInSeconds}s (${speech.durationInFrames} frames)`);
    console.log(`   Word captions generated: ${speech.captions.length}`);
    assert(speech.captions.length > 0, 'Speech synthesis must produce word-level captions');

    // 3. Prepare Visual Assets (9:16 aspect ratio: 1080x1920)
    console.log('\n[3/5] Generating visual backgrounds (1080x1920) & staging asset server...');
    const svgs = [
      // Scene 1: Alert / Red & Dark
      `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
        <defs>
          <linearGradient id="bg1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1a0000"/>
            <stop offset="50%" stop-color="#3d0000"/>
            <stop offset="100%" stop-color="#0a0000"/>
          </linearGradient>
        </defs>
        <rect width="1080" height="1920" fill="url(#bg1)"/>
        <circle cx="540" cy="750" r="280" fill="#e63946" opacity="0.3"/>
        <text x="540" y="450" font-family="sans-serif" font-size="52" font-weight="900" fill="#ff4d4d" text-anchor="middle" letter-spacing="4">RETENTION MASTERY</text>
        <rect x="240" y="580" width="600" height="120" rx="24" fill="#ff3333"/>
        <text x="540" y="660" font-family="sans-serif" font-size="46" font-weight="bold" fill="#ffffff" text-anchor="middle">3 GIÂY ĐẦU TIÊN</text>
        <text x="540" y="980" font-family="sans-serif" font-size="34" font-weight="600" fill="#cccccc" text-anchor="middle">Đừng để khán giả lướt qua!</text>
      </svg>`,
      // Scene 2: Attention Drop / Orange & Tech
      `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
        <defs>
          <linearGradient id="bg2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="50%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#020617"/>
          </linearGradient>
        </defs>
        <rect width="1080" height="1920" fill="url(#bg2)"/>
        <circle cx="540" cy="800" r="320" fill="#f97316" opacity="0.2"/>
        <text x="540" y="450" font-family="sans-serif" font-size="52" font-weight="900" fill="#fb923c" text-anchor="middle" letter-spacing="4">NGẮT NHỊP TƯ DUY</text>
        <rect x="220" y="600" width="640" height="120" rx="24" fill="#ea580c"/>
        <text x="540" y="680" font-family="sans-serif" font-size="44" font-weight="bold" fill="#ffffff" text-anchor="middle">QUY TẮC 2 GIÂY</text>
        <text x="540" y="1000" font-family="sans-serif" font-size="34" font-weight="600" fill="#94a3b8" text-anchor="middle">Đổi góc máy &amp; kích thích liên tục</text>
      </svg>`,
      // Scene 3: Solution / Golden & Viral
      `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
        <defs>
          <linearGradient id="bg3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#064e3b"/>
            <stop offset="50%" stop-color="#065f46"/>
            <stop offset="100%" stop-color="#022c22"/>
          </linearGradient>
        </defs>
        <rect width="1080" height="1920" fill="url(#bg3)"/>
        <circle cx="540" cy="800" r="350" fill="#10b981" opacity="0.25"/>
        <text x="540" y="450" font-family="sans-serif" font-size="52" font-weight="900" fill="#34d399" text-anchor="middle" letter-spacing="4">VIRAL RETENTION</text>
        <rect x="200" y="600" width="680" height="120" rx="24" fill="#059669"/>
        <text x="540" y="680" font-family="sans-serif" font-size="44" font-weight="bold" fill="#ffffff" text-anchor="middle">GIỮ CHÂN TỚI CUỐI</text>
        <text x="540" y="1000" font-family="sans-serif" font-size="34" font-weight="600" fill="#a7f3d0" text-anchor="middle">Tỷ lệ xem trung bình > 100%</text>
      </svg>`,
    ];

    const imgPaths: string[] = [];
    for (let i = 0; i < svgs.length; i++) {
      const svgPath = join(workDir, `scene-${i}.svg`);
      const pngPath = join(workDir, `scene-${i}.png`);
      await writeFile(svgPath, Buffer.from(svgs[i]));
      execFileSync('ffmpeg', ['-y', '-i', svgPath, pngPath]);
      imgPaths.push(pngPath);
    }

    const assets: Record<string, { path: string; mime: string }> = {
      '/scene-0': { path: imgPaths[0], mime: 'image/png' },
      '/scene-1': { path: imgPaths[1], mime: 'image/png' },
      '/scene-2': { path: imgPaths[2], mime: 'image/png' },
      '/voice.wav': { path: speech.audioPath, mime: 'audio/wav' },
    };

    const server = await serveVideoAssets(assets);
    console.log(`   Staged asset server active at: ${server.baseUrl}`);

    // 4. Render Video via Remotion (9:16 Vertical)
    console.log('\n[4/5] Bundling and rendering Remotion vertical video (1080x1920)...');
    const engineProps: EngineProps = {
      title: 'Bí Quyết Giữ Chân Khán Giả Video',
      aspectRatio: '9:16',
      width: 1080,
      height: 1920,
      scenes: scenes.map((s, idx) => ({
        imagePath: `${server.baseUrl}/scene-${idx}`,
        durationInFrames: speech.sceneTimings[idx].durationInFrames,
        text: s.voiceText,
        keyword: s.keyword,
      })),
      audioPath: `${server.baseUrl}/voice.wav`,
      captions: speech.captions,
    };

    const abort = new AbortController();
    const outputVideo = await renderVideoFile(workDir, engineProps, abort.signal, (progress: number, stage: string) => {
      console.log(`   [Render Progress] ${Math.round(progress)}% - ${stage}`);
    });

    console.log(`   Render complete! Video output: ${outputVideo}`);

    // 5. Verify Video Output Attributes
    console.log('\n[5/5] Verifying rendered video specs and audio-visual integrity...');
    const verification = await verifyRenderedVideo(outputVideo, speech.durationInFrames, abort.signal, '9:16');
    console.log('   ✅ Verification Results:');
    console.log(`      Dimensions: ${verification.width}x${verification.height} (Expected: 1080x1920)`);
    console.log(`      Duration: ${verification.videoDuration}s (${verification.durationInFrames} frames)`);
    console.log(`      Audio: ${verification.audioCodec} @ ${verification.audioSampleRate}Hz`);
    console.log(`      Video Codec: ${verification.codec} (${verification.pixelFormat})`);

    assert.equal(verification.width, 1080, 'Width must be 1080 for 9:16');
    assert.equal(verification.height, 1920, 'Height must be 1920 for 9:16');

    // Save to persistent reports directory
    const reportsDir = resolve('reports/video-pipeline');
    await mkdir(reportsDir, { recursive: true });
    const persistentOutput = join(reportsDir, 'video-retention-skill-9x16.mp4');
    await copyFile(outputVideo, persistentOutput);

    console.log(`\n🎉 SUCCESS! Rendered video saved to: ${persistentOutput}`);
    await server.close();
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

testSkillDrivenVideo().catch((error) => {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
});
