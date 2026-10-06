'use strict';
const fs = require('node:fs');
const path = require('node:path');
const SPECIALISTS = {
  'content-editor': { role: 'Content editor', skill: 'copywriting', focus: 'Check the hook, factual grounding, caption wording, pacing and language against the supplied evidence.' },
  'visual-editor': { role: 'Visual editor', skill: 'ai-product-photography', focus: 'Inspect composition, focal subject, lighting, image consistency, typography contrast and caption placement in every supplied frame.' },
  'render-reviewer': { role: 'Render reviewer', skill: 'ai-social-media-content', focus: 'Review the content and visual editors findings against every rendered frame. Check aspect ratio, safe areas, caption readability, continuity and timing. Report concrete corrections or a grounded pass.' },
};
function readTrace(policy) {
  try { return fs.readFileSync(policy.trace, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
function readAgents(policy) {
  const agents = [];
  if (!policy.brainRoot) return agents;
  let sessions;
  try { sessions = fs.readdirSync(policy.brainRoot, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return agents; throw error; }
  for (const parentConversationId of sessions.filter((e) => e.isDirectory()).map((e) => e.name)) {
    const directory = path.join(policy.brainRoot, parentConversationId, '.system_generated', 'subagents');
    let names;
    try { names = fs.readdirSync(directory); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const name of names.filter((value) => value.endsWith('.json'))) {
      const detail = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
      agents.push({ parentConversationId, conversationId: detail.conversationId, typeName: detail.subagentDescriptor?.typeName, role: detail.subagentDescriptor?.role, state: detail.state, spawnStepIndex: detail.spawnStepIndex });
    }
  }
  return agents;
}
function completed(trace, conversationId, tool, predicate = () => true) {
  return trace.some((entry) => entry.phase === 'post' && entry.success === true && entry.conversationId === conversationId && entry.tool === tool && predicate(entry));
}
function roleReport(policy, typeName, trace = readTrace(policy), agents = readAgents(policy)) {
  const parentId = trace.find((entry) => entry.phase === 'pre')?.conversationId;
  const found = agents.filter((agent) => agent.typeName === typeName && agent.parentConversationId === parentId);
  if (found.length !== 1) return undefined;
  const agent = found[0];
  const spawned = completed(trace, parentId, 'invoke_subagent', (entry) => entry.roles?.includes(typeName) && entry.stepIdx === agent.spawnStepIndex);
  const evidence = completed(trace, agent.conversationId, 'call_mcp_tool', (entry) => entry.target === 'video-job/get_job_evidence');
  const frames = Array.from({ length: policy.frameCount || 0 }, (_, index) => completed(trace, agent.conversationId, 'call_mcp_tool', (entry) => entry.target === 'video-job/read_frame' && entry.frameIndex === index)).every(Boolean);
  const nativeVision = (policy.framePaths || []).every((_,index)=>completed(trace,agent.conversationId,'view_file',(entry)=>entry.frameFileIndex===index));
  const seed = !policy.hasSeed || completed(trace, agent.conversationId, 'call_mcp_tool', (entry) => entry.target === 'video-job/read_seed_image') && completed(trace,agent.conversationId,'view_file',(entry)=>entry.seedFile===true);
  const skill = completed(trace, agent.conversationId, 'view_file', (entry) => entry.skill === SPECIALISTS[typeName]?.skill);
  const report = [...trace].reverse().find((entry)=>entry.phase==='post' && entry.success && entry.conversationId===agent.conversationId && entry.tool==='send_message' && entry.recipient===parentId);
  if (!spawned || !evidence || !frames || !nativeVision || !seed || !skill || !report) return undefined;
  return { ...agent, evidenceRead: true, frameCount: policy.frameCount || 0, skill: SPECIALISTS[typeName].skill, nativeVisionRead:true, reportHash:report.reportHash, reportKey:report.reportKey, reportSucceeded: true };
}
function reviewProof(policy) {
  const trace = readTrace(policy), agents = readAgents(policy);
  const specialists = Object.keys(SPECIALISTS).map((name) => roleReport(policy, name, trace, agents));
  const renderSpawn = trace.find((entry) => entry.phase === 'pre' && entry.allowed && entry.tool === 'invoke_subagent' && entry.roles?.includes('render-reviewer'));
  const editorsFinishedFirst = !!renderSpawn && ['content-editor', 'visual-editor'].every((role) => {
    const agent = specialists.find((entry) => entry?.typeName === role);
    return agent && trace.some((entry) => entry.phase === 'post' && entry.success && entry.tool === 'send_message' && entry.conversationId === agent.conversationId && entry.at <= renderSpawn.at);
  });
  return { succeeded: specialists.every(Boolean) && editorsFinishedFirst, specialists: specialists.filter(Boolean), editorsFinishedFirst };
}
function visionProof(policy) {
  const trace=readTrace(policy), parent=trace.find((entry)=>entry.phase==='pre')?.conversationId;
  const seed = !policy.hasSeed || completed(trace,parent,'view_file',(entry)=>entry.seedFile===true) || readAgents(policy).some((agent)=>SPECIALISTS[agent.typeName] && completed(trace,agent.conversationId,'view_file',(entry)=>entry.seedFile===true));
  const frames = policy.nativeReview || (policy.framePaths || []).every((_,index)=>completed(trace,parent,'view_file',(entry)=>entry.frameFileIndex===index));
  return seed && frames;
}
module.exports = { SPECIALISTS, readTrace, readAgents, roleReport, reviewProof, visionProof };
