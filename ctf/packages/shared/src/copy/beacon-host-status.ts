// The line under the Beacon host's broadcast buttons, shared by the web admin page
// (components/beacon/beacon-host-controls.tsx) and the Android app
// (src/features/beacon/BeaconHostControls.tsx) so both say the same thing.
//
// The microphone and the camera are separate buttons, each with its own permission prompt (owner
// report: one button for both sometimes got only one prompt, and a broadcast went out with no
// sound). So the line names what is actually going out, and `warn` is true when a picture is going
// out with the microphone off, the case where viewers hear nothing and the host would not notice.
export type BeaconHostStatus = { text: string; warn: boolean };

export function beaconHostStatus(micOn: boolean, cameraOn: boolean, isSharing: boolean): BeaconHostStatus {
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
