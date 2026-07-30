module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^\\./enums\\.js$': '<rootDir>/generated/prisma/enums.ts',
    '^\\./internal/(.*)\\.js$': '<rootDir>/generated/prisma/internal/$1.ts',
    '^\\./models/(.*)\\.js$': '<rootDir>/generated/prisma/models/$1.ts',
    '^\\./commonInputTypes\\.js$': '<rootDir>/generated/prisma/commonInputTypes.ts',
    '^\\./browser\\.js$': '<rootDir>/generated/prisma/browser.ts',
    '^\\./client\\.js$': '<rootDir>/generated/prisma/client.ts',
    '^\\./models\\.js$': '<rootDir>/generated/prisma/models.ts',
    '^\\.\\./enums\\.js$': '<rootDir>/generated/prisma/enums.ts',
    '^\\.\\./internal/(.*)\\.js$': '<rootDir>/generated/prisma/internal/$1.ts',
  },
};