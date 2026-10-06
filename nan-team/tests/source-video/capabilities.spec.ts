import { mkdtemp, writeFile, chmod, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
jest.mock('../../libraries/nestjs-libraries/src/videos/agy-mcp/agy.mcp.service',()=>({AgyMcpService:class {}}));
import { sourceExecutablePresent } from '../../libraries/nestjs-libraries/src/videos/openshorts/source-video.worker';

describe('source executable prerequisites',()=>{
 let directory:string;
 beforeEach(async()=>{directory=await mkdtemp(join(tmpdir(),'source-executable-'));});
 afterEach(async()=>{await rm(directory,{recursive:true,force:true});});
 it('finds executable names through PATH, including directories with spaces',async()=>{
  const bin=join(directory,'bin with spaces');await mkdir(bin);
  const python=join(bin,'fixture-python');await writeFile(python,'#!/bin/sh\nexit 0\n');await chmod(python,0o700);
  expect(await sourceExecutablePresent('fixture-python',bin)).toBe(true);
  expect(await sourceExecutablePresent(python,'')).toBe(true);
  expect(await sourceExecutablePresent('fixture-python','')).toBe(false);
 });
 it('rejects missing, non-executable files and directories',async()=>{
  const python=join(directory,'fixture-python');await writeFile(python,'not executable');await chmod(python,0o600);
  expect(await sourceExecutablePresent('fixture-python',directory)).toBe(false);
  expect(await sourceExecutablePresent('missing',directory)).toBe(false);
  expect(await sourceExecutablePresent(directory,'')).toBe(false);
 });
});
