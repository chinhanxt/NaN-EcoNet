module.exports = {
  ...require('./ai-video.jest.config.cjs'),
  testMatch: [
    '<rootDir>/libraries/nestjs-libraries/src/videos/agy-mcp/**/*.spec.ts',
    '<rootDir>/libraries/nestjs-libraries/src/videos/openshorts/**/*.spec.ts',
    '<rootDir>/tests/native-agent-model/**/*.spec.ts',
    '<rootDir>/tests/source-video/**/*.spec.ts', '<rootDir>/tests/source-motion/**/*.spec.ts',
  ],
};
