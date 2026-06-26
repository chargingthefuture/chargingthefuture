import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { WhatWorksList } from './WhatWorksList';
import { WhatWorksSuggest } from './WhatWorksSuggest';
import { WhatWorksPublic } from './WhatWorksPublic';
import { useAuth } from '../../auth/auth-context';

type WhatWorksTabParamList = {
  List: undefined;
  Suggest: undefined;
};

const Tab = createBottomTabNavigator<WhatWorksTabParamList>();
// @types/react 19.2 + React Navigation v7 overload resolution incompatibility:
// JSX children no longer satisfy the navigator's overloaded prop signature.
// TODO: remove cast when @react-navigation/bottom-tabs ships React 19.2-compatible types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TabNavigator = Tab.Navigator as React.ComponentType<any>;

export function WhatWorksTabs() {
  const { isAuthenticated, signIn } = useAuth();

  // Signed-out visitors see the public teaser (matching web), not an authed list that 401s.
  // The List/Suggest tabs both need a signed-in survivor, so they only mount once authenticated.
  if (!isAuthenticated) {
    return <WhatWorksPublic onSignIn={() => { void signIn(); }} />;
  }

  return (
    <TabNavigator>
      <Tab.Screen
        name="List"
        component={WhatWorksList}
        options={{
          title: 'What Works',
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Suggest"
        component={WhatWorksSuggest}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
        }}
      />
    </TabNavigator>
  );
}

export default WhatWorksTabs;
