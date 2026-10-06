'use strict';
// Trusted native lifecycle hooks. Deny unknown identities and capabilities.
const fs = require('node:fs');
const path = require('node:path');
const {createHash}=require('node:crypto');
const { SPECIALISTS, readTrace, readAgents, roleReport, reviewProof, visionProof } = require('./native-review.cjs');
// Same aliases job-server accepts for read_frame, so the trace records the frame actually read.
function frameIndexOf(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return undefined; } }
  if (!value || typeof value !== 'object') return undefined;
  const raw = ['index', 'frame_index', 'frameIndex', 'i', 'idx'].map((key) => value[key]).find((v) => v !== undefined);
  const index = typeof raw === 'string' && /^\d{1,6}$/.test(raw) ? Number(raw) : raw;
  return Number.isInteger(index) ? index : undefined;
}
let input = '';
process.stdin.on('data', (chunk) => { input += chunk; if (input.length > 1000000) process.exit(2); });
process.stdin.on('end', () => {
  let lock;
  try {
    const policy = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const lockPath=policy.trace+'.lock';
    const ownerFile=path.join(lockPath,'owner');
    // A hook killed by AGY's timeout while holding the lock must not deny every later call: break it when its owner is dead or it is >5 s old.
    const stale=()=>{
      let owner; try { owner=JSON.parse(fs.readFileSync(ownerFile,'utf8')); } catch {}
      if(owner&&Number.isInteger(owner.pid)&&owner.pid!==process.pid) { try { process.kill(owner.pid,0); } catch(error) { if(error.code==='ESRCH')return true; } }
      const since=owner&&Number.isFinite(owner.at)?owner.at:(()=>{ try { return fs.statSync(lockPath).mtimeMs; } catch { return Date.now(); } })();
      return Date.now()-since>5000;
    };
    for(let attempt=0;attempt<100;attempt++) {
      try { fs.mkdirSync(lockPath,{mode:0o700}); lock=lockPath; fs.writeFileSync(ownerFile,JSON.stringify({pid:process.pid,at:Date.now()}),{mode:0o600}); break; }
      catch(error) {
        if(error.code!=='EEXIST')throw error;
        if(stale()) { const moved=`${lockPath}.stale-${process.pid}-${attempt}`; try { fs.renameSync(lockPath,moved); fs.rmSync(moved,{recursive:true,force:true}); } catch {} continue; }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
      }
    }
    if(!lock)throw new Error('Native policy state is busy');
    const payload = JSON.parse(input), trace = readTrace(policy);
    const { conversationId, stepIdx } = payload;
    if (typeof conversationId !== 'string' || !Number.isInteger(stepIdx)) throw new Error('Missing native step identity');
    const parentId = trace.find((entry) => entry.phase === 'pre')?.conversationId || conversationId;
    const agents = readAgents(policy);
    const child = agents.find((agent) => agent.conversationId === conversationId && agent.parentConversationId === parentId && SPECIALISTS[agent.typeName]);
    const parent = conversationId === parentId;
    const append = (entry) => fs.appendFileSync(policy.trace, JSON.stringify({ ...entry, conversationId, stepIdx, at: new Date().toISOString() }) + '\n', { mode: 0o600 });
    if (process.argv[3] === 'post') {
      const pre = [...trace].reverse().find((entry) => entry.phase === 'pre' && entry.conversationId === conversationId && entry.stepIdx === stepIdx);
      if (!pre) throw new Error('No matching authorized native tool step');
      append({ ...pre, phase: 'post', success: pre.allowed && !payload.error });
      process.stdout.write('{}'); return;
    }
    const name = payload.toolCall?.name, args = payload.toolCall?.args || {};
    let allowed = false, spillFile, argumentShape, deniedPath, skill, frameFileIndex, seedFile, reportKey, reportHash, overwrite, reason;
    const grants = [], roles = args.Subagents?.map((agent) => agent.TypeName);
    const toolArguments = name === 'call_mcp_tool' ? args.Arguments : undefined;
    if (name === 'call_mcp_tool') {
      let parsed = toolArguments;
      if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { parsed = undefined; } }
      argumentShape = { type: Array.isArray(toolArguments) ? 'array' : toolArguments === null ? 'null' : typeof toolArguments, keys: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed).slice(0, 20).map((key) => key.slice(0, 64)) : [] };
      if (typeof toolArguments === 'string') { argumentShape.length = toolArguments.length; argumentShape.parsed = parsed !== undefined; }
    }
    if (name === 'call_mcp_tool' && args.ServerName === 'video-job' && policy.mcpTools.includes(args.ToolName)) {
      allowed = parent || !!child && ['get_job_evidence', 'read_frame', 'read_seed_image'].includes(args.ToolName);
      if (parent && args.ToolName === 'submit_result') allowed = (!policy.nativeReview || reviewProof(policy).succeeded) && visionProof(policy);
      if (allowed) grants.push(`mcp(video-job/${args.ToolName})`);
    }
    if (name === 'view_file' && (parent || child)) {
      let target;
      try { target = fs.realpathSync(args.AbsolutePath); } catch { target = undefined; }
      allowed = !!target && policy.readRoots.some((root) => target.startsWith(root + path.sep));
      // AGY spills large tool outputs to brain/<conversation>/.system_generated/steps/<n>/output.txt and reads them back;
      // allow only the caller's own conversation directory.
      if (!allowed && target && policy.brainRoot && /^[\w-]{1,128}$/.test(conversationId)) {
        let brain; try { brain = fs.realpathSync(policy.brainRoot); } catch { brain = undefined; }
        const relative = brain && target.startsWith(brain + path.sep) ? target.slice(brain.length + 1).split(path.sep) : [];
        if (relative.length === 5 && relative[0] === conversationId && relative[1] === '.system_generated' && relative[2] === 'steps' && /^\d{1,6}$/.test(relative[3]) && relative[4] === 'output.txt') { allowed = true; spillFile = true; }
      }
      if (!allowed) reason = `${target ? 'view_file path is outside this job' : 'view_file path does not exist'}; only exact paths supplied by the job are readable${policy.readableFiles?.length ? `: ${policy.readableFiles.join(', ')}` : ' (skill file, evidence imagePath from get_job_evidence/read_frame/read_seed_image)'}${policy.kind === 'image' ? ', plus your generate_image artifact' : ''}. Read frames with read_frame, then view_file its imagePath. Do not retry other paths.`;
      if (!allowed) deniedPath = String(args.AbsolutePath || '').slice(0, 300);
      const index=(policy.framePaths || []).indexOf(target);
      if(index>=0)frameFileIndex=index;
      seedFile=target===policy.seedPath ? true : undefined;
      skill = Object.entries(policy.skillPaths || {}).find(([, filename]) => filename === target)?.[0];
      if (child && skill && skill !== SPECIALISTS[child.typeName].skill) allowed = false;
      if (allowed) grants.push(`read_file(${target})`);
    }
    if (name === 'generate_image' && parent && policy.kind === 'image') {
      // Reference images (user's sample images) must be actually seen before generating from them.
      allowed = !policy.frameCount || visionProof(policy);
      if (!allowed) reason = `Reference images first: call video-job/read_frame for every index 0-${policy.frameCount - 1} and native view_file on every reference imagePath (${(policy.framePaths || []).join(', ')}) in one parallel batch, then call generate_image following them.`;
    }
    if (name === 'invoke_subagent' && parent && policy.nativeReview && Array.isArray(args.Subagents) && args.Subagents.length >= 1 && args.Subagents.length <= 2) {
      const valid = args.Subagents.every((agent) => SPECIALISTS[agent.TypeName] && agent.Workspace === 'inherit' && typeof agent.Prompt === 'string' && agent.Prompt.length <= 20000 && (!agent.Model || agent.Model === 'inherit') && !agent.EnableSubagentTools && !agent.enable_subagent_tools);
      const launched = trace.filter((entry) => entry.phase === 'pre' && entry.allowed && entry.tool === name).flatMap((entry) => entry.roles || []);
      allowed = valid && new Set(roles).size === roles.length && roles.every((role) => !launched.includes(role));
      if (roles.includes('render-reviewer')) {
        const content=roleReport(policy,'content-editor'), visual=roleReport(policy,'visual-editor');
        allowed=allowed && roles.length===1 && !!content && !!visual;
        if(allowed) {
          const reportText=(report)=>fs.readFileSync(path.join(policy.reportRoot,report.reportKey),'utf8');
          overwrite={Subagents:[{...args.Subagents[0],Prompt:args.Subagents[0].Prompt+'\nVerified content-editor findings:\n'+reportText(content)+'\nVerified visual-editor findings:\n'+reportText(visual)}]};
        }
      }
    }
    if (name === 'send_message' && typeof args.Message === 'string' && args.Message.trim() && args.Message.length <= 20000) {
      allowed = !!child && args.Recipient === parentId || parent && agents.some((agent) => agent.conversationId === args.Recipient);
    }
    if(allowed && name==='send_message' && child) {
      reportKey=createHash('sha256').update(conversationId+':'+stepIdx).digest('hex')+'.txt';
      reportHash=createHash('sha256').update(args.Message).digest('hex');
      fs.writeFileSync(path.join(policy.reportRoot,reportKey),args.Message,{mode:0o600,flag:'wx'});
    }
    if (['finish', 'wait', 'wait_5_seconds', 'manage_inbox'].includes(name)) allowed = parent || !!child;
    append({ phase: 'pre', tool: name, target: name === 'call_mcp_tool' ? `${args.ServerName}/${args.ToolName}` : undefined, roles: name === 'invoke_subagent' ? roles : undefined, frameIndex: name === 'call_mcp_tool' && args.ToolName === 'read_frame' ? frameIndexOf(toolArguments) : undefined, argumentShape, spillFile, recipient: name === 'send_message' ? args.Recipient : undefined, reportKey, reportHash, frameFileIndex, seedFile, skill, deniedPath, allowed });
    if (!allowed && !reason && name === 'call_mcp_tool') reason = `Outside job capability: available video-job tools are ${policy.mcpTools.join(', ')}`;
    if (!allowed && !reason && ['run_command', 'command_status', 'send_command_input', 'write_to_file', 'replace_file_content', 'multi_replace_file_content', 'search_web', 'read_url_content', 'list_resources', 'read_resource'].includes(name)) reason = `${name} does not exist in this job and is always denied. Do not call it again; use only the video-job MCP tools${policy.kind === 'image' ? ' and native generate_image' : ''}.`;
    process.stdout.write(JSON.stringify({ decision: allowed ? 'allow' : 'deny', reason: allowed ? 'Within job capability' : reason || 'Outside job capability', permissionOverrides: grants, overwrite }));
  } catch { process.stdout.write(JSON.stringify({ decision: 'deny', reason: 'Invalid job capability' })); }
  finally {
    if(lock) { let mine=false; try { mine=JSON.parse(fs.readFileSync(path.join(lock,'owner'),'utf8')).pid===process.pid; } catch {} if(mine) fs.rmSync(lock,{recursive:true,force:true}); }
  }
});
