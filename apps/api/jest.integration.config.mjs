export default {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testMatch: ['<rootDir>/test/**/*.integration-spec.ts'],
  moduleNameMapper: {
    '^@work-archive/shared-types$':
      '<rootDir>/../../packages/shared-types/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};
