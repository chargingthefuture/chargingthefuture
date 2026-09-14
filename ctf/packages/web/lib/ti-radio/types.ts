// What the guide is, in the shapes the page and the routes pass around.

/** A slot's state on the grid. 'open' is the absence of a booking, not a stored row. */
export type TiRadioSlotState = 'open' | 'booked';

/**
 * One 90 minutes on the guide. Every start in the window appears, booked or not, because the empty
 * ones are half of what the page is for: an empty row is the thing a member clicks to host.
 */
export type TiRadioGuideSlot = {
  slotStartIso: string;
  slotEndIso: string;
  state: TiRadioSlotState;
  /** Present only when the slot is booked. */
  booking: TiRadioBooking | null;
  /** True while this slot is the 90 minutes happening right now. */
  isOnAir: boolean;
};

/**
 * A booked slot as everybody sees it. Public by design: a host's name and subject are the schedule.
 * Nothing else about the host is here — no contact details, no account state.
 */
export type TiRadioBooking = {
  id: string;
  hostUsername: string;
  title: string;
  description: string | null;
  createdAtIso: string;
  /** True when the viewer is the host, so the page can offer them the release control. */
  isViewerHost: boolean;
};

/** What the viewer may do, worked out once on the server so the page never guesses. */
export type TiRadioViewerState = {
  isSignedIn: boolean;
  /** Signed in and approved in Unlock. Booking needs both. */
  canHost: boolean;
  isAdmin: boolean;
  /** This viewer's upcoming slot starts, so the page can mark their own rows. */
  bookedSlotStarts: string[];
};

export type TiRadioGuide = {
  /** Every slot start in the window, ascending. */
  slots: TiRadioGuideSlot[];
  windowStartIso: string;
  windowEndIso: string;
  slotMinutes: number;
  maxSlotsPerDay: number;
  viewer: TiRadioViewerState;
};

export type TiRadioAuditEvent = {
  pluginId: 'ti-radio';
  command: 'ti-radio.slot.book' | 'ti-radio.slot.release' | 'ti-radio.slot.remove';
  actorId: string;
  status: 'allow' | 'deny';
  reason: string;
  /** The policy evidence string from the access-policy contract, e.g. 'role=admin'. */
  evidence?: string;
  target: Record<string, string | null | undefined>;
  result: 'success' | 'failure';
  errorCategory: string | null;
};
