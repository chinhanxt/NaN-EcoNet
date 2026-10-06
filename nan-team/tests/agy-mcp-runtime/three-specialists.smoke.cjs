'use strict';
// Opt-in live acceptance: real AGY sessions and native vision, never a fake CLI.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { runTask, readReceipt } = require('../../packages/agy-mcp-runner/index.cjs');
const swapped = process.argv.includes('--wrong-image');
const expected = swapped ? { headline:'CLEAN AIR', background:'red', subject:'green square' } : { headline:'SAVE WATER', background:'yellow', subject:'blue circle' };
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'agy-native-vision-'));
  try {
    const frame = path.join(root,'frame.png');
    const shape = swapped ? '<rect x="85" y="245" width="150" height="150" fill="#00aa00"/>' : '<circle cx="160" cy="320" r="75" fill="#0066cc"/>';
    const svg = `<svg width="320" height="568" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="568" fill="${swapped ? '#dd0000' : '#ffff00'}"/>${shape}<text x="160" y="120" font-family="sans-serif" font-size="32" font-weight="bold" text-anchor="middle" fill="white">${expected.headline}</text><text x="160" y="480" font-family="sans-serif" font-size="18" text-anchor="middle" fill="white">Every action counts</text></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(frame);
    const {result,receipt} = await runTask({kind:'analysis',nativeReview:true,role:'rendered frame acceptance',frames:[{path:frame,timestampSeconds:2}],prompt:'Review only the supplied actual frame with three native specialists. Each specialist must read its skill, MCP evidence and native view_file image. Final result: quote the large headline, name the background color and the central shape/color, and assess white caption contrast as low/high. Do not infer from prior images, the prompt or skill examples. Do not add extra frames.',schema:{type:'object',properties:{observedText:{type:'string'},backgroundColor:{type:'string'},subject:{type:'string'},readability:{type:'string',enum:['low','high']}},required:['observedText','backgroundColor','subject','readability'],additionalProperties:false},onEvent:(event)=>{if(event.type==='receipt') console.log(JSON.stringify({receiptId:event.receipt.jobId,status:event.receipt.status,nativeReview:event.receipt.nativeReview}));}});
    const normalized = (value) => String(value).toLowerCase().trim();
    assert.equal(normalized(result.observedText),expected.headline.toLowerCase());
    assert.ok(normalized(result.backgroundColor).includes(expected.background));
    for(const word of expected.subject.split(' ')) assert.ok(normalized(result.subject).includes(word));
    if(!swapped) assert.equal(result.readability,'low');
    assert.equal(receipt.nativeReview.succeeded,true);
    assert.equal(receipt.nativeReview.specialists.length,3);
    assert.ok(receipt.nativeReview.specialists.every((role)=>role.nativeVisionRead && role.reportSucceeded));
    assert.equal((await readReceipt(receipt.jobId)).runtimeHash,receipt.runtimeHash);
    console.log(JSON.stringify({passed:true,variant:swapped?'wrong-image':'positive',result,receiptId:receipt.jobId,runtimeHash:receipt.runtimeHash}));
  } finally { await fs.rm(root,{recursive:true,force:true}); }
})().catch((error)=>{console.error(error.stack);process.exitCode=1;});
