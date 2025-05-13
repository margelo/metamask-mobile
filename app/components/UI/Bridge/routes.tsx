/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import Routes from '../../../constants/navigation/Routes';
import { BridgeDestTokenSelector } from './components/BridgeDestTokenSelector';
import { BridgeSourceTokenSelector } from './components/BridgeSourceTokenSelector';
import SlippageModal from './components/SlippageModal';
import { BridgeSourceNetworkSelector } from './components/BridgeSourceNetworkSelector';
import { BridgeDestNetworkSelector } from './components/BridgeDestNetworkSelector';
import QuoteInfoModal from './components/QuoteInfoModal';
import BlockExplorersModal from './components/TransactionDetails/BlockExplorersModal';
import QuoteExpiredModal from './components/QuoteExpiredModal';

const clearStackNavigatorOptions = {
  headerShown: false,
  cardStyle: {
    backgroundColor: 'transparent',
  },
  animationEnabled: false,
};

const Stack = createStackNavigator();
export const BridgeScreenStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="BridgeView" getComponent={() => require('./Views/BridgeView').default} />
  </Stack.Navigator>
);

const ModalStack = createStackNavigator();
export const BridgeModalStack = () => (
  <ModalStack.Navigator
    mode={'modal'}
    screenOptions={clearStackNavigatorOptions}
  >
    <ModalStack.Screen
      name={Routes.BRIDGE.MODALS.SOURCE_TOKEN_SELECTOR}
      getComponent={() => require('./components/BridgeSourceTokenSelector').BridgeSourceTokenSelector}
    />
    <ModalStack.Screen
      name={Routes.BRIDGE.MODALS.DEST_TOKEN_SELECTOR}
      getComponent={() => require('./components/BridgeDestTokenSelector').BridgeDestTokenSelector}
    />
    <ModalStack.Screen
      name={Routes.BRIDGE.MODALS.SOURCE_NETWORK_SELECTOR}
      getComponent={() => require('./components/BridgeSourceNetworkSelector').BridgeSourceNetworkSelector}
    />
    <ModalStack.Screen
      name={Routes.BRIDGE.MODALS.DEST_NETWORK_SELECTOR}
      getComponent={() => require('./components/BridgeDestNetworkSelector').BridgeDestNetworkSelector}
    />
    <ModalStack.Screen
      name={Routes.BRIDGE.MODALS.SLIPPAGE_MODAL}
      getComponent={() => require('./components/SlippageModal').default}
    />
    <ModalStack.Screen
      name={Routes.BRIDGE.MODALS.QUOTE_INFO_MODAL}
      getComponent={() => require('./components/QuoteInfoModal').default}
    />
    <ModalStack.Screen
      name={Routes.BRIDGE.MODALS.TRANSACTION_DETAILS_BLOCK_EXPLORER}
      getComponent={() => require('./components/TransactionDetails/BlockExplorersModal').default}
    />
    <ModalStack.Screen
      name={Routes.BRIDGE.MODALS.QUOTE_EXPIRED_MODAL}
      getComponent={() => require('./components/QuoteExpiredModal').default}
    />
  </ModalStack.Navigator>
);
