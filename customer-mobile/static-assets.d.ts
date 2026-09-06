/// <reference types="expo/types" />

// Static asset module declarations — Metro bundles these imports as numeric
// module IDs, so TypeScript needs a declared module for each asset extension
// used with ES `import` syntax (e.g. `import logo from "@/assets/x.png"`).
declare module "*.png" {
  const value: number;
  export default value;
}
