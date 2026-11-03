export declare const SE_ROOM_ICONS: {
    back: string[];
    bringIn: string[];
    hand: string[];
    micOff: string[];
    micOn: string[];
    close: string[];
};
export declare const SE_ROOM_ICON_SHAPES: {
    bringInHead: {
        cx: number;
        cy: number;
        r: number;
    };
    micBody: {
        x: number;
        y: number;
        width: number;
        height: number;
        rx: number;
    };
    moreDots: {
        cx: number;
        cy: number;
        r: number;
    }[];
};
export type SeRoomIconName = keyof typeof SE_ROOM_ICONS | 'more';
