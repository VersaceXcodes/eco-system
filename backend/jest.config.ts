module.exports = {
  "testEnvironment": "node",
  "testMatch": [
    "**/tests/**/*.test.(js|ts)"
  ],
  "transform": {
    "^.+\\.tsx?$": "ts-jest"
  },
  "moduleFileExtensions": [
    "ts",
    "tsx",
    "js",
    "json"
  ],
  "setupFilesAfterEnv": [
    "<rootDir>/tests/setupTests.ts"
  ],
  "coverageDirectory": "coverage",
  "coverageReporters": [
    "text",
    "lcov"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 85,
      "lines": 90,
      "statements": 90
    }
  },
  "testTimeout": 30000,
  "preset": "ts-jest"
};