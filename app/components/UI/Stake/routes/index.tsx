/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import Routes from '../../../../constants/navigation/Routes';
import { Confirm } from '../../../Views/confirmations/components/confirm';
import StakeConfirmationView from '../Views/StakeConfirmationView/StakeConfirmationView';
import UnstakeConfirmationView from '../Views/UnstakeConfirmationView/UnstakeConfirmationView';
import { StakeSDKProvider } from '../sdk/stakeSdkProvider';
import MaxInputModal from '../../Earn/components/MaxInputModal';
import GasImpactModal from '../components/GasImpactModal';
import StakeEarningsHistoryView from '../Views/StakeEarningsHistoryView/StakeEarningsHistoryView';
import PoolStakingLearnMoreModal from '../components/PoolStakingLearnMoreModal';
import EarnTokenList from '../../Earn/components/EarnTokenList';
import EarnInputView from '../../Earn/Views/EarnInputView/EarnInputView';
import EarnWithdrawInputView from '../../Earn/Views/EarnWithdrawInputView/EarnWithdrawInputView';

const Stack = createStackNavigator();
const ModalStack = createStackNavigator();

const clearStackNavigatorOptions = {
  headerShown: false,
  cardStyle: {
    backgroundColor: 'transparent',
  },
  animationEnabled: false,
};

// Regular Stack for Screens
const StakeScreenStack = () => (
  <StakeSDKProvider>
    <Stack.Navigator>
      <Stack.Screen name={Routes.STAKING.STAKE} getComponent={() => require('../../Earn/Views/EarnInputView/EarnInputView').default} />
      <Stack.Screen
        name={Routes.STAKING.UNSTAKE}
        getComponent={() => require('../../Earn/Views/EarnWithdrawInputView/EarnWithdrawInputView').default}
      />
      <Stack.Screen
        name={Routes.STAKING.STAKE_CONFIRMATION}
        getComponent={() => require('../Views/StakeConfirmationView/StakeConfirmationView').default}
      />
      <Stack.Screen
        name={Routes.STAKING.UNSTAKE_CONFIRMATION}
        getComponent={() => require('../Views/UnstakeConfirmationView/UnstakeConfirmationView').default}
      />
      <Stack.Screen
        name={Routes.STAKING.EARNINGS_HISTORY}
        getComponent={() => require('../Views/StakeEarningsHistoryView/StakeEarningsHistoryView').default}
      />
      <Stack.Screen
        name={Routes.STANDALONE_CONFIRMATIONS.STAKE_DEPOSIT}
        getComponent={() => require('../../../Views/confirmations/components/confirm').Confirm}
      />
      <Stack.Screen
        name={Routes.STANDALONE_CONFIRMATIONS.STAKE_WITHDRAWAL}
        getComponent={() => require('../../../Views/confirmations/components/confirm').Confirm}
      />
      <Stack.Screen
        name={Routes.STANDALONE_CONFIRMATIONS.STAKE_CLAIM}
        getComponent={() => require('../../../Views/confirmations/components/confirm').Confirm}
      />
    </Stack.Navigator>
  </StakeSDKProvider>
);

// Modal Stack for Modals
const StakeModalStack = () => (
  <StakeSDKProvider>
    <ModalStack.Navigator
      mode={'modal'}
      screenOptions={clearStackNavigatorOptions}
    >
      <ModalStack.Screen
        name={Routes.STAKING.MODALS.LEARN_MORE}
        getComponent={() => require('../components/PoolStakingLearnMoreModal').default}
        options={{ headerShown: false }}
      />
      <ModalStack.Screen
        name={Routes.STAKING.MODALS.MAX_INPUT}
        getComponent={() => require('../../Earn/components/MaxInputModal').default}
        options={{ headerShown: false }}
      />
      <ModalStack.Screen
        name={Routes.STAKING.MODALS.GAS_IMPACT}
        getComponent={() => require('../components/GasImpactModal').default}
        options={{ headerShown: false }}
      />
      <ModalStack.Screen
        name={Routes.STAKING.MODALS.EARN_TOKEN_LIST}
        getComponent={() => require('../../Earn/components/EarnTokenList').default}
        options={{ headerShown: false }}
      />
    </ModalStack.Navigator>
  </StakeSDKProvider>
);

export { StakeScreenStack, StakeModalStack };
