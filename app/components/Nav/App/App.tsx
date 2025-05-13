/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Linking } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import Login from '../../Views/Login';
import QRTabSwitcher from '../../Views/QRTabSwitcher';
import DataCollectionModal from '../../Views/DataCollectionModal';
import Onboarding from '../../Views/Onboarding';
import OnboardingCarousel from '../../Views/OnboardingCarousel';
import ChoosePassword from '../../Views/ChoosePassword';
import AccountBackupStep1 from '../../Views/AccountBackupStep1';
import AccountBackupStep1B from '../../Views/AccountBackupStep1B';
import ManualBackupStep1 from '../../Views/ManualBackupStep1';
import ManualBackupStep2 from '../../Views/ManualBackupStep2';
import ManualBackupStep3 from '../../Views/ManualBackupStep3';
import ImportFromSecretRecoveryPhrase from '../../Views/ImportFromSecretRecoveryPhrase';
import DeleteWalletModal from '../../../components/UI/DeleteWalletModal';
import Main from '../Main';
import OptinMetrics from '../../UI/OptinMetrics';
import SimpleWebview from '../../Views/SimpleWebview';
import SharedDeeplinkManager from '../../../core/DeeplinkManager/SharedDeeplinkManager';
import branch from 'react-native-branch';
import AppConstants from '../../../core/AppConstants';
import Logger from '../../../util/Logger';
import { useDispatch, useSelector } from 'react-redux';
import {
  CURRENT_APP_VERSION,
  EXISTING_USER,
  LAST_APP_VERSION,
} from '../../../constants/storage';
import { getVersion } from 'react-native-device-info';
import { Authentication } from '../../../core/';
import Device from '../../../util/device';
import SDKConnect from '../../../core/SDKConnect/SDKConnect';
import { colors as importedColors } from '../../../styles/common';
import Routes from '../../../constants/navigation/Routes';
import ModalConfirmation from '../../../component-library/components/Modals/ModalConfirmation';
import Toast, {
  ToastContext,
} from '../../../component-library/components/Toast';
import AccountSelector from '../../../components/Views/AccountSelector';
import { TokenSortBottomSheet } from '../../../components/UI/Tokens/TokensBottomSheet/TokenSortBottomSheet';
import { TokenFilterBottomSheet } from '../../../components/UI/Tokens/TokensBottomSheet/TokenFilterBottomSheet';
import AccountConnect from '../../../components/Views/AccountConnect';
import AccountPermissions from '../../../components/Views/AccountPermissions';
import { AccountPermissionsScreens } from '../../../components/Views/AccountPermissions/AccountPermissions.types';
import AccountPermissionsConfirmRevokeAll from '../../../components/Views/AccountPermissions/AccountPermissionsConfirmRevokeAll';
import ConnectionDetails from '../../../components/Views/AccountPermissions/ConnectionDetails';
import { SRPQuiz } from '../../Views/Quiz';
import { TurnOffRememberMeModal } from '../../../components/UI/TurnOffRememberMeModal';
import AssetHideConfirmation from '../../Views/AssetHideConfirmation';
import DetectedTokens from '../../Views/DetectedTokens';
import DetectedTokensConfirmation from '../../Views/DetectedTokensConfirmation';
import AssetOptions from '../../Views/AssetOptions';
import ImportPrivateKey from '../../Views/ImportPrivateKey';
import ImportPrivateKeySuccess from '../../Views/ImportPrivateKeySuccess';
import ConnectQRHardware from '../../Views/ConnectQRHardware';
import SelectHardwareWallet from '../../Views/ConnectHardware/SelectHardware';
import { AUTHENTICATION_APP_TRIGGERED_AUTH_NO_CREDENTIALS } from '../../../constants/error';
import { UpdateNeeded } from '../../../components/UI/UpdateNeeded';
import { EnableAutomaticSecurityChecksModal } from '../../../components/UI/EnableAutomaticSecurityChecksModal';
import NetworkSettings from '../../Views/Settings/NetworksSettings/NetworkSettings';
import ModalMandatory from '../../../component-library/components/Modals/ModalMandatory';
import { RestoreWallet } from '../../Views/RestoreWallet';
import WalletRestored from '../../Views/RestoreWallet/WalletRestored';
import WalletResetNeeded from '../../Views/RestoreWallet/WalletResetNeeded';
import SDKLoadingModal from '../../Views/SDK/SDKLoadingModal/SDKLoadingModal';
import SDKFeedbackModal from '../../Views/SDK/SDKFeedbackModal/SDKFeedbackModal';
import LedgerMessageSignModal from '../../UI/LedgerModals/LedgerMessageSignModal';
import LedgerTransactionModal from '../../UI/LedgerModals/LedgerTransactionModal';
import AccountActions from '../../../components/Views/AccountActions';
import FiatOnTestnetsFriction from '../../../components/Views/Settings/AdvancedSettings/FiatOnTestnetsFriction';
import WalletActions from '../../Views/WalletActions';
import NetworkSelector from '../../../components/Views/NetworkSelector';
import ReturnToAppModal from '../../Views/ReturnToAppModal';
import EditAccountName from '../../Views/EditAccountName/EditAccountName';
import WC2Manager, {
  isWC2Enabled,
} from '../../../../app/core/WalletConnect/WalletConnectV2';
import { DevLogger } from '../../../../app/core/SDKConnect/utils/DevLogger';
import { PPOMView } from '../../../lib/ppom/PPOMView';
import LockScreen from '../../Views/LockScreen';
import StorageWrapper from '../../../store/storage-wrapper';
import ShowIpfsGatewaySheet from '../../Views/ShowIpfsGatewaySheet/ShowIpfsGatewaySheet';
import ShowDisplayNftMediaSheet from '../../Views/ShowDisplayMediaNFTSheet/ShowDisplayNFTMediaSheet';
import AmbiguousAddressSheet from '../../../../app/components/Views/Settings/Contacts/AmbiguousAddressSheet/AmbiguousAddressSheet';
import SDKDisconnectModal from '../../Views/SDK/SDKDisconnectModal/SDKDisconnectModal';
import SDKSessionModal from '../../Views/SDK/SDKSessionModal/SDKSessionModal';
import ExperienceEnhancerModal from '../../../../app/components/Views/ExperienceEnhancerModal';
import { MetaMetrics } from '../../../core/Analytics';
import trackErrorAsAnalytics from '../../../util/metrics/TrackError/trackErrorAsAnalytics';
import LedgerSelectAccount from '../../Views/LedgerSelectAccount';
import OnboardingSuccess from '../../Views/OnboardingSuccess';
import DefaultSettings from '../../Views/OnboardingSuccess/DefaultSettings';
import OnboardingGeneralSettings from '../../Views/OnboardingSuccess/OnboardingGeneralSettings';
import OnboardingAssetsSettings from '../../Views/OnboardingSuccess/OnboardingAssetsSettings';
import OnboardingSecuritySettings from '../../Views/OnboardingSuccess/OnboardingSecuritySettings';
import BasicFunctionalityModal from '../../UI/BasicFunctionality/BasicFunctionalityModal/BasicFunctionalityModal';
import PermittedNetworksInfoSheet from '../../Views/AccountPermissions/PermittedNetworksInfoSheet/PermittedNetworksInfoSheet';
import ResetNotificationsModal from '../../UI/Notification/ResetNotificationsModal';
import NFTAutoDetectionModal from '../../../../app/components/Views/NFTAutoDetectionModal/NFTAutoDetectionModal';
import NftOptions from '../../../components/Views/NftOptions';
import ShowTokenIdSheet from '../../../components/Views/ShowTokenIdSheet';
import OriginSpamModal from '../../Views/OriginSpamModal/OriginSpamModal';
import MaxBrowserTabsModal from '../../Views/Browser/MaxBrowserTabsModal';
import { isNetworkUiRedesignEnabled } from '../../../util/networks/isNetworkUiRedesignEnabled';
import ChangeInSimulationModal from '../../Views/ChangeInSimulationModal/ChangeInSimulationModal';
import TooltipModal from '../../../components/Views/TooltipModal';
import OptionsSheet from '../../UI/SelectOptionSheet/OptionsSheet';
import FoxLoader from '../../../components/UI/FoxLoader';
import { AppStateEventProcessor } from '../../../core/AppStateEventListener';
import MultiRpcModal from '../../../components/Views/MultiRpcModal/MultiRpcModal';
import Engine from '../../../core/Engine';
import { CHAIN_IDS } from '@metamask/transaction-controller';
import { PopularList } from '../../../util/networks/customNetworks';
import { RpcEndpointType } from '@metamask/network-controller';
import {
  endTrace,
  trace,
  TraceName,
  TraceOperation,
} from '../../../util/trace';
import getUIStartupSpan from '../../../core/Performance/UIStartup';
import { selectUserLoggedIn } from '../../../reducers/user/selectors';
import { Confirm } from '../../Views/confirmations/components/confirm';
///: BEGIN:ONLY_INCLUDE_IF(multi-srp)
import ImportNewSecretRecoveryPhrase from '../../Views/ImportNewSecretRecoveryPhrase';
import { SelectSRPBottomSheet } from '../../Views/SelectSRP/SelectSRPBottomSheet';
///: END:ONLY_INCLUDE_IF
import NavigationService from '../../../core/NavigationService';
import ConfirmTurnOnBackupAndSyncModal from '../../UI/Identity/ConfirmTurnOnBackupAndSyncModal/ConfirmTurnOnBackupAndSyncModal';
import AddNewAccount from '../../Views/AddNewAccount';
import SwitchAccountTypeModal from '../../Views/confirmations/components/modals/switch-account-type-modal';

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

const Stack = createStackNavigator();

const OnboardingSuccessComponent = () => {
  const navigation = useNavigation();
  return (
    <OnboardingSuccess
      onDone={() => navigation.reset({ routes: [{ name: 'HomeNav' }] })}
    />
  );
};

const OnboardingSuccessComponentNoSRP = () => {
  const navigation = useNavigation();
  return (
    <OnboardingSuccess
      noSRP
      onDone={() =>
        navigation.reset({
          routes: [{ name: 'HomeNav' }],
        })
      }
    />
  );
};

const OnboardingSuccessFlow = () => (
  <Stack.Navigator initialRouteName={Routes.ONBOARDING.SUCCESS}>
    <Stack.Screen
      name={Routes.ONBOARDING.SUCCESS}
      getComponent={() => OnboardingSuccessComponent} // Used in SRP flow
    />
    <Stack.Screen
      name={Routes.ONBOARDING.DEFAULT_SETTINGS} // This is being used in import wallet flow
      getComponent={() => require('../../Views/OnboardingSuccess/DefaultSettings').default}
    />
    <Stack.Screen
      name={Routes.ONBOARDING.GENERAL_SETTINGS}
      getComponent={() => require('../../Views/OnboardingSuccess/OnboardingGeneralSettings').default}
    />
    <Stack.Screen
      name={Routes.ONBOARDING.ASSETS_SETTINGS}
      getComponent={() => require('../../Views/OnboardingSuccess/OnboardingAssetsSettings').default}
    />
    <Stack.Screen
      name={Routes.ONBOARDING.SECURITY_SETTINGS}
      getComponent={() => require('../../Views/OnboardingSuccess/OnboardingSecuritySettings').default}
    />
  </Stack.Navigator>
);
/**
 * Stack navigator responsible for the onboarding process
 * Create Wallet and Import from Secret Recovery Phrase
 */
const OnboardingNav = () => (
  <Stack.Navigator initialRouteName="OnboardingCarousel">
    <Stack.Screen name="Onboarding" getComponent={() => require('../../Views/Onboarding').default} />
    <Stack.Screen name="OnboardingCarousel" getComponent={() => require('../../Views/OnboardingCarousel').default} />
    <Stack.Screen name="ChoosePassword" getComponent={() => require('../../Views/ChoosePassword').default} />
    <Stack.Screen name="AccountBackupStep1" getComponent={() => require('../../Views/AccountBackupStep1').default} />
    <Stack.Screen name="AccountBackupStep1B" getComponent={() => require('../../Views/AccountBackupStep1B').default} />
    <Stack.Screen
      name={Routes.ONBOARDING.SUCCESS_FLOW}
      getComponent={() => OnboardingSuccessFlow}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name={Routes.ONBOARDING.SUCCESS}
      getComponent={() => OnboardingSuccessComponentNoSRP} // Used in SRP flow
    />
    <Stack.Screen
      name={Routes.ONBOARDING.DEFAULT_SETTINGS} // This is being used in import wallet flow
      getComponent={() => require('../../Views/OnboardingSuccess/DefaultSettings').default}
    />
    <Stack.Screen name="ManualBackupStep1" getComponent={() => require('../../Views/ManualBackupStep1').default} />
    <Stack.Screen name="ManualBackupStep2" getComponent={() => require('../../Views/ManualBackupStep2').default} />
    <Stack.Screen name="ManualBackupStep3" getComponent={() => require('../../Views/ManualBackupStep3').default} />
    <Stack.Screen
      name={Routes.ONBOARDING.IMPORT_FROM_SECRET_RECOVERY_PHRASE}
      getComponent={() => require('../../Views/ImportFromSecretRecoveryPhrase').default}
    />
    <Stack.Screen name="OptinMetrics" getComponent={() => require('../../UI/OptinMetrics').default} />
  </Stack.Navigator>
);

/**
 * Parent Stack navigator that allows the
 * child OnboardingNav navigator to push modals on top of it
 */
const SimpleWebviewScreen = () => (
  <Stack.Navigator mode={'modal'}>
    <Stack.Screen name={Routes.WEBVIEW.SIMPLE} getComponent={() => require('../../Views/SimpleWebview').default} />
  </Stack.Navigator>
);

const OnboardingRootNav = () => (
  <Stack.Navigator
    initialRouteName={Routes.ONBOARDING.NAV}
    mode="modal"
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="OnboardingNav" getComponent={() => OnboardingNav} />
    <Stack.Screen name={Routes.QR_TAB_SWITCHER} getComponent={() => require('../../Views/QRTabSwitcher').default} />
    <Stack.Screen name={Routes.WEBVIEW.MAIN} getComponent={() => SimpleWebviewScreen} />
  </Stack.Navigator>
);

const VaultRecoveryFlow = () => (
  <Stack.Navigator
    initialRouteName={Routes.VAULT_RECOVERY.RESTORE_WALLET}
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen
      name={Routes.VAULT_RECOVERY.RESTORE_WALLET}
      getComponent={() => require('../../Views/RestoreWallet').RestoreWallet}
    />
    <Stack.Screen
      name={Routes.VAULT_RECOVERY.WALLET_RESTORED}
      getComponent={() => require('../../Views/RestoreWallet/WalletRestored').default}
    />
    <Stack.Screen
      name={Routes.VAULT_RECOVERY.WALLET_RESET_NEEDED}
      getComponent={() => require('../../Views/RestoreWallet/WalletResetNeeded').default}
    />
  </Stack.Navigator>
);

const AddNetworkFlow = () => {
  const route = useRoute();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AddNetwork"
        getComponent={() => require('../../Views/Settings/NetworksSettings/NetworkSettings').default}
        initialParams={route?.params}
      />
    </Stack.Navigator>
  );
};

const DetectedTokensFlow = () => (
  <Stack.Navigator
    mode={'modal'}
    screenOptions={clearStackNavigatorOptions}
    initialRouteName={'DetectedTokens'}
  >
    <Stack.Screen name={'DetectedTokens'} getComponent={() => require('../../Views/DetectedTokens').default} />
    <Stack.Screen
      name={'DetectedTokensConfirmation'}
      getComponent={() => require('../../Views/DetectedTokensConfirmation').default}
    />
  </Stack.Navigator>
);

///: BEGIN:ONLY_INCLUDE_IF(multi-srp)
interface RootModalFlowProps {
  route: {
    params: Record<string, unknown>;
  };
}
///: END:ONLY_INCLUDE_IF(multi-srp)
const RootModalFlow = (
  ///: BEGIN:ONLY_INCLUDE_IF(multi-srp)
  props: RootModalFlowProps,
  ///: END:ONLY_INCLUDE_IF
) => (
  <Stack.Navigator mode={'modal'} screenOptions={clearStackNavigatorOptions}>
    <Stack.Screen
      name={Routes.MODAL.WALLET_ACTIONS}
      getComponent={() => require('../../Views/WalletActions').default}
    />
    <Stack.Screen
      name={Routes.MODAL.DELETE_WALLET}
      getComponent={() => require('../../../components/UI/DeleteWalletModal').default}
    />
    <Stack.Screen
      name={Routes.MODAL.MODAL_CONFIRMATION}
      getComponent={() => require('../../../component-library/components/Modals/ModalConfirmation').default}
    />
    <Stack.Screen
      name={Routes.MODAL.MODAL_MANDATORY}
      getComponent={() => require('../../../component-library/components/Modals/ModalMandatory').default}
    />
    <Stack.Screen
      name={Routes.SHEET.ACCOUNT_SELECTOR}
      getComponent={() => require('../../../components/Views/AccountSelector').default}
    />
    <Stack.Screen name={Routes.SHEET.ADD_ACCOUNT} getComponent={() => require('../../Views/AddNewAccount').default} />
    <Stack.Screen name={Routes.SHEET.SDK_LOADING} getComponent={() => require('../../Views/SDK/SDKLoadingModal/SDKLoadingModal').default} />
    <Stack.Screen
      name={Routes.SHEET.SDK_FEEDBACK}
      getComponent={() => require('../../Views/SDK/SDKFeedbackModal/SDKFeedbackModal').default}
    />
    <Stack.Screen
      name={Routes.SHEET.SDK_MANAGE_CONNECTIONS}
      getComponent={() => require('../../Views/SDK/SDKSessionModal/SDKSessionModal').default}
    />
    <Stack.Screen
      name={Routes.SHEET.EXPERIENCE_ENHANCER}
      getComponent={() => require('../../../../app/components/Views/ExperienceEnhancerModal').default}
    />
    <Stack.Screen
      name={Routes.SHEET.DATA_COLLECTION}
      getComponent={() => require('../../Views/DataCollectionModal').default}
    />
    <Stack.Screen
      name={Routes.SHEET.SDK_DISCONNECT}
      getComponent={() => require('../../Views/SDK/SDKDisconnectModal/SDKDisconnectModal').default}
    />
    <Stack.Screen
      name={Routes.SHEET.ACCOUNT_CONNECT}
      getComponent={() => require('../../../components/Views/AccountConnect').default}
    />
    <Stack.Screen
      name={Routes.SHEET.ACCOUNT_PERMISSIONS}
      getComponent={() => require('../../../components/Views/AccountPermissions').default}
      initialParams={{ initialScreen: AccountPermissionsScreens.Connected }}
    />
    <Stack.Screen
      name={Routes.SHEET.REVOKE_ALL_ACCOUNT_PERMISSIONS}
      getComponent={() => require('../../../components/Views/AccountPermissions/AccountPermissionsConfirmRevokeAll').default}
    />
    <Stack.Screen
      name={Routes.SHEET.CONNECTION_DETAILS}
      getComponent={() => require('../../../components/Views/AccountPermissions/ConnectionDetails').default}
    />
    <Stack.Screen
      name={Routes.SHEET.PERMITTED_NETWORKS_INFO_SHEET}
      getComponent={() => require('../../Views/AccountPermissions/PermittedNetworksInfoSheet/PermittedNetworksInfoSheet').default}
    />
    <Stack.Screen
      name={Routes.SHEET.NETWORK_SELECTOR}
      getComponent={() => require('../../../components/Views/NetworkSelector').default}
    />
    <Stack.Screen
      name={Routes.SHEET.TOKEN_SORT}
      getComponent={() => require('../../../components/UI/Tokens/TokensBottomSheet/TokenSortBottomSheet').TokenSortBottomSheet}
    />
    <Stack.Screen
      name={Routes.SHEET.TOKEN_FILTER}
      getComponent={() => require('../../../components/UI/Tokens/TokensBottomSheet/TokenFilterBottomSheet').TokenFilterBottomSheet}
    />
    <Stack.Screen
      name={Routes.SHEET.BASIC_FUNCTIONALITY}
      getComponent={() => require('../../UI/BasicFunctionality/BasicFunctionalityModal/BasicFunctionalityModal').default}
    />
    <Stack.Screen
      name={Routes.SHEET.CONFIRM_TURN_ON_BACKUP_AND_SYNC}
      getComponent={() => require('../../UI/Identity/ConfirmTurnOnBackupAndSyncModal/ConfirmTurnOnBackupAndSyncModal').default}
    />
    <Stack.Screen
      name={Routes.SHEET.RESET_NOTIFICATIONS}
      getComponent={() => require('../../UI/Notification/ResetNotificationsModal').default}
    />
    <Stack.Screen
      name={Routes.SHEET.RETURN_TO_DAPP_MODAL}
      getComponent={() => require('../../Views/ReturnToAppModal').default}
    />
    <Stack.Screen
      name={Routes.SHEET.AMBIGUOUS_ADDRESS}
      getComponent={() => require('../../../../app/components/Views/Settings/Contacts/AmbiguousAddressSheet/AmbiguousAddressSheet').default}
    />
    <Stack.Screen
      name={Routes.MODAL.TURN_OFF_REMEMBER_ME}
      getComponent={() => require('../../../components/UI/TurnOffRememberMeModal').TurnOffRememberMeModal}
    />
    <Stack.Screen
      name={'AssetHideConfirmation'}
      getComponent={() => require('../../Views/AssetHideConfirmation').default}
    />
    <Stack.Screen name={'DetectedTokens'} getComponent={() => DetectedTokensFlow} />
    <Stack.Screen name={'AssetOptions'} getComponent={() => require('../../Views/AssetOptions').default} />
    <Stack.Screen name={'NftOptions'} getComponent={() => require('../../../components/Views/NftOptions').default} />
    <Stack.Screen name={Routes.MODAL.UPDATE_NEEDED} getComponent={() => require('../../../components/UI/UpdateNeeded').UpdateNeeded} />
    <Stack.Screen
      name={Routes.MODAL.ENABLE_AUTOMATIC_SECURITY_CHECKS}
      getComponent={() => require('../../../components/UI/EnableAutomaticSecurityChecksModal').EnableAutomaticSecurityChecksModal}
    />
    {
      ///: BEGIN:ONLY_INCLUDE_IF(multi-srp)
    }
    <Stack.Screen
      name={Routes.SHEET.SELECT_SRP}
      getComponent={() => require('../../Views/SelectSRP/SelectSRPBottomSheet').SelectSRPBottomSheet}
      initialParams={{ ...props.route.params }}
    />
    {
      ///: END:ONLY_INCLUDE_IF
    }
    <Stack.Screen
      name={Routes.MODAL.SRP_REVEAL_QUIZ}
      getComponent={() => require('../../Views/Quiz').SRPQuiz}
      ///: BEGIN:ONLY_INCLUDE_IF(multi-srp)
      initialParams={{ ...props.route.params }}
      ///: END:ONLY_INCLUDE_IF
      options={{ gestureEnabled: false }}
    />
    <Stack.Screen
      name={Routes.SHEET.ACCOUNT_ACTIONS}
      getComponent={() => require('../../../components/Views/AccountActions').default}
    />
    <Stack.Screen
      name={Routes.SHEET.FIAT_ON_TESTNETS_FRICTION}
      getComponent={() => require('../../../components/Views/Settings/AdvancedSettings/FiatOnTestnetsFriction').default}
    />
    <Stack.Screen
      name={Routes.SHEET.SHOW_IPFS}
      getComponent={() => require('../../Views/ShowIpfsGatewaySheet/ShowIpfsGatewaySheet').default}
    />
    <Stack.Screen
      name={Routes.SHEET.SHOW_NFT_DISPLAY_MEDIA}
      getComponent={() => require('../../Views/ShowDisplayMediaNFTSheet/ShowDisplayNFTMediaSheet').default}
    />
    <Stack.Screen
      name={Routes.MODAL.NFT_AUTO_DETECTION_MODAL}
      getComponent={() => require('../../../../app/components/Views/NFTAutoDetectionModal/NFTAutoDetectionModal').default}
    />
    {isNetworkUiRedesignEnabled() ? (
      <Stack.Screen
        name={Routes.MODAL.MULTI_RPC_MIGRATION_MODAL}
        getComponent={() => require('../../../components/Views/MultiRpcModal/MultiRpcModal').default}
      />
    ) : null}
    <Stack.Screen
      name={Routes.SHEET.SHOW_TOKEN_ID}
      getComponent={() => require('../../../components/Views/ShowTokenIdSheet').default}
    />
    <Stack.Screen
      name={Routes.SHEET.ORIGIN_SPAM_MODAL}
      getComponent={() => require('../../Views/OriginSpamModal/OriginSpamModal').default}
    />
    <Stack.Screen
      name={Routes.SHEET.CHANGE_IN_SIMULATION_MODAL}
      getComponent={() => require('../../Views/ChangeInSimulationModal/ChangeInSimulationModal').default}
    />
    <Stack.Screen name={Routes.SHEET.TOOLTIP_MODAL} getComponent={() => require('../../../components/Views/TooltipModal').default} />
  </Stack.Navigator>
);

const ImportPrivateKeyView = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="ImportPrivateKey" getComponent={() => require('../../Views/ImportPrivateKey').default} />
    <Stack.Screen
      name="ImportPrivateKeySuccess"
      getComponent={() => require('../../Views/ImportPrivateKeySuccess').default}
    />
    <Stack.Screen name={Routes.QR_TAB_SWITCHER} getComponent={() => require('../../Views/QRTabSwitcher').default} />
  </Stack.Navigator>
);

///: BEGIN:ONLY_INCLUDE_IF(multi-srp)
const ImportSRPView = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen
      name={Routes.MULTI_SRP.IMPORT}
      getComponent={() => require('../../Views/ImportNewSecretRecoveryPhrase').default}
    />
  </Stack.Navigator>
);
///: END:ONLY_INCLUDE_IF

const ConnectQRHardwareFlow = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="ConnectQRHardware" getComponent={() => require('../../Views/ConnectQRHardware').default} />
  </Stack.Navigator>
);

const LedgerConnectFlow = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
    initialRouteName={Routes.HW.LEDGER_CONNECT}
  >
    <Stack.Screen
      name={Routes.HW.LEDGER_CONNECT}
      getComponent={() => require('../../Views/LedgerSelectAccount').default}
    />
  </Stack.Navigator>
);

const ConnectHardwareWalletFlow = () => (
  <Stack.Navigator>
    <Stack.Screen
      name={Routes.HW.SELECT_DEVICE}
      getComponent={() => require('../../Views/ConnectHardware/SelectHardware').default}
    />
  </Stack.Navigator>
);

const FlatConfirmationRequest = () => (
  <Stack.Navigator>
    <Stack.Screen name={Routes.CONFIRMATION_REQUEST_FLAT} getComponent={() => require('../../Views/confirmations/components/confirm').Confirm} />
  </Stack.Navigator>
);

const ModalConfirmationRequest = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      cardStyle: { backgroundColor: importedColors.transparent },
    }}
    mode={'modal'}
  >
    <Stack.Screen
      name={Routes.CONFIRMATION_REQUEST_MODAL}
      getComponent={() => require('../../Views/confirmations/components/confirm').Confirm}
    />
  </Stack.Navigator>
);

const ModalSwitchAccountType = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      cardStyle: { backgroundColor: importedColors.transparent },
    }}
    mode={'modal'}
  >
    <Stack.Screen
      name={Routes.CONFIRMATION_SWITCH_ACCOUNT_TYPE}
      getComponent={() => require('../../Views/confirmations/components/modals/switch-account-type-modal').default}
    />
  </Stack.Navigator>
);

const AppFlow = () => {
  const userLoggedIn = useSelector(selectUserLoggedIn);

  return (
    <Stack.Navigator
      initialRouteName={Routes.FOX_LOADER}
      mode={'modal'}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: importedColors.transparent },
        animationEnabled: false,
      }}
    >
      {userLoggedIn && (
        // Render only if wallet is unlocked
        // Note: This is probably not needed but nice to ensure that wallet isn't accessible when it is locked
        <Stack.Screen
          name={Routes.ONBOARDING.HOME_NAV}
          getComponent={() => Main}
          options={{ headerShown: false }}
        />
      )}
      <Stack.Screen name={Routes.FOX_LOADER} getComponent={() => require('../../../components/UI/FoxLoader').default} />

      <Stack.Screen
        name={Routes.ONBOARDING.LOGIN}
        getComponent={() => require('../../Views/Login').default}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={Routes.MODAL.MAX_BROWSER_TABS_MODAL}
        getComponent={() => require('../../Views/Browser/MaxBrowserTabsModal').default}
      />
      <Stack.Screen
        name="OnboardingRootNav"
        getComponent={() => OnboardingRootNav}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={Routes.ONBOARDING.SUCCESS_FLOW}
        getComponent={() => OnboardingSuccessFlow}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={Routes.VAULT_RECOVERY.RESTORE_WALLET}
        getComponent={() => VaultRecoveryFlow}
      />
      <Stack.Screen
        name={Routes.MODAL.ROOT_MODAL_FLOW}
        getComponent={() => RootModalFlow}
      />
      <Stack.Screen
        name="ImportPrivateKeyView"
        getComponent={() => ImportPrivateKeyView}
        options={{ animationEnabled: true }}
      />
      {
        ///: BEGIN:ONLY_INCLUDE_IF(multi-srp)
        <Stack.Screen
          name="ImportSRPView"
          getComponent={() => ImportSRPView}
          options={{ animationEnabled: true }}
        />
        ///: END:ONLY_INCLUDE_IF
      }
      <Stack.Screen
        name="ConnectQRHardwareFlow"
        getComponent={() => ConnectQRHardwareFlow}
        options={{ animationEnabled: true }}
      />
      <Stack.Screen
        name={Routes.HW.CONNECT_LEDGER}
        getComponent={() => LedgerConnectFlow}
      />
      <Stack.Screen
        name={Routes.HW.CONNECT}
        getComponent={() => ConnectHardwareWalletFlow}
      />
      <Stack.Screen
        options={{
          //Refer to - https://reactnavigation.org/docs/stack-navigator/#animations
          cardStyle: { backgroundColor: importedColors.transparent },
          cardStyleInterpolator: () => ({
            overlayStyle: {
              opacity: 0,
            },
          }),
        }}
        name={Routes.LEDGER_TRANSACTION_MODAL}
        getComponent={() => require('../../UI/LedgerModals/LedgerTransactionModal').default}
      />
      <Stack.Screen
        options={{
          //Refer to - https://reactnavigation.org/docs/stack-navigator/#animations
          cardStyle: { backgroundColor: importedColors.transparent },
          cardStyleInterpolator: () => ({
            overlayStyle: {
              opacity: 0,
            },
          }),
        }}
        name={Routes.LEDGER_MESSAGE_SIGN_MODAL}
        getComponent={() => require('../../UI/LedgerModals/LedgerMessageSignModal').default}
      />
      <Stack.Screen name={Routes.OPTIONS_SHEET} getComponent={() => require('../../UI/SelectOptionSheet/OptionsSheet').default} />
      <Stack.Screen
        name={Routes.EDIT_ACCOUNT_NAME}
        getComponent={() => require('../../Views/EditAccountName/EditAccountName').default}
        options={{ animationEnabled: true }}
      />
      <Stack.Screen
        name={Routes.ADD_NETWORK}
        getComponent={() => AddNetworkFlow}
        options={{ animationEnabled: true }}
      />
      {isNetworkUiRedesignEnabled() ? (
        <Stack.Screen
          name={Routes.EDIT_NETWORK}
          getComponent={() => AddNetworkFlow}
          options={{ animationEnabled: true }}
        />
      ) : null}
      <Stack.Screen
        name={Routes.LOCK_SCREEN}
        getComponent={() => require('../../Views/LockScreen').default}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name={Routes.CONFIRMATION_REQUEST_FLAT}
        getComponent={() => FlatConfirmationRequest}
      />
      <Stack.Screen
        name={Routes.CONFIRMATION_REQUEST_MODAL}
        getComponent={() => ModalConfirmationRequest}
      />
      <Stack.Screen
        name={Routes.CONFIRMATION_SWITCH_ACCOUNT_TYPE}
        getComponent={() => ModalSwitchAccountType}
      />
    </Stack.Navigator>
  );
};

const App: React.FC = () => {
  const userLoggedIn = useSelector(selectUserLoggedIn);
  const [onboarded, setOnboarded] = useState(false);
  const navigation = useNavigation();
  const queueOfHandleDeeplinkFunctions = useRef<(() => void)[]>([]);
  const { toastRef } = useContext(ToastContext);
  const dispatch = useDispatch();
  const sdkInit = useRef<boolean | undefined>(undefined);

  const isFirstRender = useRef(true);

  if (isFirstRender.current) {
    trace({
      name: TraceName.NavInit,
      parentContext: getUIStartupSpan(),
      op: TraceOperation.NavInit,
    });

    isFirstRender.current = false;
  }

  useEffect(() => {
    // End trace when first render is complete
    endTrace({ name: TraceName.UIStartup });
  }, []);

  useEffect(() => {
    const appTriggeredAuth = async () => {
      const existingUser = await StorageWrapper.getItem(EXISTING_USER);
      setOnboarded(!!existingUser);
      try {
        if (existingUser) {
          // This should only be called if the auth type is not password, which is not the case so consider removing it
          // await trace(
          //   {
          //     name: TraceName.AppStartBiometricAuthentication,
          //     op: TraceOperation.BiometricAuthentication,
          //   },
          //   async () => {
          //     await Authentication.appTriggeredAuth();
          //   },
          // );
          // we need to reset the navigator here so that the user cannot go back to the login screen
          navigation.reset({ routes: [{ name: Routes.ONBOARDING.HOME_NAV }] });
        } else {
          navigation.reset({ routes: [{ name: Routes.ONBOARDING.ROOT_NAV }] });
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        // if there are no credentials, then they were cleared in the last session and we should not show biometrics on the login screen
        const locked =
          errorMessage === AUTHENTICATION_APP_TRIGGERED_AUTH_NO_CREDENTIALS;

        await Authentication.lockApp({ reset: false, locked });
        trackErrorAsAnalytics(
          'App: Max Attempts Reached',
          errorMessage,
          `Unlock attempts: 1`,
        );
      }
    };
    appTriggeredAuth().catch((error) => {
      Logger.error(error, 'App: Error in appTriggeredAuth');
    });
  }, [navigation, queueOfHandleDeeplinkFunctions]);

  const handleDeeplink = useCallback(
    ({
      error,
      params,
      uri,
    }: {
      error?: string | null;
      params?: Record<string, unknown>;
      uri?: string;
    }) => {
      if (error) {
        trackErrorAsAnalytics(error, 'Branch:');
      }
      const deeplink = params?.['+non_branch_link'] || uri || null;
      try {
        if (deeplink && typeof deeplink === 'string') {
          AppStateEventProcessor.setCurrentDeeplink(deeplink);
          SharedDeeplinkManager.parse(deeplink, {
            origin: AppConstants.DEEPLINKS.ORIGIN_DEEPLINK,
          });
        }
      } catch (e) {
        Logger.error(e as Error, `Deeplink: Error parsing deeplink`);
      }
    },
    [],
  );

  // on Android devices, this creates a listener
  // to deeplinks used to open the app
  // when it is in background (so not closed)
  // Documentation: https://reactnative.dev/docs/linking#handling-deep-links
  useEffect(() => {
    if (Device.isAndroid())
      Linking.addEventListener('url', (params) => {
        const { url } = params;
        if (url) {
          handleDeeplink({ uri: url });
        }
      });
  }, [handleDeeplink]);

  useEffect(() => {
    // Initialize deep link manager
    SharedDeeplinkManager.init({
      navigation,
      dispatch,
    });

    // Subscribe to incoming deeplinks
    // Branch.io documentation: https://help.branch.io/developers-hub/docs/react-native
    branch.subscribe((opts) => {
      const { error } = opts;

      if (error) {
        // Log error for analytics and continue handling deeplink
        const branchError = new Error(error);
        Logger.error(branchError, 'Error subscribing to branch.');
      }

      if (sdkInit.current) {
        handleDeeplink(opts);
      } else {
        queueOfHandleDeeplinkFunctions.current =
          queueOfHandleDeeplinkFunctions.current.concat([
            () => {
              handleDeeplink(opts);
            },
          ]);
      }
    });
  }, [dispatch, handleDeeplink, navigation, queueOfHandleDeeplinkFunctions]);

  useEffect(() => {
    const initMetrics = async () => {
      await MetaMetrics.getInstance().configure();
    };

    initMetrics().catch((err) => {
      Logger.error(err, 'Error initializing MetaMetrics');
    });
  }, []);

  useEffect(() => {
    // Init SDKConnect only if the navigator is ready, user is onboarded, and SDK is not initialized.
    async function initSDKConnect() {
      if (onboarded && sdkInit.current === undefined && userLoggedIn) {
        sdkInit.current = false;
        try {
          const sdkConnect = SDKConnect.getInstance();
          await sdkConnect.init({
            context: 'Nav/App',
            navigation: NavigationService.navigation,
          });
          await SDKConnect.getInstance().postInit(() => {
            setTimeout(() => {
              queueOfHandleDeeplinkFunctions.current = [];
            }, 1000);
          });
          sdkInit.current = true;
        } catch (err) {
          sdkInit.current = undefined;
          console.error(`Cannot initialize SDKConnect`, err);
        }
      }
    }

    initSDKConnect()
      .then(() => {
        queueOfHandleDeeplinkFunctions.current.forEach((func) => func());
      })
      .catch((err) => {
        Logger.error(err, 'Error initializing SDKConnect');
      });
  }, [onboarded, userLoggedIn]);

  useEffect(() => {
    if (isWC2Enabled) {
      DevLogger.log(`WalletConnect: Initializing WalletConnect Manager`);
      WC2Manager.init({ navigation: NavigationService.navigation }).catch(
        (err) => {
          console.error('Cannot initialize WalletConnect Manager.', err);
        },
      );
    }
  }, []);

  useEffect(() => {
    async function startApp() {
      const existingUser = await StorageWrapper.getItem(EXISTING_USER);
      if (!existingUser) {
        // List of chainIds to add (as hex strings)
        const chainIdsToAdd: `0x${string}`[] = [
          CHAIN_IDS.ARBITRUM,
          CHAIN_IDS.BASE,
          CHAIN_IDS.BSC,
          CHAIN_IDS.OPTIMISM,
          CHAIN_IDS.POLYGON,
        ];

        // Filter the PopularList to get only the specified networks based on chainId
        const selectedNetworks = PopularList.filter((network) =>
          chainIdsToAdd.includes(network.chainId),
        );
        const { NetworkController } = Engine.context;

        // Loop through each selected network and call NetworkController.addNetwork
        for (const network of selectedNetworks) {
          try {
            await NetworkController.addNetwork({
              chainId: network.chainId,
              blockExplorerUrls: [network.rpcPrefs.blockExplorerUrl],
              defaultRpcEndpointIndex: 0,
              defaultBlockExplorerUrlIndex: 0,
              name: network.nickname,
              nativeCurrency: network.ticker,
              rpcEndpoints: [
                {
                  url: network.rpcUrl,
                  name: network.nickname,
                  type: RpcEndpointType.Custom,
                },
              ],
            });
          } catch (error) {
            Logger.error(error as Error);
          }
        }
      }

      try {
        const currentVersion = getVersion();
        const savedVersion = await StorageWrapper.getItem(CURRENT_APP_VERSION);
        if (currentVersion !== savedVersion) {
          if (savedVersion)
            await StorageWrapper.setItem(LAST_APP_VERSION, savedVersion);
          await StorageWrapper.setItem(CURRENT_APP_VERSION, currentVersion);
        }

        const lastVersion = await StorageWrapper.getItem(LAST_APP_VERSION);
        if (!lastVersion) {
          if (existingUser) {
            // Setting last version to first version if user exists and lastVersion does not, to simulate update
            await StorageWrapper.setItem(LAST_APP_VERSION, '0.0.1');
          } else {
            // Setting last version to current version so that it's not treated as an update
            await StorageWrapper.setItem(LAST_APP_VERSION, currentVersion);
          }
        }
      } catch (error) {
        Logger.error(error as Error);
      }
    }

    startApp().catch((error) => {
      Logger.error(error, 'Error starting app');
    });
  }, []);

  return (
    <>
      <PPOMView />
      <AppFlow />
      <Toast ref={toastRef} />
    </>
  );
};

export default App;

