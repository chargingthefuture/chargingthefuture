// Settings → Text size on Android: the screen drawn larger by the same amount the web zooms it
// (SE_TEXT_SIZE_SCALE). The content is laid out at the phone's width divided by the scale, scaled
// up from its top left corner, and the space it takes is set to its scaled height so the scroll
// reaches the end.

import React, { useState, type ReactNode } from 'react';
import { View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

export function ScaledScreen({ scale, style, children }: { scale: number; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  if (scale === 1) return <View style={style}>{children}</View>;
  return (
    <View style={{ height: height * scale, overflow: 'hidden' }}>
      <View
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        style={[style, { width: width / scale, transform: [{ scale }], transformOrigin: 'top left' }]}
      >
        {children}
      </View>
    </View>
  );
}
