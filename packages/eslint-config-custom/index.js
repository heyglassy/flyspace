module.exports = {
  extends: [
    "next",
    "turbo",
    "prettier",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  rules: {
    "@next/next/no-html-link-for-pages": "off",
    "react/jsx-key": "off",
    "react/jsx-no-literals": "warn",
    "spaced-comment": [
      "error",
      "always",
      {
        line: {
          markers: ["/"],
          exceptions: ["-", "+"],
        },
        block: {
          markers: ["!"],
          exceptions: ["*"],
          balanced: true,
        },
      },
    ],
    "no-console": "warn",

    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/consistent-type-definitions": "off",
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      },
    ],

    // Allows for _ prefixed variables to be unused
    // Ripped from https://stackoverflow.com/questions/64052318/how-to-disable-warn-about-some-unused-params-but-keep-typescript-eslint-no-un
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn", // or "error"
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-non-null-assertion": [
      "warn", // or "error"
    ],
  },
  parserOptions: {
    babelOptions: {
      presets: [require.resolve("next/babel")],
    },
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint"],
};
