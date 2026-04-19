import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { StreamChatPanel } from '../chyme/StreamChatPanel';
import { StreamVideoPanel } from '../chyme/StreamVideoPanel';
import { fetchSocketRelayStreamCredentials, SocketRelayStreamCredentials } from './fetchSocketRelayStreamCredentials';

export const SocketRelayStreamTab = () => {
  const [credentials, setCredentials] = useState<SocketRelayStreamCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchSocketRelayStreamCredentials()
      .then((creds) => {
        if (mounted) setCredentials(creds);
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <View><Text>Loading chat…</Text></View>;
  }
  if (error) {
    return <View><Text style={{ color: 'red' }}>{error}</Text></View>;
  }
  if (!credentials) {
    return <View><Text>Chat not configured.</Text></View>;
  }
  return (
    <>
      <StreamVideoPanel {...credentials} />
      <StreamChatPanel {...credentials} />
    </>
  );
};
