import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ClicklogCounter } from './ClicklogCounter';
import { ClicklogHistory } from './ClicklogHistory';

type ClicklogTabParamList = {
  Counter: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<ClicklogTabParamList>();
// @types/react 19.2 + React Navigation v7 overload resolution incompatibility:
// JSX children no longer satisfy the navigator's overloaded prop signature.
// TODO: remove cast when @react-navigation/bottom-tabs ships React 19.2-compatible types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TabNavigator = Tab.Navigator as React.ComponentType<any>;

export function ClicklogTabs() {
  const [tab, setTab] = useState('counter');

  return (
    <TabNavigator>
      <Tab.Screen
        name="Counter"
        component={ClicklogCounter}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={ClicklogHistory}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
        }}
      />
    </TabNavigator>
  );
}

export default ClicklogTabs;

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: '#181A20', borderBottomWidth: 1, borderBottomColor: '#23262F' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#EAB308' },
  tabLabel: { color: '#9CA3AF', fontSize: 15, fontWeight: '600' },
  tabLabelActive: { color: '#EAB308' },
});
