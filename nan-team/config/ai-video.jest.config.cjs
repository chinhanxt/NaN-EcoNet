module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/libraries/nestjs-libraries/src/videos/remotion/**/*.spec.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { target:'ES2020', module:'commonjs', experimentalDecorators:true, emitDecoratorMetadata:true, esModuleInterop:true, skipLibCheck:true, strict:true, strictPropertyInitialization:false }, diagnostics: true }] },
  moduleNameMapper: {
    '^@gitroom/nestjs-libraries/(.*)$': '<rootDir>/libraries/nestjs-libraries/src/$1',
    '^@gitroom/backend/(.*)$': '<rootDir>/apps/backend/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/libraries/helpers/src/$1',
  },
};
