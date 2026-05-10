import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClicklogCounter } from './ClicklogCounter';
import { ClicklogHistory } from './ClicklogHistory';
import Ionicons from '@expo/vector-icons/Ionicons';

type ClicklogTabParamList = {
  Counter: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<ClicklogTabParamList>();

export function ClicklogTabs() {
  return (
    <Tab.Navigator id="clicklog-tabs">
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
    </Tab.Navigator>
  );
}

export default ClicklogTabs;
