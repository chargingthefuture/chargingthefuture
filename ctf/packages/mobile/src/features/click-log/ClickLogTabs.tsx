// Pixel-aligned wrapper — delegates to ClickLogScreen (mockup: MobileClickLog.tsx variants).
// Named export kept as ClickLogTabs so existing index.ts contract is unchanged.
import { ClickLogScreen } from './ClickLogScreen';

export { ClickLogScreen as ClickLogTabs };

export default ClickLogScreen;
