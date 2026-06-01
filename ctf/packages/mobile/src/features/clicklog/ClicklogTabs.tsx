// Pixel-aligned wrapper — delegates to ClicklogScreen (mockup: MobileClickLog.tsx variants).
// Named export kept as ClicklogTabs so existing index.ts contract is unchanged.
import { ClicklogScreen } from './ClicklogScreen';

export { ClicklogScreen as ClicklogTabs };

export default ClicklogScreen;
