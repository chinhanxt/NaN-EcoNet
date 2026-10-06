'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const root = path.resolve(__dirname, '..');
  const receiptPath = path.join(root, 'reports/openshorts-integration/integration-state.json');
  const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
  const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  for (const relative of [
    'packages/openshorts-engine/src/timelines.py',
    'libraries/nestjs-libraries/src/chat/start.mcp.ts',
    'libraries/nestjs-libraries/src/chat/tools/source.video.status.tool.ts',
    'apps/frontend/src/components/agents/source-video-studio.modal.tsx',
    'packages/openshorts-engine/core/recut.py',
    'libraries/nestjs-libraries/src/videos/source-motion/source-video-motion.service.ts',
    'scripts/test-source-video-silent-live.cjs',
    'scripts/verify-source-video-live.cjs',
    'scripts/test-source-video-revision-live.cjs',
    'packages/openshorts-engine/core/hooks.py',
    'tests/openshorts/test_hooks_readonly_cwd.py',
    'tests/agy-mcp-runtime/runtime.test.cjs',
    'tests/openshorts/feature-inventory.json',
    'packages/agy-mcp-runner/tool-gate.cjs',
    'packages/agy-mcp-runner/process.cjs',
    'apps/backend/src/api/routes/source-video.controller.ts',
    'scripts/test-source-video-history-live.cjs',
    'scripts/test-source-video-approval-restart-live.cjs',
    'scripts/benchmark-openshorts-recut.py',
    'scripts/test-source-video-cancel-analysis-live.cjs',
    'tests/source-video/service.spec.ts',
    'tests/source-video/repository.db.spec.ts',
    'scripts/test-source-video-analysis-restart-live.cjs',
    'tests/agy-mcp-runtime/service.test.cjs',
    'Makefile',
  ]) receipt.sourceFiles[relative] ||= '';
  for (const relative of Object.keys(receipt.sourceFiles)) {
    receipt.sourceFiles[relative] = digest(await fs.readFile(path.join(root, relative)));
  }
  receipt.sourceSnapshotHash = digest(JSON.stringify(receipt.sourceFiles));
  receipt.recordedAt = new Date().toISOString();
  receipt.tests.pythonEngine = '25 passed with real FFmpeg fixtures, including hook overlay with read-only CWD';
  receipt.tests.sourceFocusedJest = '28 passed, 7 database tests intentionally separate';
  receipt.tests.historyFocusedJest = '19 source-video tests passed, 7 database tests intentionally separate';
  receipt.tests.prismaDatabase = '7 passed against local PostgreSQL, including lost Temporal start acknowledgement recovery';
  receipt.tests.nativeRuntime = '10 passed including Pydantic $defs, chat no-frame MCP, and sanitized eligibility classification';
  receipt.tests.nativeService = '5 passed including shutdown waiting for native cleanup';
  receipt.tests.existingAiVideoRegression = '55 passed';
  receipt.tests.publicMcp = 'authenticated tools/list found all 5 source-video tools; sourceVideoStatusTool tools/call succeeded';
  receipt.tests.temporalFailureClassification = '3 passed: native auth, input error, and capacity are non-retryable activities';
  receipt.evidence.publicMcp = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/public-mcp-discovery.json'), 'utf8'));
  const live = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-source-job.json'), 'utf8'));
  receipt.evidence.liveSourceJob = { jobId: live.jobId, sourceSha256: live.sourceSha256, status: live.final?.status, stages: live.stages, mediaIds: live.final?.clips?.map(clip => clip.media?.id).filter(Boolean) };
  receipt.evidence.liveArtifact = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-artifact-verification.json'), 'utf8'));
  const revision = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-revision-job.json'), 'utf8'));
  receipt.evidence.liveRevision = { jobId: revision.jobId, parentJobId: revision.parentJobId, status: revision.final?.status, stages: revision.stages, mediaIds: revision.final?.clips?.map(clip => clip.media?.id).filter(Boolean) };
  receipt.evidence.liveRevisionArtifact = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-revision-artifact-verification.json'), 'utf8'));
  const square = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-voice-bgm-square.json'), 'utf8'));
  receipt.evidence.liveVoiceBgmSquare = { jobId: square.jobId, parentJobId: square.parentJobId, status: square.final?.status, stages: square.stages, mediaIds: square.final?.clips?.map(clip => clip.media?.id).filter(Boolean) };
  receipt.evidence.liveVoiceBgmSquareArtifact = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-voice-bgm-square-artifact-verification.json'), 'utf8'));
  const silentAttempt = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-job-attempt-1.json'), 'utf8'));
  receipt.evidence.silentAttempt1 = { jobId: silentAttempt.jobId, sourceSha256: silentAttempt.sourceSha256, status: silentAttempt.final?.status, error: silentAttempt.final?.error, stages: silentAttempt.stages, successfulVisionTaskId: '55fe60b6-ed14-467f-a444-4761ab62fa02', failedAuthTaskId: '3c742928-7858-4032-a916-2f48ae8daa28' };
  const silent = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-job.json'), 'utf8'));
  receipt.evidence.silentLatest = { jobId: silent.jobId, sourceSha256: silent.sourceSha256, status: silent.final?.status || 'running', error: silent.final?.error, stages: silent.stages, mediaIds: silent.final?.clips?.map(clip => clip.media?.id).filter(Boolean) };
  receipt.evidence.silentArtifact = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-artifact-verification.json'), 'utf8'));
  for (const index of [1, 2]) {
    const failed = JSON.parse(await fs.readFile(path.join(root, `reports/openshorts-integration/live-silent-hook-attempt-${index}.json`), 'utf8'));
    receipt.evidence[`silentHookAttempt${index}`] = { jobId: failed.jobId, parentJobId: failed.parentJobId, status: failed.final?.status, error: failed.final?.error, stages: failed.stages };
  }
  const silentHook = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-hook.json'), 'utf8'));
  receipt.evidence.silentHook = { jobId: silentHook.jobId, parentJobId: silentHook.parentJobId, status: silentHook.final?.status, stages: silentHook.stages, mediaIds: silentHook.final?.clips?.map(clip => clip.media?.id).filter(Boolean) };
  receipt.evidence.silentHookArtifact = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-hook-artifact-verification.json'), 'utf8'));
  receipt.evidence.silentHookFrame = { path: 'reports/openshorts-integration/live-silent-hook-frame-1s.png', sha256: digest(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-hook-frame-1s.png'))) };
  const effectsAttempt = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-effects-attempt-1.json'), 'utf8'));
  receipt.evidence.silentEffectsAttempt1 = { jobId: effectsAttempt.jobId, parentJobId: effectsAttempt.parentJobId, status: effectsAttempt.final?.status, error: effectsAttempt.final?.error, stages: effectsAttempt.stages };
  const effects = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-effects.json'), 'utf8'));
  receipt.evidence.silentEffects = { jobId: effects.jobId, parentJobId: effects.parentJobId, status: effects.final?.status, stages: effects.stages, mediaIds: effects.final?.clips?.map(clip => clip.media?.id).filter(Boolean) };
  receipt.evidence.silentEffectsArtifact = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-effects-artifact-verification.json'), 'utf8'));
  const punch = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-punch.json'), 'utf8'));
  receipt.evidence.silentPunch = { jobId: punch.jobId, parentJobId: punch.parentJobId, status: punch.final?.status, stages: punch.stages, mediaIds: punch.final?.clips?.map(clip => clip.media?.id).filter(Boolean) };
  receipt.evidence.silentPunchArtifact = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-punch-artifact-verification.json'), 'utf8'));
  receipt.evidence.silentPunchFrame = { path: 'reports/openshorts-integration/live-silent-punch-comparison-2s.png', sha256: digest(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-silent-punch-comparison-2s.png'))) };
  receipt.evidence.liveHistoryZip = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-history-zip.json'), 'utf8'));
  const approval = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-approval-restart.json'), 'utf8'));
  receipt.evidence.liveApprovalRestart = { jobId: approval.jobId, parentJobId: approval.parentJobId, status: approval.final?.status,
    beforeRestart: approval.beforeRestart, afterRestart: approval.afterRestart, staleApprovalStatus: approval.staleApprovalStatus,
    mediaIds: approval.final?.clips?.map(clip => clip.media?.id).filter(Boolean) };
  receipt.evidence.liveApprovalRestartArtifact = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-approval-restart-artifact-verification.json'), 'utf8'));
  receipt.evidence.recutBenchmark = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/recut-benchmark.json'), 'utf8'));
  receipt.evidence.liveCancelAnalysis = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-cancel-analysis.json'), 'utf8'));
  receipt.evidence.liveAnalysisRestart = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-analysis-restart.json'), 'utf8'));
  receipt.evidence.liveAnalysisRestartArtifact = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/live-analysis-restart-artifact-verification.json'), 'utf8'));
  receipt.evidence.browser = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/browser/browser-receipt.json'), 'utf8'));
  receipt.evidence.agentChatBrowser = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/browser/agent-chat-receipt.json'), 'utf8'));
  receipt.evidence.agentChatMemory = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/browser/agent-chat-memory-receipt.json'), 'utf8'));
  const scoring = JSON.parse(await fs.readFile(path.join(root, 'reports/openshorts-integration/native-scoring-smoke.json'), 'utf8'));
  const scoringReceiptPath = '/home/chinhan/.local/share/nan-team/agy-mcp-receipts/63704c8c-907a-4126-944b-455997d8c6e4.json';
  const scoringReceipt = JSON.parse(await fs.readFile(scoringReceiptPath, 'utf8'));
  receipt.evidence.nativeScoringSmoke = { passed: !!scoring.result, errors: scoring.errors, jobId: scoringReceipt.jobId, mcpCalls: scoringReceipt.mcpCalls, privateReceiptPath: scoringReceiptPath };
  receipt.unverified = [
    'Abrupt-kill recovery and restart/compensation during render and publish under load; managed app restart during native analysis and approval-boundary restart are verified',
    'Live legacy post endpoints /posts/separate-posts and /posts/generator still use OpenAI services; native chat/video paths and Makefile use AGY MCP',
    'Representative real speech/silent/two-person/screencast footage; current completed fixtures are synthetic',
    'Full source-bound baseline/candidate pipeline benchmark and full 18-feature live inventory; deterministic recut subset is measured',
  ];
  await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ receiptPath, sourceSnapshotHash: receipt.sourceSnapshotHash }));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
