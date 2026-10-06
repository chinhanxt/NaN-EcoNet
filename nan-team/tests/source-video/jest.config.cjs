module.exports={rootDir:'../..',testEnvironment:'node',testMatch:['<rootDir>/tests/source-video/**/*.spec.ts'],
 transform:{'^.+\\.tsx?$':['ts-jest',{tsconfig:{target:'ES2022',module:'commonjs',experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true,skipLibCheck:true,strict:true,strictPropertyInitialization:false},diagnostics:true}]},
 moduleNameMapper:{'^@gitroom/nestjs-libraries/(.*)$':'<rootDir>/libraries/nestjs-libraries/src/$1','^@gitroom/helpers/(.*)$':'<rootDir>/libraries/helpers/src/$1'}};
