import React from 'react';
import { View } from 'react-native';
import { StreamChatView, StreamChatViewProps } from '../../components/shared/StreamChatView';

export interface StreamChatPanelProps extends StreamChatViewProps {}

export const StreamChatPanel: React.FC<StreamChatPanelProps> = (props) => {
  return (
    <View style={{ height: 300 }}>
      <StreamChatView {...props} />
    </View>
  );
};
