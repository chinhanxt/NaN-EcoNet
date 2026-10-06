'use strict';
// Lets harnesses that compile agy.mcp.service.ts in-process resolve its relative .ts imports
// (./design.edit, ./design-edit.cache, ...). Only registers when nothing else did.
const fs = require('node:fs');
const ts = require('typescript');
if (!require.extensions['.ts']) {
  require.extensions['.ts'] = (module, filename) => {
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true } }).outputText;
    module._compile(code, filename);
  };
}
