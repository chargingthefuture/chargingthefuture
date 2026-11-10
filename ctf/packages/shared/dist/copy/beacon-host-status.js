export function beaconHostStatus(micOn, cameraOn, isSharing) {
    const picture = isSharing ? 'screen' : cameraOn ? 'camera' : null;
    if (picture && micOn) {
        return { text: `Your ${picture} and microphone are live to the broadcast.`, warn: false };
    }
    if (picture) {
        return { text: `Your ${picture} is live, but your microphone is off. Viewers cannot hear you.`, warn: true };
    }
    if (micOn) {
        return { text: 'Your microphone is live to the broadcast. Turn on the camera or share a screen to be seen.', warn: false };
    }
    return {
        text: 'Go live with your microphone and camera, from a phone or a computer. Each button asks for its own permission.',
        warn: false,
    };
}
