export type BeaconHostStatus = {
    text: string;
    warn: boolean;
};
export declare function beaconHostStatus(micOn: boolean, cameraOn: boolean, isSharing: boolean): BeaconHostStatus;
