import { describe, expect, it } from 'vitest';
import { seRoomBarLine, seRoomOnStage, seRoomView, seTalkSpan } from '@ctf/shared';

describe('3.1 live room words', () => {
  const start = new Date(2026, 10, 3, 13, 30);
  const talk = { title: 'Holiday asks', host: 'teodor_b', startIso: start.toISOString(), endIso: new Date(2026, 10, 3, 15, 0).toISOString(), onAir: true };

  it('leaves out the first PM when both ends of a talk share it', () => {
    expect(seTalkSpan(talk)).toMatch(/^1:30 to 3:00\sPM/);
    const morning = { ...talk, startIso: new Date(2026, 10, 3, 11, 0).toISOString() };
    expect(seTalkSpan(morning)).toMatch(/^11:00\sAM to 3:00\sPM/);
  });

  it('puts the talk on the air in the title, under the room and its audience', () => {
    const view = seRoomView('main', { joined: true, name: 'Main Room', count: 3 }, talk);
    expect(view.heading).toBe('Holiday asks');
    expect(view.eyebrowName).toBe('Main Room');
    expect(view.audience).toBe('open to everyone');
    expect(view.talkLine).toMatch(/^On TI Radio, hosted by teodor_b, 1:30 to 3:00/);
    expect(view.words.guestNotice).toBe('Guests may be listening');
    const quiet = seRoomView('main', { joined: false, name: null, count: 0 }, null);
    expect(quiet.heading).toBe('Main Room');
    expect(quiet.eyebrowName).toBeNull();
    expect(quiet.audience).toBe('Open to everyone');
    expect(quiet.quiet).toBe(true);
  });

  it('seats people by microphone, and by role in hand-raise mode', () => {
    expect(seRoomOnStage({ micOn: true, guest: false, role: 'listener' }, 'open')).toBe(true);
    expect(seRoomOnStage({ micOn: false, guest: false, role: 'speaker' }, 'open')).toBe(false);
    expect(seRoomOnStage({ micOn: false, guest: false, role: 'speaker' }, 'hand_raise')).toBe(true);
    expect(seRoomOnStage({ micOn: false, guest: true, role: null }, 'open')).toBe(false);
  });

  it('says who is speaking on the room bar', () => {
    expect(seRoomBarLine(['farah'], false)).toBe('farah is speaking · you are listening');
    expect(seRoomBarLine(['farah', 'teo'], true)).toBe('farah and teo are speaking · you are speaking');
    expect(seRoomBarLine(['a', 'b', 'c'], false)).toBe('a and 2 others are speaking · you are listening');
    expect(seRoomBarLine([], false)).toBe('You are listening');
  });
});
