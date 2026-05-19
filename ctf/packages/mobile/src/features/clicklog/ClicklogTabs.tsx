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
    // React Navigation v7's prop types declare `children` as a required
    // structural prop but TypeScript narrows the overload from the JSX
    // props object alone (without seeing the JSX children below). Known
    // upstream typing issue under React 19; runtime is fine. See
    // ctf-skills-hunt-session-continuity.md §10 for the documentation
    // trail behind this suppression.
    // @ts-expect-error RN-Nav-v7 children-narrowing — see comment above
    <Tab.Navigator>
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
