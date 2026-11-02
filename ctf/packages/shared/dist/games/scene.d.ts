export declare const SE_SCENE_SIZE = 300;
export declare const SE_SCENE_STRIPS = 5;
export type SeShape = {
    kind: 'rect';
    x: number;
    y: number;
    w: number;
    h: number;
    fill: string;
} | {
    kind: 'circle';
    cx: number;
    cy: number;
    r: number;
    fill: string;
} | {
    kind: 'path';
    d: string;
    fill: string;
    stroke?: string;
};
export type SeScene = {
    name: string;
    shapes: SeShape[];
};
export declare function seSeededRandom(seed: string): () => number;
export declare function seScene(seed: string): SeScene;
