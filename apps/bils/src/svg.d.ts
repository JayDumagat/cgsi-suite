declare module "*.svg?react" {
  export const ReactComponent: import("react").FC<import("react").SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}
