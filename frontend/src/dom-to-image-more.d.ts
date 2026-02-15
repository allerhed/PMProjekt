declare module 'dom-to-image-more' {
  interface Options {
    filter?: (node: Node) => boolean;
    bgcolor?: string;
    width?: number;
    height?: number;
    style?: Record<string, string>;
    quality?: number;
    scale?: number;
    cacheBust?: boolean;
    imagePlaceholder?: string;
    copyDefaultStyles?: boolean;
    useCredentials?: boolean;
    httpTimeout?: number;
    adjustClonedNode?: (original: Node, clone: Node, after: boolean) => void;
    onclone?: (clonedNode: HTMLElement) => void | Promise<void>;
  }

  function toSvg(node: Node, options?: Options): Promise<string>;
  function toPng(node: Node, options?: Options): Promise<string>;
  function toJpeg(node: Node, options?: Options): Promise<string>;
  function toBlob(node: Node, options?: Options): Promise<Blob>;
  function toPixelData(node: Node, options?: Options): Promise<Uint8ClampedArray>;
  function toCanvas(node: Node, options?: Options): Promise<HTMLCanvasElement>;

  const domtoimage: {
    toSvg: typeof toSvg;
    toPng: typeof toPng;
    toJpeg: typeof toJpeg;
    toBlob: typeof toBlob;
    toPixelData: typeof toPixelData;
    toCanvas: typeof toCanvas;
  };

  export default domtoimage;
}
