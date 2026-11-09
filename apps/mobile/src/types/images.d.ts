// Metro turns an imported image into an asset reference. Expo ships a matching declaration, but only the
// generated `.expo/types` would load it, and CI never generates those.
declare module "*.png" {
  import type { ImageSourcePropType } from "react-native";

  const source: ImageSourcePropType;
  export default source;
}
