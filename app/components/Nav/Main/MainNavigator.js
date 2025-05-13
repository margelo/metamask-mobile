import React, { useRef, useState, useEffect } from 'react';
import { Image, StyleSheet, Keyboard, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Browser from '../../Views/Browser';
import { ChainId } from '@metamask/controller-utils';
import AddBookmark from '../../Views/AddBookmark';
import SimpleWebview from '../../Views/SimpleWebview';
import Settings from '../../Views/Settings';
import GeneralSettings from '../../Views/Settings/GeneralSettings';
import AdvancedSettings from '../../Views/Settings/AdvancedSettings';
import BackupAndSyncSettings from '../../Views/Settings/Identity/BackupAndSyncSettings';
import SecuritySettings from '../../Views/Settings/SecuritySettings';
import ExperimentalSettings from '../../Views/Settings/ExperimentalSettings';
import NetworksSettings from '../../Views/Settings/NetworksSettings';
import NotificationsSettings from '../../Views/Settings/NotificationsSettings';
import NotificationsView from '../../Views/Notifications';
import NotificationsDetails from '../../Views/Notifications/Details';
import OptIn from '../../Views/Notifications/OptIn';
import AppInformation from '../../Views/Settings/AppInformation';
import DeveloperOptions from '../../Views/Settings/DeveloperOptions';
import Contacts from '../../Views/Settings/Contacts';
import Wallet from '../../Views/Wallet';
import Asset from '../../Views/Asset';
import AssetDetails from '../../Views/AssetDetails';
import AddAsset from '../../Views/AddAsset';
import Collectible from '../../Views/Collectible';
import Send from '../../Views/confirmations/legacy/Send';
import SendTo from '../../Views/confirmations/legacy/SendFlow/SendTo';
import { RevealPrivateCredential } from '../../Views/RevealPrivateCredential';
import WalletConnectSessions from '../../Views/WalletConnectSessions';
import OfflineMode from '../../Views/OfflineMode';
import QRTabSwitcher from '../../Views/QRTabSwitcher';
import EnterPasswordSimple from '../../Views/EnterPasswordSimple';
import ChoosePassword from '../../Views/ChoosePassword';
import ResetPassword from '../../Views/ResetPassword';
import AccountBackupStep1 from '../../Views/AccountBackupStep1';
import AccountBackupStep1B from '../../Views/AccountBackupStep1B';
import ManualBackupStep1 from '../../Views/ManualBackupStep1';
import ManualBackupStep2 from '../../Views/ManualBackupStep2';
import ManualBackupStep3 from '../../Views/ManualBackupStep3';
import PaymentRequest from '../../UI/PaymentRequest';
import PaymentRequestSuccess from '../../UI/PaymentRequestSuccess';
import Amount from '../../Views/confirmations/legacy/SendFlow/Amount';
import Confirm from '../../Views/confirmations/legacy/SendFlow/Confirm';
import { Confirm as RedesignedConfirm } from '../../Views/confirmations/components/confirm';
import ContactForm from '../../Views/Settings/Contacts/ContactForm';
import ActivityView from '../../Views/ActivityView';
import SwapsAmountView from '../../UI/Swaps';
import SwapsQuotesView from '../../UI/Swaps/QuotesView';
import CollectiblesDetails from '../../UI/CollectibleModal';
import OptinMetrics from '../../UI/OptinMetrics';
import Drawer from '../../UI/Drawer';

import RampRoutes from '../../UI/Ramp/routes';
import { RampType } from '../../UI/Ramp/types';
import RampSettings from '../../UI/Ramp/Views/Settings';
import RampActivationKeyForm from '../../UI/Ramp/Views/Settings/ActivationKeyForm';

import { colors as importedColors } from '../../../styles/common';
import OrderDetails from '../../UI/Ramp/Views/OrderDetails';
import SendTransaction from '../../UI/Ramp/Views/SendTransaction';
import TabBar from '../../../component-library/components/Navigation/TabBar';
///: BEGIN:ONLY_INCLUDE_IF(external-snaps)
import { SnapsSettingsList } from '../../Views/Snaps/SnapsSettingsList';
import { SnapSettings } from '../../Views/Snaps/SnapSettings';
///: END:ONLY_INCLUDE_IF
import Routes from '../../../constants/navigation/Routes';
import { MetaMetricsEvents } from '../../../core/Analytics';
import { getActiveTabUrl } from '../../../util/transactions';
import { getPermittedAccountsByHostname } from '../../../core/Permissions';
import { TabBarIconKey } from '../../../component-library/components/Navigation/TabBar/TabBar.types';
import { isEqual } from 'lodash';
import { selectProviderConfig } from '../../../selectors/networkController';
import { selectAccountsLength } from '../../../selectors/accountTrackerController';
import isUrl from 'is-url';
import SDKSessionsManager from '../../Views/SDK/SDKSessionsManager/SDKSessionsManager';
import PermissionsManager from '../../Views/Settings/PermissionsSettings/PermissionsManager';
import URL from 'url-parse';
import Logger from '../../../util/Logger';
import { getDecimalChainId } from '../../../util/networks';
import { useMetrics } from '../../../components/hooks/useMetrics';
import DeprecatedNetworkDetails from '../../UI/DeprecatedNetworkModal';
import ConfirmAddAsset from '../../UI/ConfirmAddAsset';
import { AesCryptoTestForm } from '../../Views/AesCryptoTestForm';
import { isTest } from '../../../util/test/utils';
import { selectPermissionControllerState } from '../../../selectors/snaps/permissionController';
import NftDetails from '../../Views/NftDetails';
import NftDetailsFullImage from '../../Views/NftDetails/NFtDetailsFullImage';
import AccountPermissions from '../../../components/Views/AccountPermissions';
import { AccountPermissionsScreens } from '../../../components/Views/AccountPermissions/AccountPermissions.types';
import { StakeModalStack, StakeScreenStack } from '../../UI/Stake/routes';
import { AssetLoader } from '../../Views/AssetLoader';
import { BridgeTransactionDetails } from '../../UI/Bridge/components/TransactionDetails/TransactionDetails';
import { BridgeModalStack, BridgeScreenStack } from '../../UI/Bridge/routes';
import TurnOnBackupAndSync from '../../Views/Identity/TurnOnBackupAndSync/TurnOnBackupAndSync';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const styles = StyleSheet.create({
  headerLogo: {
    width: 125,
    height: 50,
  },
});

const clearStackNavigatorOptions = {
  headerShown: false,
  cardStyle: {
    backgroundColor: 'transparent',
    cardStyleInterpolator: () => ({
      overlayStyle: {
        opacity: 0,
      },
    }),
  },
  animationEnabled: false,
};

const WalletModalFlow = () => (
  <Stack.Navigator mode={'modal'} screenOptions={clearStackNavigatorOptions}>
    <Stack.Screen
      name={'Wallet'}
      getComponent={() => require('../../Views/Wallet').default}
      options={{ headerShown: true, animationEnabled: false }}
    />
  </Stack.Navigator>
);

/* eslint-disable react/prop-types */
const AssetStackFlow = (props) => (
  <Stack.Navigator>
    <Stack.Screen
      name={'Asset'}
      getComponent={() => require('../../Views/Asset').default}
      initialParams={props.route.params}
    />
    <Stack.Screen
      name={'AssetDetails'}
      getComponent={() => require('../../Views/AssetDetails').default}
      initialParams={{ address: props.route.params?.address }}
    />
  </Stack.Navigator>
);

const AssetModalFlow = (props) => (
  <Stack.Navigator
    mode={'modal'}
    initialRouteName={'AssetStackFlow'}
    screenOptions={clearStackNavigatorOptions}
  >
    <Stack.Screen
      name={'AssetStackFlow'}
      getComponent={() => AssetStackFlow}
      initialParams={props.route.params}
    />
  </Stack.Navigator>
);
/* eslint-enable react/prop-types */

const WalletTabStackFlow = () => (
  <Stack.Navigator initialRouteName={'WalletView'}>
    <Stack.Screen
      name="WalletView"
      getComponent={() => WalletModalFlow}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="AddAsset"
      getComponent={() => require('../../Views/AddAsset').default}
      options={AddAsset.navigationOptions}
    />
    <Stack.Screen
      name="Collectible"
      getComponent={() => require('../../Views/Collectible').default}
      options={Collectible.navigationOptions}
    />
    <Stack.Screen
      name="ConfirmAddAsset"
      getComponent={() => require('../../UI/ConfirmAddAsset').default}
      options={ConfirmAddAsset.navigationOptions}
    />
    <Stack.Screen
      name="RevealPrivateCredentialView"
      getComponent={() => require('../../Views/RevealPrivateCredential').RevealPrivateCredential}
    />
  </Stack.Navigator>
);

const WalletTabModalFlow = () => (
  <Stack.Navigator mode={'modal'} screenOptions={clearStackNavigatorOptions}>
    <Stack.Screen
      name={Routes.WALLET.TAB_STACK_FLOW}
      getComponent={() => WalletTabStackFlow}
    />
  </Stack.Navigator>
);

const TransactionsHome = () => (
  <Stack.Navigator>
    <Stack.Screen
      name={Routes.TRANSACTIONS_VIEW}
      getComponent={() => require('../../Views/ActivityView').default}
      options={{ headerShown: false }}
    />
    <Stack.Screen name={Routes.RAMP.ORDER_DETAILS} getComponent={() => require('../../UI/Ramp/Views/OrderDetails').default} />
    <Stack.Screen
      name={Routes.RAMP.SEND_TRANSACTION}
      getComponent={() => require('../../UI/Ramp/Views/SendTransaction').default}
    />
    <Stack.Screen
      name={Routes.BRIDGE.BRIDGE_TRANSACTION_DETAILS}
      getComponent={() => require('../../UI/Bridge/components/TransactionDetails/TransactionDetails').BridgeTransactionDetails}
    />
  </Stack.Navigator>
);

/* eslint-disable react/prop-types */
const BrowserFlow = (props) => (
  <Stack.Navigator
    initialRouteName={Routes.BROWSER.VIEW}
    mode={'modal'}
    screenOptions={{
      cardStyle: { backgroundColor: importedColors.transparent },
    }}
  >
    <Stack.Screen
      name={Routes.BROWSER.VIEW}
      getComponent={() => require('../../Views/Browser').default}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name={Routes.BROWSER.ASSET_LOADER}
      getComponent={() => require('../../Views/AssetLoader').AssetLoader}
      options={{ headerShown: false, animationEnabled: false }}
    />
    <Stack.Screen
      name={Routes.BROWSER.ASSET_VIEW}
      getComponent={() => require('../../Views/Asset').default}
      initialParams={props.route.params}
    />
    <Stack.Screen
      name="SwapsAmountView"
      getComponent={() => require('../../UI/Swaps').default}
      options={SwapsAmountView.navigationOptions}
    />
    <Stack.Screen
      name="SwapsQuotesView"
      getComponent={() => require('../../UI/Swaps/QuotesView').default}
      options={SwapsQuotesView.navigationOptions}
    />
  </Stack.Navigator>
);

export const DrawerContext = React.createContext({ drawerRef: null });

///: BEGIN:ONLY_INCLUDE_IF(external-snaps)
const SnapsSettingsStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name={Routes.SNAPS.SNAPS_SETTINGS_LIST}
      getComponent={() => require('../../Views/Snaps/SnapsSettingsList').SnapsSettingsList}
      options={SnapsSettingsList.navigationOptions}
    />
    <Stack.Screen
      name={Routes.SNAPS.SNAP_SETTINGS}
      getComponent={() => require('../../Views/Snaps/SnapSettings').SnapSettings}
      options={SnapSettings.navigationOptions}
    />
  </Stack.Navigator>
);
///: END:ONLY_INCLUDE_IF

const NotificationsOptInStack = () => (
  <Stack.Navigator initialRouteName={Routes.NOTIFICATIONS.OPT_IN}>
    <Stack.Screen
      mode={'modal'}
      name={Routes.NOTIFICATIONS.OPT_IN}
      getComponent={() => require('../../Views/Notifications/OptIn').default}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name={Routes.SETTINGS.NOTIFICATIONS}
      getComponent={() => require('../../Views/Settings/NotificationsSettings').default}
      options={NotificationsSettings.navigationOptions}
    />
  </Stack.Navigator>
);

const SettingsFlow = () => (
  <Stack.Navigator initialRouteName={'Settings'}>
    <Stack.Screen
      name="Settings"
      getComponent={() => require('../../Views/Settings').default}
      options={Settings.navigationOptions}
    />
    <Stack.Screen
      name="GeneralSettings"
      getComponent={() => require('../../Views/Settings/GeneralSettings').default}
      options={GeneralSettings.navigationOptions}
    />
    <Stack.Screen
      name="AdvancedSettings"
      getComponent={() => require('../../Views/Settings/AdvancedSettings').default}
      options={AdvancedSettings.navigationOptions}
    />
    <Stack.Screen name="SDKSessionsManager" getComponent={() => require('../../Views/SDK/SDKSessionsManager/SDKSessionsManager').default} />
    <Stack.Screen name="PermissionsManager" getComponent={() => require('../../Views/Settings/PermissionsSettings/PermissionsManager').default} />
    <Stack.Screen
      name="SecuritySettings"
      getComponent={() => require('../../Views/Settings/SecuritySettings').default}
      options={SecuritySettings.navigationOptions}
    />
    <Stack.Screen name={Routes.RAMP.SETTINGS} getComponent={() => require('../../UI/Ramp/Views/Settings').default} />
    <Stack.Screen
      name={Routes.RAMP.ACTIVATION_KEY_FORM}
      getComponent={() => require('../../UI/Ramp/Views/Settings/ActivationKeyForm').default}
    />
    {
      /**
       * This screen should only accessed in test mode.
       * It is used to test the AES crypto functions.
       *
       * If this is in production, it is a bug.
       */
      isTest && (
        <Stack.Screen
          name="AesCryptoTestForm"
          getComponent={() => require('../../Views/AesCryptoTestForm').AesCryptoTestForm}
          options={AesCryptoTestForm.navigationOptions}
        />
      )
    }
    <Stack.Screen
      name="ExperimentalSettings"
      getComponent={() => require('../../Views/Settings/ExperimentalSettings').default}
      options={ExperimentalSettings.navigationOptions}
    />
    <Stack.Screen
      name="NetworksSettings"
      getComponent={() => require('../../Views/Settings/NetworksSettings').default}
      options={NetworksSettings.navigationOptions}
    />
    <Stack.Screen
      name="CompanySettings"
      getComponent={() => require('../../Views/Settings/AppInformation').default}
      options={AppInformation.navigationOptions}
    />
    {process.env.MM_ENABLE_SETTINGS_PAGE_DEV_OPTIONS === 'true' && (
      <Stack.Screen
        name={Routes.SETTINGS.DEVELOPER_OPTIONS}
        getComponent={() => require('../../Views/Settings/DeveloperOptions').default}
        options={DeveloperOptions.navigationOptions}
      />
    )}

    <Stack.Screen
      name="ContactsSettings"
      getComponent={() => require('../../Views/Settings/Contacts').default}
      options={Contacts.navigationOptions}
    />
    <Stack.Screen
      name="ContactForm"
      getComponent={() => require('../../Views/Settings/Contacts/ContactForm').default}
      options={ContactForm.navigationOptions}
    />
    <Stack.Screen
      name="AccountPermissionsAsFullScreen"
      getComponent={() => require('../../../components/Views/AccountPermissions').default}
      options={{ headerShown: false }}
      initialParams={{
        initialScreen: AccountPermissionsScreens.PermissionsSummary,
      }}
    />
    <Stack.Screen
      name="RevealPrivateCredentialView"
      getComponent={() => require('../../Views/RevealPrivateCredential').RevealPrivateCredential}
    />
    <Stack.Screen
      name={Routes.WALLET.WALLET_CONNECT_SESSIONS_VIEW}
      getComponent={() => require('../../Views/WalletConnectSessions').default}
      options={WalletConnectSessions.navigationOptions}
    />
    <Stack.Screen
      name="ResetPassword"
      getComponent={() => require('../../Views/ResetPassword').default}
      options={ResetPassword.navigationOptions}
    />
    <Stack.Screen
      name="AccountBackupStep1B"
      getComponent={() => require('../../Views/AccountBackupStep1B').default}
      options={AccountBackupStep1B.navigationOptions}
    />
    <Stack.Screen
      name="ManualBackupStep1"
      getComponent={() => require('../../Views/ManualBackupStep1').default}
      options={ManualBackupStep1.navigationOptions}
    />
    <Stack.Screen
      name="ManualBackupStep2"
      getComponent={() => require('../../Views/ManualBackupStep2').default}
      options={ManualBackupStep2.navigationOptions}
    />
    <Stack.Screen
      name="ManualBackupStep3"
      getComponent={() => require('../../Views/ManualBackupStep3').default}
      options={ManualBackupStep3.navigationOptions}
    />
    <Stack.Screen
      name="EnterPasswordSimple"
      getComponent={() => require('../../Views/EnterPasswordSimple').default}
      options={EnterPasswordSimple.navigationOptions}
    />
    <Stack.Screen
      name={Routes.SETTINGS.NOTIFICATIONS}
      getComponent={() => require('../../Views/Settings/NotificationsSettings').default}
      options={NotificationsSettings.navigationOptions}
    />
    <Stack.Screen
      name={Routes.SETTINGS.BACKUP_AND_SYNC}
      getComponent={() => NotificationsOptInStack}
      options={BackupAndSyncSettings.navigationOptions}
    />
    {
      ///: BEGIN:ONLY_INCLUDE_IF(external-snaps)
    }
    <Stack.Screen
      name={Routes.SNAPS.SNAPS_SETTINGS_LIST}
      getComponent={() => SnapsSettingsStack}
      options={{ headerShown: false }}
    />
    {
      ///: END:ONLY_INCLUDE_IF
    }
  </Stack.Navigator>
);

const HomeTabs = () => {
  const { trackEvent, createEventBuilder } = useMetrics();
  const drawerRef = useRef(null);
  const [isKeyboardHidden, setIsKeyboardHidden] = useState(true);

  const accountsLength = useSelector(selectAccountsLength);

  const chainId = useSelector((state) => {
    const providerConfig = selectProviderConfig(state);
    return ChainId[providerConfig.type];
  });

  const amountOfBrowserOpenTabs = useSelector(
    (state) => state.browser.tabs.length,
  );

  /* tabs: state.browser.tabs, */
  /* activeTab: state.browser.activeTab, */
  const activeConnectedDapp = useSelector((state) => {
    const activeTabUrl = getActiveTabUrl(state);
    if (!isUrl(activeTabUrl)) return [];
    try {
      const permissionsControllerState = selectPermissionControllerState(state);
      const hostname = new URL(activeTabUrl).hostname;
      const permittedAcc = getPermittedAccountsByHostname(
        permissionsControllerState,
        hostname,
      );
      return permittedAcc;
    } catch (error) {
      Logger.error(error, {
        message: 'ParseUrl::MainNavigator error while parsing URL',
      });
    }
  }, isEqual);

  const options = {
    home: {
      tabBarIconKey: TabBarIconKey.Wallet,
      callback: () => {
        trackEvent(
          createEventBuilder(MetaMetricsEvents.WALLET_OPENED)
            .addProperties({
              number_of_accounts: accountsLength,
              chain_id: getDecimalChainId(chainId),
            })
            .build(),
        );
      },
      rootScreenName: Routes.WALLET_VIEW,
    },
    actions: {
      tabBarIconKey: TabBarIconKey.Actions,
      rootScreenName: Routes.MODAL.WALLET_ACTIONS,
    },
    browser: {
      tabBarIconKey: TabBarIconKey.Browser,
      callback: () => {
        trackEvent(
          createEventBuilder(MetaMetricsEvents.BROWSER_OPENED)
            .addProperties({
              number_of_accounts: accountsLength,
              chain_id: getDecimalChainId(chainId),
              source: 'Navigation Tab',
              active_connected_dapp: activeConnectedDapp,
              number_of_open_tabs: amountOfBrowserOpenTabs,
            })
            .build(),
        );
      },
      rootScreenName: Routes.BROWSER_VIEW,
    },
    activity: {
      tabBarIconKey: TabBarIconKey.Activity,
      callback: () => {
        trackEvent(
          createEventBuilder(
            MetaMetricsEvents.NAVIGATION_TAPS_TRANSACTION_HISTORY,
          ).build(),
        );
      },
      rootScreenName: Routes.TRANSACTIONS_VIEW,
    },
    settings: {
      tabBarIconKey: TabBarIconKey.Setting,
      callback: () => {
        trackEvent(
          createEventBuilder(
            MetaMetricsEvents.NAVIGATION_TAPS_SETTINGS,
          ).build(),
        );
      },
      rootScreenName: Routes.SETTINGS_VIEW,
      unmountOnBlur: true,
    },
  };

  useEffect(() => {
    // Hide keyboard on Android when keyboard is visible.
    // Better solution would be to update android:windowSoftInputMode in the AndroidManifest and refactor pages to support it.
    if (Platform.OS === 'android') {
      const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
        setIsKeyboardHidden(false);
      });
      const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
        setIsKeyboardHidden(true);
      });

      return () => {
        showSubscription.remove();
        hideSubscription.remove();
      };
    }
  }, []);

  const renderTabBar = ({ state, descriptors, navigation }) => {
    if (isKeyboardHidden) {
      return (
        <TabBar
          state={state}
          descriptors={descriptors}
          navigation={navigation}
        />
      );
    }
    return null;
  };

  return (
    <DrawerContext.Provider value={{ drawerRef }}>
      <Drawer ref={drawerRef}>
        <Tab.Navigator
          initialRouteName={Routes.WALLET.HOME}
          tabBar={renderTabBar}
        >
          <Tab.Screen
            name={Routes.WALLET.HOME}
            options={options.home}
            getComponent={() => WalletTabModalFlow}
          />
          <Tab.Screen
            name={Routes.TRANSACTIONS_VIEW}
            options={options.activity}
            getComponent={() => require('../../Views/TransactionsView').default}
          />
          <Tab.Screen
            name={Routes.MODAL.WALLET_ACTIONS}
            options={options.actions}
            getComponent={() => WalletTabModalFlow}
          />
          <Tab.Screen
            name={Routes.BROWSER.HOME}
            options={options.browser}
            getComponent={() => BrowserFlow}
          />
          <Tab.Screen
            name={Routes.SETTINGS_VIEW}
            options={options.settings}
            getComponent={() => SettingsFlow}
          />
        </Tab.Navigator>
      </Drawer>
    </DrawerContext.Provider>
  );
};

const Webview = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="SimpleWebview"
      getComponent={() => require('../../Views/SimpleWebview').default}
      mode={'modal'}
      options={SimpleWebview.navigationOptions}
    />
  </Stack.Navigator>
);

const SendView = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Send"
      getComponent={() => require('../../Views/confirmations/legacy/Send').default}
      options={Send.navigationOptions}
    />
  </Stack.Navigator>
);

/* eslint-disable react/prop-types */
const NftDetailsModeView = (props) => (
  <Stack.Navigator>
    <Stack.Screen
      name=" " // No name here because this title will be displayed in the header of the page
      getComponent={() => require('../../Views/NftDetails').default}
      initialParams={{
        collectible: props.route.params?.collectible,
      }}
    />
  </Stack.Navigator>
);

/* eslint-disable react/prop-types */
const NftDetailsFullImageModeView = (props) => (
  <Stack.Navigator>
    <Stack.Screen
      name=" " // No name here because this title will be displayed in the header of the page
      getComponent={() => require('../../Views/NftDetails/NFtDetailsFullImage').default}
      initialParams={{
        collectible: props.route.params?.collectible,
      }}
    />
  </Stack.Navigator>
);

const SendFlowView = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="SendTo"
      getComponent={() => require('../../Views/confirmations/legacy/SendFlow/SendTo').default}
      options={SendTo.navigationOptions}
    />
    <Stack.Screen
      name="Amount"
      getComponent={() => require('../../Views/confirmations/legacy/SendFlow/Amount').default}
      options={Amount.navigationOptions}
    />
    <Stack.Screen
      name={Routes.SEND_FLOW.CONFIRM}
      getComponent={() => require('../../Views/confirmations/legacy/SendFlow/Confirm').default}
      options={Confirm.navigationOptions}
    />
    <Stack.Screen
      name={Routes.STANDALONE_CONFIRMATIONS.TRANSFER}
      getComponent={() => require('../../Views/confirmations/components/confirm').Confirm}
    />
  </Stack.Navigator>
);

const AddBookmarkView = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="AddBookmark"
      getComponent={() => require('../../Views/AddBookmark').default}
      options={AddBookmark.navigationOptions}
    />
  </Stack.Navigator>
);

const OfflineModeView = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="OfflineMode"
      getComponent={() => require('../../Views/OfflineMode').default}
      options={OfflineMode.navigationOptions}
    />
  </Stack.Navigator>
);

const PaymentRequestView = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="PaymentRequest"
      getComponent={() => require('../../UI/PaymentRequest').default}
      options={PaymentRequest.navigationOptions}
    />
    <Stack.Screen
      name="PaymentRequestSuccess"
      getComponent={() => require('../../UI/PaymentRequestSuccess').default}
      options={PaymentRequestSuccess.navigationOptions}
    />
  </Stack.Navigator>
);

/* eslint-disable react/prop-types */
const NotificationsModeView = (props) => (
  <Stack.Navigator>
    <Stack.Screen
      name={Routes.NOTIFICATIONS.VIEW}
      getComponent={() => require('../../Views/Notifications').default}
      options={NotificationsView.navigationOptions}
    />
    <Stack.Screen
      name={Routes.SETTINGS.NOTIFICATIONS}
      getComponent={() => require('../../Views/Settings/NotificationsSettings').default}
      options={NotificationsSettings.navigationOptions}
    />
    <Stack.Screen
      mode={'modal'}
      name={Routes.NOTIFICATIONS.OPT_IN}
      getComponent={() => require('../../Views/Notifications/OptIn').default}
      options={OptIn.navigationOptions}
    />
    <Stack.Screen
      name={Routes.NOTIFICATIONS.DETAILS}
      getComponent={() => require('../../Views/Notifications/Details').default}
      options={NotificationsDetails.navigationOptions}
    />
    <Stack.Screen
      name="ContactForm"
      getComponent={() => require('../../Views/Settings/Contacts/ContactForm').default}
      options={ContactForm.navigationOptions}
    />
  </Stack.Navigator>
);

const Swaps = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="SwapsAmountView"
      getComponent={() => require('../../UI/Swaps').default}
      options={SwapsAmountView.navigationOptions}
    />
    <Stack.Screen
      name="SwapsQuotesView"
      getComponent={() => require('../../UI/Swaps/QuotesView').default}
      options={SwapsQuotesView.navigationOptions}
    />
  </Stack.Navigator>
);

const SetPasswordFlow = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="ChoosePassword"
      getComponent={() => require('../../Views/ChoosePassword').default}
      options={ChoosePassword.navigationOptions}
    />
    <Stack.Screen
      name="AccountBackupStep1"
      getComponent={() => require('../../Views/AccountBackupStep1').default}
      options={AccountBackupStep1.navigationOptions}
    />
    <Stack.Screen
      name="AccountBackupStep1B"
      getComponent={() => require('../../Views/AccountBackupStep1B').default}
      options={AccountBackupStep1B.navigationOptions}
    />
    <Stack.Screen
      name="ManualBackupStep1"
      getComponent={() => require('../../Views/ManualBackupStep1').default}
      options={ManualBackupStep1.navigationOptions}
    />
    <Stack.Screen
      name="ManualBackupStep2"
      getComponent={() => require('../../Views/ManualBackupStep2').default}
      options={ManualBackupStep2.navigationOptions}
    />
    <Stack.Screen
      name="ManualBackupStep3"
      getComponent={() => require('../../Views/ManualBackupStep3').default}
      options={ManualBackupStep3.navigationOptions}
    />
    <Stack.Screen
      name="OptinMetrics"
      getComponent={() => require('../../UI/OptinMetrics').default}
      options={OptinMetrics.navigationOptions}
    />
  </Stack.Navigator>
);

const MainNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
    mode={'modal'}
    initialRouteName={'Home'}
  >
    <Stack.Screen
      name="CollectiblesDetails"
      getComponent={() => require('../../UI/CollectibleModal').default}
      options={{
        //Refer to - https://reactnavigation.org/docs/stack-navigator/#animations
        cardStyle: { backgroundColor: importedColors.transparent },
        cardStyleInterpolator: () => ({
          overlayStyle: {
            opacity: 0,
          },
        }),
      }}
    />
    <Stack.Screen
      name={Routes.DEPRECATED_NETWORK_DETAILS}
      getComponent={() => require('../../UI/DeprecatedNetworkModal').default}
      options={{
        //Refer to - https://reactnavigation.org/docs/stack-navigator/#animations
        cardStyle: { backgroundColor: importedColors.transparent },
        cardStyleInterpolator: () => ({
          overlayStyle: {
            opacity: 0,
          },
        }),
      }}
    />
    <Stack.Screen name="Home" getComponent={() => HomeTabs} />
    <Stack.Screen name="Asset" getComponent={() => AssetModalFlow} />
    <Stack.Screen name="Webview" getComponent={() => Webview} />
    <Stack.Screen name="SendView" getComponent={() => SendView} />
    <Stack.Screen
      name="SendFlowView"
      getComponent={() => SendFlowView}
      //Disabling swipe down on IOS
      options={{ gestureEnabled: false }}
    />
    <Stack.Screen name="AddBookmarkView" getComponent={() => AddBookmarkView} />
    <Stack.Screen name="OfflineModeView" getComponent={() => OfflineModeView} />
    <Stack.Screen
      name={Routes.NOTIFICATIONS.VIEW}
      getComponent={() => NotificationsModeView}
    />
    <Stack.Screen name={Routes.QR_TAB_SWITCHER} getComponent={() => require('../../Views/QRTabSwitcher').default} />
    <Stack.Screen name="NftDetails" getComponent={() => NftDetailsModeView} />
    <Stack.Screen
      name="NftDetailsFullImage"
      getComponent={() => NftDetailsFullImageModeView}
    />
    <Stack.Screen name="PaymentRequestView" getComponent={() => PaymentRequestView} />
    <Stack.Screen name={Routes.RAMP.BUY}>
      {() => <RampRoutes rampType={RampType.BUY} />}
    </Stack.Screen>
    <Stack.Screen name={Routes.RAMP.SELL}>
      {() => <RampRoutes rampType={RampType.SELL} />}
    </Stack.Screen>
    <Stack.Screen name="Swaps" getComponent={() => Swaps} />
    <Stack.Screen name={Routes.BRIDGE.ROOT} getComponent={() => require('../../UI/Bridge/routes').BridgeScreenStack} />
    <Stack.Screen
      name={Routes.BRIDGE.MODALS.ROOT}
      getComponent={() => require('../../UI/Bridge/routes').BridgeModalStack}
      options={clearStackNavigatorOptions}
    />
    <Stack.Screen name="StakeScreens" getComponent={() => require('../../UI/Stake/routes').StakeScreenStack} />
    <Stack.Screen
      name="StakeModals"
      getComponent={() => require('../../UI/Stake/routes').StakeModalStack}
      options={clearStackNavigatorOptions}
    />
    <Stack.Screen
      name="SetPasswordFlow"
      getComponent={() => SetPasswordFlow}
      headerTitle={() => (
        <Image
          style={styles.headerLogo}
          source={require('../../../images/branding/metamask-name.png')}
          resizeMode={'contain'}
        />
      )}
      // eslint-disable-next-line react-native/no-inline-styles
      headerStyle={{ borderBottomWidth: 0 }}
    />
    {/* TODO: This is added to support slide 4 in the carousel - once changed this can be safely removed*/}
    <Stack.Screen
      name="GeneralSettings"
      getComponent={() => require('../../Views/Settings/GeneralSettings').default}
      options={{
        headerShown: true,
        ...GeneralSettings.navigationOptions,
      }}
    />
    <Stack.Screen
      name={Routes.NOTIFICATIONS.OPT_IN_STACK}
      getComponent={() => NotificationsOptInStack}
      options={NotificationsOptInStack.navigationOptions}
    />
    <Stack.Screen
      name={Routes.IDENTITY.TURN_ON_BACKUP_AND_SYNC}
      getComponent={() => require('../../Views/Identity/TurnOnBackupAndSync/TurnOnBackupAndSync').default}
      options={TurnOnBackupAndSync.navigationOptions}
    />
  </Stack.Navigator>
);

export default MainNavigator;
