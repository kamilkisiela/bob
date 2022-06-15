/**
 * @type {import("@jest/types").Config.InitialOptions}
 */
const config = {
  preset: "ts-jest",
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
  watchPathIgnorePatterns: ["<rootDir>/test/__fixtures__/simple/dist"],
};

module.exports = config;
