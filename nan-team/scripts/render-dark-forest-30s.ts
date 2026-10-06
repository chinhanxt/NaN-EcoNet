import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';

config();

// Load NestJS Remotion modules
import { TtsService } from '../libraries/nestjs-libraries/src/videos/remotion/tts.service';
import {
  renderVideoFile,
  verifyRenderedVideo,
  serveVideoAssets,
  EngineProps,
} from '../libraries/nestjs-libraries/src/videos/remotion/remotion.renderer';

async function renderDarkForest30s() {
  console.log('================================================================');
  console.log('🌌 RENDERING 30-SECOND HIGH-CONCEPT SCI-FI AI VIDEO');
  console.log('   Topic: "Giả thuyết Rừng Rậm Đen Tối & Nghịch lý Fermi"');
  console.log('   Theme: Cinematic Clean Shadow (Zero Black Box, Deep Text Shadow)');
  console.log('   Aspect Ratio: 9:16 (1080x1920) | Voice: Cloned "Thuyết Minh" (port 8002)');
  console.log('================================================================');

  const tts = new TtsService();
  const workDir = await mkdtemp(join(tmpdir(), 'nan-dark-forest-render-'));

  try {
    // 1. Scriptwriting: 3 scenes, exactly 30s target (114 syllables ~ 3.8 SPS)
    console.log('\n[1/5] Preparing 30s retention script for 3 scenes (The Dark Forest Hypothesis)...');
    const scenes = [
      {
        sceneId: 1,
        voiceText: 'Vũ trụ sâu thẳm im lặng đến rợn người không phải vì không có sự sống, mà vì tất cả các nền văn minh đều đang nín thở giấu mình trong bóng tối.',
        keyword: 'bóng tối',
        syllables: 38,
      },
      {
        sceneId: 2,
        voiceText: 'Đó là Giả thuyết Rừng Rậm Đen Tối: Mỗi nền văn minh là một thợ săn mang súng, lẩn khuất sau rặng cây. Bất kỳ ai thắp lên ngọn đèn đầu tiên, sẽ lập tức bị xóa sổ.',
        keyword: 'xóa sổ',
        syllables: 39,
      },
      {
        sceneId: 3,
        voiceText: 'Và Trái Đất của chúng ta đang ngây thơ phát đi tín hiệu vô tuyến khắp dải ngân hà. Chúng ta đang gõ cửa địa ngục, chỉ vì không hiểu được cái giá của sự im lặng.',
        keyword: 'im lặng',
        syllables: 37,
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
      '/home/chinhan/.gemini/antigravity-cli/brain/089eee1e-3558-42e8-9ee9-56da142eb61e/dark_forest_cosmos_1790610084855.jpg',
      '/home/chinhan/.gemini/antigravity-cli/brain/089eee1e-3558-42e8-9ee9-56da142eb61e/dark_forest_hunter_1790610121121.jpg',
      '/home/chinhan/.gemini/antigravity-cli/brain/089eee1e-3558-42e8-9ee9-56da142eb61e/dark_forest_earth_1790610162254.jpg',
    ];

    const assets: Record<string, { path: string; mime: string }> = {
      '/scene-0': { path: imageArtifacts[0], mime: 'image/jpeg' },
      '/scene-1': { path: imageArtifacts[1], mime: 'image/jpeg' },
      '/scene-2': { path: imageArtifacts[2], mime: 'image/jpeg' },
      '/voice.wav': { path: speech.audioPath, mime: 'audio/wav' },
    };

    const server = await serveVideoAssets(assets);
    console.log(`   Staged asset server active at: ${server.baseUrl}`);

    // 4. Render 30s Video via Remotion (9:16 Vertical) with Dynamic Theme Tokens
    console.log('\n[4/5] Bundling and rendering Remotion vertical video with Dynamic Theme Tokens...');
    const engineProps: EngineProps = {
      title: 'Giả Thuyết Rừng Rậm Đen Tối',
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
      theme: {
        style: 'cinematic',
        subtitleStyle: 'clean_shadow',
        showBadge: false,
        showProgressBar: true,
        accentColor: '#FFE075',
        primaryColor: '#FFFFFF',
      },
    };

    const abort = new AbortController();
    const outputVideo = await renderVideoFile(workDir, engineProps, abort.signal, (progress: number, stage: string) => {
      if (Math.round(progress) % 10 === 0 || progress === 100) {
        console.log(`   [Render Progress] ${Math.round(progress)}% - ${stage}`);
      }
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
    const persistentOutput = join(reportsDir, 'video-dark-forest-30s-9x16.mp4');
    await copyFile(outputVideo, persistentOutput);
    console.log(`\n🎉 SUCCESS! Rendered video saved to: ${persistentOutput}`);

    // Extract 3 preview frames at 4s, 15s, 25s
    console.log('\n📸 Extracting preview frames to inspect "clean_shadow" subtitle design...');
    const frame04 = join(reportsDir, 'dark-forest-frame-04s.png');
    const frame15 = join(reportsDir, 'dark-forest-frame-15s.png');
    const frame25 = join(reportsDir, 'dark-forest-frame-25s.png');

    execFileSync('ffmpeg', ['-nostdin', '-y', '-ss', '4', '-i', persistentOutput, '-vframes', '1', '-q:v', '2', frame04]);
    execFileSync('ffmpeg', ['-nostdin', '-y', '-ss', '15', '-i', persistentOutput, '-vframes', '1', '-q:v', '2', frame15]);
    execFileSync('ffmpeg', ['-nostdin', '-y', '-ss', '25', '-i', persistentOutput, '-vframes', '1', '-q:v', '2', frame25]);

    console.log(`   Saved frame 04s: ${frame04}`);
    console.log(`   Saved frame 15s: ${frame15}`);
    console.log(`   Saved frame 25s: ${frame25}`);

    await server.close();
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

renderDarkForest30s().catch((error) => {
  console.error('\n❌ Render execution failed:', error);
  process.exit(1);
});
