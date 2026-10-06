const base=require('../tests/source-video/jest.config.cjs');
// Runtime assertions run without accumulating whole-program TypeScript graphs.
// Backend/orchestrator builds remain the production type-check gate.
module.exports={...base,rootDir:'..',transform:{'^.+\\.tsx?$':['ts-jest',{
 tsconfig:{...base.transform['^.+\\.tsx?$'][1].tsconfig,isolatedModules:true},diagnostics:false,
}]}};
