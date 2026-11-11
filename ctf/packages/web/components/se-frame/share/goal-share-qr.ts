import qrcode from 'qrcode-generator';
import { seQrPath } from '@ctf/shared';

// The share picture's QR code, encoded in the page (qrcode-generator, MIT). Medium error correction
// so a slightly blurred photo of the picture still scans.
export function qrFor(text: string): { modules: number; d: string } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const modules = qr.getModuleCount();
  return { modules, d: seQrPath(modules, (row, col) => qr.isDark(row, col)) };
}
