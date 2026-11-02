// The word ladder: change one letter at a time to turn the first word into the last, every step a
// real word. Shared by web and Android so a guess is judged the same on both.
import { SE_LADDER_COMMON, SE_LADDER_WORDS } from './ladder-words';
let words = null;
let common = null;
function wordSet() {
    words ??= new Set(SE_LADDER_WORDS.split(' ').filter(Boolean));
    return words;
}
function commonSet() {
    common ??= new Set(SE_LADDER_COMMON.split(' ').filter(Boolean));
    return common;
}
export function seIsLadderWord(word) {
    return wordSet().has(word.toLowerCase());
}
export function seOneLetterApart(a, b) {
    if (a.length !== b.length)
        return false;
    let differ = 0;
    for (let i = 0; i < a.length; i += 1)
        if (a[i] !== b[i])
            differ += 1;
    return differ === 1;
}
function neighbors(word, within) {
    const out = [];
    for (let i = 0; i < word.length; i += 1) {
        for (let code = 97; code <= 122; code += 1) {
            const next = word.slice(0, i) + String.fromCharCode(code) + word.slice(i + 1);
            if (next !== word && within.has(next))
                out.push(next);
        }
    }
    return out;
}
function shortest(from, to, within) {
    const back = new Map([[from, null]]);
    const queue = [from];
    while (queue.length > 0) {
        const word = queue.shift();
        if (word === to)
            break;
        for (const next of neighbors(word, within)) {
            if (back.has(next))
                continue;
            back.set(next, word);
            queue.push(next);
        }
    }
    if (!back.has(to))
        return null;
    const path = [];
    for (let at = to; at !== null; at = back.get(at) ?? null)
        path.unshift(at);
    return path;
}
// A shortest ladder from one word to another, both ends included, through everyday words where one
// exists (so a hint never suggests an odd word), else through every accepted word; null when none.
export function seLadderPath(from, to) {
    return shortest(from, to, new Set([...commonSet(), from, to])) ?? shortest(from, to, wordSet());
}
// Whether a typed word can be the next step after `last`.
export function seCheckLadderStep(last, typed) {
    const word = typed.trim().toLowerCase();
    if (!/^[a-z]{4}$/.test(word))
        return { ok: false, reason: 'Four letters, please.' };
    if (!seOneLetterApart(last, word))
        return { ok: false, reason: `Change exactly one letter of ${last.toUpperCase()}.` };
    if (!seIsLadderWord(word))
        return { ok: false, reason: `${word.toUpperCase()} is not in the word list.` };
    return { ok: true };
}
