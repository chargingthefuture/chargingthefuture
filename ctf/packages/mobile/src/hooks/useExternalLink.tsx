import { useState } from 'react';
import {
  Alert,
  Linking,
  Share,
} from 'react-native';

/**
 * Determines if a URL is internal (same origin) or external
 * - Relative paths (starting with /) are internal
 * - Absolute URLs to the same domain are internal
 * - All other URLs are external
 */
function isInternalLink(url: string, baseURL: string = 'https://lagatos.com'): boolean {
  if (url.startsWith('/')) return true;
  
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseURL);
    return urlObj.origin === baseObj.origin;
  } catch {
    // If URL parsing fails, treat as internal
    return true;
  }
}

export interface UseExternalLinkResult {
  openExternal: (_url: string) => Promise<void>;
  isInternal: (_url: string) => boolean;
}

/**
 * React Native hook for handling external link opens with confirmation dialog
 * 
 * Provides:
 * - Internal vs external link detection based on origin
 * - Alert confirmation for external links
 * - Copy to clipboard functionality (via Share on native platforms)
 * - Safe link opening with Linking API and security considerations
 * 
 * Usage:
 * ```tsx
 * const { openExternal, isInternal } = useExternalLink();
 * 
 * onPress={() => openExternal('https://example.com')}
 * ```
 */
export function useExternalLink(): UseExternalLinkResult {
  const [, setIsLoading] = useState(false);

  const openExternal = async (url: string): Promise<void> => {
    try {
      setIsLoading(true);
      
      if (isInternalLink(url)) {
        // For internal links, just open if it's an absolute URL
        // For relative paths, the calling component should handle navigation
        if (!url.startsWith('/')) {
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          }
        }
      } else {
        // For external links, show confirmation dialog
        const domain = new URL(url).hostname;
        
        // Alert with options to open, copy, or cancel
        Alert.alert(
          'Opening External Link',
          `You are about to open a link to ${domain}. This will open outside the app.`,
          [
            {
              text: 'Cancel',
              onPress: () => setIsLoading(false),
              style: 'cancel',
            },
            {
              text: 'Copy Link',
              onPress: async () => {
                try {
                  // On React Native, use Share API for clipboard access
                  await Share.share({
                    message: url,
                    title: domain,
                  });
                } catch (error) {
                  console.error('Failed to share:', error);
                  Alert.alert('Error', 'Failed to copy link');
                } finally {
                  setIsLoading(false);
                }
              },
            },
            {
              text: 'Open Link',
              onPress: async () => {
                try {
                  const canOpen = await Linking.canOpenURL(url);
                  if (canOpen) {
                    await Linking.openURL(url);
                  } else {
                    Alert.alert('Error', `Cannot open link to ${domain}`);
                  }
                } catch (error) {
                  console.error('Failed to open URL:', error);
                  Alert.alert('Error', 'Failed to open link');
                } finally {
                  setIsLoading(false);
                }
              },
              style: 'default',
            },
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      console.error('Error in openExternal:', error);
      Alert.alert('Error', 'Failed to process link');
      setIsLoading(false);
    }
  };

  return {
    openExternal,
    isInternal: (url: string) => isInternalLink(url),
  };
}
