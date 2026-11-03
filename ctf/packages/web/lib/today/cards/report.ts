import { SAFETY_REPORT_DETAIL_MAX_LENGTH } from 'lib/safety/constants';

export const REPORTED_TEXT_MAX = 500;

// What the admin reports screen shows for a report made from a Today card: the card id and, for a
// message, its text cut to 500 characters.
export function reportDetail(cardId: string, messageBody: string | null): string {
  const card = `Reported from Today card ${cardId}`;
  if (messageBody === null) return `${card}: the card itself.`.slice(0, SAFETY_REPORT_DETAIL_MAX_LENGTH);
  const text = messageBody.length > REPORTED_TEXT_MAX ? `${messageBody.slice(0, REPORTED_TEXT_MAX)}…` : messageBody;
  return `${card}, a message: ${text}`.slice(0, SAFETY_REPORT_DETAIL_MAX_LENGTH);
}
