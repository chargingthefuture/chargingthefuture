import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
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
