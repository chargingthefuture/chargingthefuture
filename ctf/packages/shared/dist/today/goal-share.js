// A PeerProgramming goal shared as a picture (the approved 3.1 board "Share picture"), and the
// "Your goal" card on Today (the board "Today, a quiet day"). The words and the picture's layout
// live here so web (components/se-frame/share/) and Android (src/features/se-frame/share/) draw the
// same picture from the same numbers.
//
// The picture never names who helped. PeerProgramming records no agreement to be named, so a
// helper is always "a member of the Avenhood". It carries the goal's title, how far it got, the
// sharer's own handle, one line about the app and a QR code to signed-out Today. Nothing from a
// Weavers room or the Directory is ever in it.
export function seGoalProgress(tasks, ownerUserId, reached) {
    const taken = tasks.filter((task) => task.status !== 'open').length;
    const helpers = new Set(tasks
        .filter((task) => (task.status === 'finished' || task.status === 'kept') && task.takenByUserId && task.takenByUserId !== ownerUserId)
        .map((task) => task.takenByUserId)).size;
    return { taken, total: tasks.length, reached, helpers };
}
// No public page exists for one goal, so the link and the QR code lead to signed-out Today.
export const SE_GOAL_SHARE_LINK = 'https://app.lagatos.com/today';
export const SE_GOAL_SHARE_LINK_LABEL = 'app.lagatos.com';
export const SE_GOAL_SHARE_WORDS = {
    title: 'Share',
    close: 'Close',
    shareThisGoal: 'Share this goal',
    picture: 'The picture that will be saved',
    reached: 'Goal reached',
    about: 'Skills Economy is a free app where survivors trade skills and help each other.',
    save: 'Save picture',
    saving: 'Saving…',
    saved: 'Picture saved',
    saveFailed: 'The picture was not saved: this device would not make the image file.',
    copy: 'Copy as text',
    copied: 'Copied',
    copyFailed: 'Nothing was copied: this device refused the clipboard.',
    qr: `QR code for ${SE_GOAL_SHARE_LINK_LABEL}`,
};
export function seGoalTakenLine(goal) {
    return `${goal.taken} of ${goal.total} ${goal.total === 1 ? 'task' : 'tasks'} taken`;
}
// The small colored line on the "Your goal" card.
export function seGoalCardLabel(goal) {
    return goal.reached ? 'Your goal · reached' : `Your goal · ${seGoalTakenLine(goal)}`;
}
// The progress bar's share, 0 to 100. A reached goal is full.
export function seGoalPercent(goal) {
    if (goal.reached)
        return 100;
    return goal.total === 0 ? 0 : Math.round((goal.taken / goal.total) * 100);
}
function helpersPhrase(helpers) {
    return helpers === 1 ? 'a member of the Avenhood' : `${helpers} members of the Avenhood`;
}
export function seGoalShareKicker(goal) {
    return goal.reached ? SE_GOAL_SHARE_WORDS.reached : `A goal · ${seGoalTakenLine(goal)}`;
}
// Who helped, never by name. Null when nobody else has done one of its tasks yet.
export function seGoalShareCredit(goal) {
    if (goal.helpers === 0)
        return null;
    return goal.reached ? `Thanks to ${helpersPhrase(goal.helpers)}` : `Helped so far by ${helpersPhrase(goal.helpers)}`;
}
// What "Copy as text" copies: one plain sentence or two, then the link.
export function seGoalShareText(share) {
    const credit = seGoalShareCredit(share);
    const head = share.reached ? `Goal reached: ${share.title}.` : `A goal on Skills Economy: ${share.title}. ${seGoalTakenLine(share)}.`;
    return [head, credit ? `${credit}.` : null, SE_GOAL_SHARE_WORDS.about, SE_GOAL_SHARE_LINK].filter(Boolean).join(' ');
}
// Greedy word wrap by character count: the picture is drawn without measuring text, so each line
// is kept short enough for its width at its size. A word longer than a line is cut.
export function seWrapLines(text, maxChars, maxLines) {
    const lines = [];
    let line = '';
    for (const raw of text.split(/\s+/).filter(Boolean)) {
        let word = raw;
        while (word.length > maxChars) {
            if (line)
                lines.push(line);
            lines.push(word.slice(0, maxChars));
            line = '';
            word = word.slice(maxChars);
        }
        const next = line ? `${line} ${word}` : word;
        if (next.length <= maxChars)
            line = next;
        else {
            lines.push(line);
            line = word;
        }
    }
    if (line)
        lines.push(line);
    if (lines.length <= maxLines)
        return lines;
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, maxChars - 1).trimEnd()}…`;
    return kept;
}
// A QR code as one path in module units (one square per dark module), from any encoder's
// isDark(row, col), so each platform keeps its own encoder and draws the same shape.
export function seQrPath(moduleCount, isDark) {
    const parts = [];
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++)
            if (isDark(row, col))
                parts.push(`M${col} ${row}h1v1h-1z`);
    }
    return parts.join('');
}
// The QR code stays dark on light in every theme: scanners read an inverted code badly.
export const SE_QR_DARK = '#2a1a1d';
export const SE_QR_LIGHT = '#fffaf6';
export const SE_SHARE_PICTURE_WIDTH = 358;
const PAD = 18;
const QR_SIZE = 84;
// A seed for the helper's picture that is nobody's account: the helper is never identified.
export const SE_SHARE_HELPER_SEED = 'avenhood-member';
function text(ctx, x, y, value, size, font, weight, fill, letterSpacing) {
    ctx.items.push({ type: 'text', x, y, text: value, size, font, weight, fill, ...(letterSpacing ? { letterSpacing } : {}) });
}
// The top half: the kicker, the title and who helped. Returns where the dashed line goes.
function drawTop(ctx, share) {
    const { t } = ctx;
    text(ctx, PAD, PAD + 12, seGoalShareKicker(share).toUpperCase(), 12, 'sans', 700, t.kind.ask, 1.2);
    let y = PAD + 22;
    for (const line of seWrapLines(share.title, 24, 4)) {
        text(ctx, PAD, y + 24, line, 26, 'serif', 600, t.ink);
        y += 30;
    }
    const credit = seGoalShareCredit(share);
    if (credit) {
        y += 10;
        ctx.items.push({ type: 'avatar', x: PAD, y, size: 28, accountId: SE_SHARE_HELPER_SEED });
        text(ctx, PAD + 36, y + 19, credit, 14, 'sans', 400, t.ink);
        y += 28;
    }
    return y + PAD;
}
// The bottom half: the sharer, a line about the app, the address and the QR code.
function drawBottom(ctx, top, handle, accountId, qr) {
    const { t } = ctx;
    const width = SE_SHARE_PICTURE_WIDTH;
    let y = top + 14;
    if (handle && accountId) {
        ctx.items.push({ type: 'avatar', x: PAD, y, size: 26, accountId });
        text(ctx, PAD + 34, y + 17, handle, 13, 'sans', 700, t.ink);
        y += 32;
    }
    for (const line of seWrapLines(SE_GOAL_SHARE_WORDS.about, 34, 4)) {
        text(ctx, PAD, y + 13, line, 13, 'sans', 400, t.ink);
        y += 18;
    }
    text(ctx, PAD, y + 16, SE_GOAL_SHARE_LINK_LABEL, 12, 'sans', 700, t.wordmark);
    y += 20;
    const column = y - (top + 14);
    const height = Math.max(column, QR_SIZE) + 28;
    ctx.items.push({ type: 'qr', x: width - PAD - QR_SIZE, y: top + height / 2 - QR_SIZE / 2, size: QR_SIZE, modules: qr.modules, d: qr.d });
    return top + height;
}
// The picture as plain shapes, for an SVG on web and react-native-svg on Android. Colors come from
// the member's theme, so the saved picture matches what they see.
export function seGoalSharePicture(share, sharer, t, qr) {
    const width = SE_SHARE_PICTURE_WIDTH;
    const top = [];
    const ctx = { items: [], t };
    const divider = drawTop(ctx, share);
    const bottom = drawBottom(ctx, divider, sharer?.handle ?? null, sharer?.accountId ?? null, qr);
    const r = 20;
    top.push({ type: 'rect', x: 0.75, y: 4.75, w: width - 1.5, h: bottom - 1.5, r, fill: t.line });
    top.push({ type: 'rect', x: 0.75, y: 0.75, w: width - 1.5, h: bottom - 1.5, r, fill: t.sunk });
    top.push({ type: 'path', d: `M0.75 ${divider}V${r + 0.75}A${r} ${r} 0 0 1 ${r + 0.75} 0.75H${width - r - 0.75}A${r} ${r} 0 0 1 ${width - 0.75} ${r + 0.75}V${divider}Z`, fill: t.card });
    top.push({ type: 'line', x1: 0.75, y1: divider, x2: width - 0.75, y2: divider, stroke: t.hair, strokeWidth: 1.5, dash: '6 4' });
    const border = { type: 'rect', x: 0.75, y: 0.75, w: width - 1.5, h: bottom - 1.5, r, fill: 'none', stroke: t.line, strokeWidth: 1.5 };
    return { width, height: bottom + 4, items: [...top, ...ctx.items, border] };
}
