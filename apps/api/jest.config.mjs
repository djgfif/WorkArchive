export default {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '^@work-archive/shared-types$':
      '<rootDir>/../../packages/shared-types/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
};
