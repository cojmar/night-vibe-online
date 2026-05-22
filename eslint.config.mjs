export default [
  {
    ignores: [
      "assets/**",
      "graphify-out/**",
      ".vscode/**"
    ]
  },
  {
    files: ["app/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        WebSocket: "readonly",
        BSON: "readonly",
        run_mode: "readonly",
        XMLHttpRequest: "readonly",
        FileReader: "readonly",
        ResizeObserver: "readonly",
        requestAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        alert: "readonly",
        confirm: "readonly",
        console: "readonly",
        Date: "readonly",
        Math: "readonly",
        JSON: "readonly",
        performance: "readonly",
        navigator: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-redeclare": "error",
      "no-unreachable": "warn",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  }
];
