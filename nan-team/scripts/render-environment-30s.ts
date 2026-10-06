import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

async function renderEnvironment30s() {
  console.log('================================================================');
  console.log('🌍 RENDERING 30-SECOND ENVIRONMENTAL AI VIDEO WITH 3 AI IMAGES');
  console.log('   Framework: video-retention-scriptwriting & viral-copywriting-master');
  console.log('   Aspect Ratio: 9:16 (1080x1920) | Voice: Cloned "Thuyết Minh"');
  console.log('================================================================');

  const tts = new TtsService();
  const workDir = await mkdtemp(join(tmpdir(), 'nan-env-render-'));

  try {
    // 1. Scriptwriting: 3 scenes, exactly 30s target (116 syllables ~ 3.9 SPS)
    console.log('\n[1/5] Preparing 30s retention script for 3 scenes...');
    const scenes = [
      {
        sceneId: 1,
        voiceText: 'Mỗi chiếc túi ni-lông bạn dùng trong năm phút, cần tới năm trăm năm để biến mất hoàn toàn khỏi Trái Đất. Và một phần trong số đó, đang âm thầm quay trở lại đĩa ăn của chính bạn.',
        imagePrompt: 'Plastic pollution on dark desolate beach at twilight, waves washing plastic bottles on wet sand.',
        keyword: 'năm trăm năm',
        syllables: 40,
      },
      {
        sceneId: 2,
        voiceText: 'Hàng triệu tấn vi nhựa trôi nổi trong lòng đại dương, đầu độc nguồn nước và tàn phá sự sống của các sinh vật biển. Chúng ta không thể tiếp tục làm ngơ trước thảm họa này.',
        imagePrompt: 'Underwater deep ocean shot with sunlight rays, drifting plastic debris, sea turtle swimming.',
        keyword: 'vi nhựa',
        syllables: 38,
      },
      {
        sceneId: 3,
        voiceText: 'Hãy bắt đầu từ hôm nay: từ chối đồ nhựa dùng một lần, trồng thêm cây xanh và lan tỏa lối sống bền vững. Tương lai của màu xanh nằm trọn trong tay mỗi người chúng ta.',
        imagePrompt: 'Human hands holding young green sprout with dark soil, golden morning sunrise in forest.',
        keyword: 'màu xanh',
        syllables: 38,
      },
    ];

    const totalSyllables = scenes.reduce((sum, s) => sum + s.syllables, 0);
    console.log(`   Total syllables: ${totalSyllables} (Target: 110-125 syllables for 30s)`);

    // 2. Synthesize Speech with Voice_Clone service on port 8002
    console.log('\n[2/5] Synthesizing speech via Voice_Clone service (Voice: "Thuyết Minh", 30s)...');
    const speech = await tts.synthesizeVideo(scenes, 'Thuyết Minh', 30, workDir);
    console.log(`   Speech duration: ${speech.durationInSeconds}s (${speech.durationInFrames} frames)`);
    console.log(`   Word captions generated: ${speech.captions.length}`);
    assert(speech.captions.length > 0, 'Speech synthesis must produce word captions');

    // 3. Stage 3 Real AI Generated Images
    console.log('\n[3/5] Staging 3 AI-generated 9:16 images on local asset server...');
    const imageArtifacts = [
      '/home/chinhan/.gemini/antigravity-cli/brain/089eee1e-3558-42e8-9ee9-56da142eb61e/env_plastic_pollution_1790608037377.jpg',
      '/home/chinhan/.gemini/antigravity-cli/brain/089eee1e-3558-42e8-9ee9-56da142eb61e/env_ocean_turtle_1790608076320.jpg',
      '/home/chinhan/.gemini/antigravity-cli/brain/089eee1e-3558-42e8-9ee9-56da142eb61e/env_hope_sprout_1790608126273.jpg',
    ];

    const assets: Record<string, { path: string; mime: string }> = {
      '/scene-0': { path: imageArtifacts[0], mime: 'image/jpeg' },
      '/scene-1': { path: imageArtifacts[1], mime: 'image/jpeg' },
      '/scene-2': { path: imageArtifacts[2], mime: 'image/jpeg' },
      '/voice.wav': { path: speech.audioPath, mime: 'audio/wav' },
    };

    const server = await serveVideoAssets(assets);
    console.log(`   Staged asset server active at: ${server.baseUrl}`);

    // 4. Render 30s Video via Remotion (9:16 Vertical)
    console.log('\n[4/5] Bundling and rendering Remotion vertical video (1080x1920, 30s, 900 frames)...');
    const engineProps: EngineProps = {
      title: 'Hồi Sinh Màu Xanh Trái Đất',
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
    assert(verification.durationInFrames >= 850 && verification.durationInFrames <= 950, 'Duration must be ~30s');

    // Save to persistent reports directory
    const reportsDir = resolve('reports/video-pipeline');
    await mkdir(reportsDir, { recursive: true });
    const persistentOutput = join(reportsDir, 'video-environment-30s-9x16.mp4');
    await copyFile(outputVideo, persistentOutput);

    console.log(`\n🎉 SUCCESS! Rendered video saved to: ${persistentOutput}`);
    await server.close();
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

renderEnvironment30s().catch((error) => {
  console.error('\n❌ Render execution failed:', error);
  process.exit(1);
});
