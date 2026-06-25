# External-Link Safety Primitive: Android Parity Implementation

## Date Created
2026-04-01

## Feature Summary
Shared external-link confirmation and safe-open behavior for app-level non-plugin scope.

## Parity Status
✅ **COMPLETE** — Web and Android implementations are feature-complete with full parity.

---

## Implementation Details

### Web Implementation
- **Location**: `ctf/packages/web/components/hooks/useExternalLink.tsx`
- **Components**: 
  - `useExternalLink()` hook
  - `ui/button.tsx` (Reusable button component)
  - `ui/dialog.tsx` (Radix UI Dialog wrapper)
- **Core Features**:
  1. Origin-based internal/external link detection
  2. Dialog confirmation for external links (showing domain name)
  3. Copy URL to clipboard functionality
  4. Open link in new tab with security headers (noopener, noreferrer)
  5. Supports beta.chargingthefuture.com automatically

### Android Implementation
- **Location**: `ctf/packages/mobile/src/hooks/useExternalLink.tsx`
- **Exports**: 
  - `useExternalLink()` hook
  - `UseExternalLinkResult` type interface
- **Core Features**:
  1. Same origin-based detection logic (URL.origin comparison)
  2. Native Alert dialogs for confirmation flows
  3. Share sheet for copy-to-clipboard action
  4. Direct Linking.openURL() for external opens
  5. Loading state management during open operations
  6. Error handling for malformed URLs and unavailable links
  7. Supports any domain via configurable baseURL (defaults to chargingthefuture.com)

---

## API Contract (Matched Across Platforms)

### Web
```typescript
const { openExternal, ExternalLinkDialog } = useExternalLink();

function isInternalLink(url: string): boolean;

interface ExternalLinkDialogProps {
  url: string | null;
  isOpen: boolean;
  isExternal: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: () => void;
  onOpen: () => void;
}
```

### Android
```typescript
const { openExternal, isInternal } = useExternalLink();

interface UseExternalLinkResult {
  openExternal: (url: string) => Promise<void>;
  isInternal: (url: string) => boolean;
}
```

**Key Differences** (Platform-specific, Not Breaking):
- Web: Provides component-based dialog (for composition), async/await for open
- Android: Native Alert API, async/await for open, Share API for clipboard
- Both: Same origin detection, same safety contract

---

## Parity Verification Checklist

- ✅ Internal link detection (same origin, relative paths)
- ✅ External link detection (different origin)
- ✅ Confirmation dialog/alert shown for external links
- ✅ Domain name displayed in confirmation
- ✅ Copy URL action available
- ✅ Open link action available
- ✅ Cancel action available
- ✅ Security headers/practices applied (web: noopener/noreferrer, Android: Linking API safeguards)
- ✅ Error handling for malformed URLs
- ✅ Error handling for unavailable links
- ✅ Type-safe implementations

---

## Usage Examples

### Web
```tsx
import { useExternalLink } from '@/components/hooks/useExternalLink';

export function MyComponent() {
  const { openExternal, ExternalLinkDialog } = useExternalLink();
  
  return (
    <>
      <button onClick={() => openExternal('https://example.com')}>
        Open Link
      </button>
      <ExternalLinkDialog />
    </>
  );
}
```

### Android
```tsx
import { useExternalLink } from '@/hooks/useExternalLink';

export function MyComponent() {
  const { openExternal, isInternal } = useExternalLink();
  
  return (
    <TouchableOpacity 
      onPress={async () => {
        await openExternal('https://example.com');
      }}
    >
      <Text>Open Link</Text>
    </TouchableOpacity>
  );
}
```

---

## Integration Guidance

1. **When to Use**: Any component that opens external URLs or user-provided links
2. **When NOT to Use**: Internal app navigation (use routing instead)
3. **Import Pattern**: 
   - Web: `import { useExternalLink } from '@/components/hooks/useExternalLink'`
   - Android: `import { useExternalLink } from '@/hooks/useExternalLink'`
4. **No Duplicated Logic**: Shared link-handling responsibility prevents multiple implementations

---

## Technical Notes

### Origin Detection
Both implementations use the same logic:
```
1. If URL starts with "/" = internal
2. Parse URL and compare origin with window.location.origin (web) or baseURL (Android)
3. Same origin = internal, different = external
```

### Error Handling
- Malformed URLs: Treat as internal (safe default)
- Unavailable links (Linking.canOpenURL fails): Show error alert (Android only)
- Network errors during opens: Show error alert

### Security Considerations
- **Web**: Uses `noopener,noreferrer` security headers
- **Android**: Relies on React Native's Linking API which uses system Intent framework
- **Both**: Require explicit user action to open external links

---

## Known Limitations / Future Enhancements

1. Android: Copy action uses Share sheet (native behavior) instead of silent clipboard copy
2. Both: No custom styling for confirmation dialogs on Android (native Alert component)
3. Future: Could add analytics tracking for external link opens
4. Future: Could add domain whitelist/blacklist functionality

---

## Deployment Notes

- **No database migrations required** — feature is purely client-side
- **No new environment variables required**
- **Web build command**: Standard Next.js build (no changes)
- **Android build command**: Standard Expo/EAS build (no changes)
- **Feature is behind no feature flags** — always enabled

---

## Related Documentation

- Web feature documentation: `ctf/packages/web/EXTERNAL_LINK_FEATURE.md`
- Non-plugin inventory: `ctf-non-plugin-feature-inventory.md` (Section 1.4)
- Rules reference: `.claude/rules/105-web-android-feature-parity-rules.mdc`
