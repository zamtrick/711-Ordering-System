declare module "*.png" {
  const value: number;
  export default value;
}

declare module "*.jpg" {
  const value: number;
  export default value;
}

declare module "*.jpeg" {
  const value: number;
  export default value;
}

declare module "*.gif" {
  const value: number;
  export default value;
}

declare module "*.svg" {
  const value: React.ComponentType<any>;
  export default value;
}

declare module "@expo/vector-icons/*" {
  import { ComponentType } from "react";
  const Icon: ComponentType<any>;
  export default Icon;
}
