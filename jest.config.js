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
};

module.exports = config;
