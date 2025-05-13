/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import Regions from '../Views/Regions';
import Quotes from '../Views/Quotes';
import NetworkSwitcher from '../Views/NetworkSwitcher';
import GetStarted from '../Views/GetStarted';
import CheckoutWebView from '../Views/Checkout';
import BuildQuote from '../Views/BuildQuote';
import { RampType } from '../types';
import { RampSDKProvider } from '../sdk';
import Routes from '../../../../constants/navigation/Routes';
import { colors } from './../../../../styles/common';
const Stack = createStackNavigator();

const RampRoutes = ({ rampType }: { rampType: RampType }) => (
  <RampSDKProvider rampType={rampType}>
    <Stack.Navigator initialRouteName={Routes.RAMP.GET_STARTED}>
      <Stack.Screen name={Routes.RAMP.GET_STARTED} getComponent={() => require('../Views/GetStarted').default} />
      <Stack.Screen
        name={Routes.RAMP.NETWORK_SWITCHER}
        getComponent={() => require('../Views/NetworkSwitcher').default}
        options={{ animationEnabled: false }}
      />
      <Stack.Screen name={Routes.RAMP.BUILD_QUOTE} getComponent={() => require('../Views/BuildQuote').default} />
      <Stack.Screen
        name={Routes.RAMP.BUILD_QUOTE_HAS_STARTED}
        getComponent={() => require('../Views/BuildQuote').default}
        options={{ animationEnabled: false }}
      />
      <Stack.Screen
        name={Routes.RAMP.QUOTES}
        getComponent={() => require('../Views/Quotes').default}
        options={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.transparent },
          animationEnabled: false,
          gestureEnabled: false,
          detachPreviousScreen: false,
        }}
      />
      <Stack.Screen name={Routes.RAMP.CHECKOUT} getComponent={() => require('../Views/Checkout').default} />
      <Stack.Screen name={Routes.RAMP.REGION} getComponent={() => require('../Views/Regions').default} />
      <Stack.Screen
        name={Routes.RAMP.REGION_HAS_STARTED}
        getComponent={() => require('../Views/Regions').default}
        options={{ animationEnabled: false }}
      />
    </Stack.Navigator>
  </RampSDKProvider>
);

export default RampRoutes;
