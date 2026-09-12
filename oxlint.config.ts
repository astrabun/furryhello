export default {
  $schema: "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  ignorePatterns: ["**/_site/**", "**/node_modules/**", "**/.turbo/**"],
  categories: {
    correctness: "error",
    suspicious: "warn",
  },
  rules: {
    "no-underscore-dangle": "off",
  },
};
