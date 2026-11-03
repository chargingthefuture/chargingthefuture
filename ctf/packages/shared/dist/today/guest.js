// Today for a visitor who is not signed in, shared by web and Android: the words of the approved
// signed-out board ("Today, signed out" in the 3.1 design canvas) and which cards a visitor can
// answer only by signing up.
export const SE_GUEST_WORDS = {
    brand: 'Skills Economy',
    signIn: 'Sign in',
    signUp: 'Sign up',
    hero: "Skills Economy is where the Avenhood meets: survivors giving half an hour a day to each other's goals. Free. Exit their economy, exit the psyop.",
    live: 'LIVE',
    listen: 'Listen as a guest',
    listenNote: 'Anyone can listen, no account needed. Sign in to speak.',
    listenUnavailable: "Listening in without an account isn't available right now.",
    quiet: 'Quiet right now',
    playReadings: 'Play readings',
    readingsNote: 'Recorded blog posts, one after another',
    nextRoom: 'Next room',
    cardsTitle: "Today's cards",
    readOnly: 'Read only',
    member: 'A member',
    answer: 'Sign up to answer',
    peopleTitle: 'People',
    peopleLocked: 'Who is here and what they can do opens once a member is reviewed.',
    bar: 'Free. Use one part, ignore the rest.',
    loading: 'Loading Today…',
    failed: 'Could not load Today.',
    tryAgain: 'Try again',
};
// An ask or an offer is answered by a member; a visitor sees who as "A member" and a Sign up button.
export function seGuestAnswersBySignUp(card) {
    return card.kind === 'ask' || card.kind === 'offer' || card.kind === 'match';
}
// "Started at 1:53 PM" in the reader's own timezone, for a talk that is on.
export function seGuestStartedLine(startIso) {
    return `Started at ${new Date(startIso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`;
}
// "Wednesday, October 28 at 7:00 PM CDT" for the next room on a quiet day.
export function seGuestNextRoomLine(startIso) {
    const start = new Date(startIso);
    const day = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    return `${day} at ${time}`;
}
