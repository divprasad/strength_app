import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"]
  }),
  {
    ignores: ["next-env.d.ts", ".next/**", "node_modules/**"]
  }
];

export default config;
