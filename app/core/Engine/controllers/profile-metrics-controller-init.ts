import {
  ProfileMetricsController,
  ProfileMetricsControllerMessenger,
} from '@metamask/profile-metrics-controller';
import { analyticsControllerSelectors } from '@metamask/analytics-controller';
import { ControllerInitFunction } from '../types';
import { ProfileMetricsControllerInitMessenger } from '../messengers/profile-metrics-controller-messenger';
import Logger from '../../../util/Logger';

interface InternalAccountLike {
  options?: {
    entropy?: {
      type?: string;
      id?: string;
    };
  };
}

interface AccountsControllerStateLike {
  internalAccounts?: {
    accounts?: Record<string, InternalAccountLike>;
  };
}

interface ProfileMetricsControllerStateLike {
  initialEnqueueCompleted?: boolean;
  syncQueue?: Record<string, unknown[]>;
}

const pruneStaleEntropySourceSyncQueue = (
  profileMetricsState: ProfileMetricsControllerStateLike | undefined,
  accountsControllerState: AccountsControllerStateLike | undefined,
) => {
  const syncQueue = profileMetricsState?.syncQueue;
  const accounts = accountsControllerState?.internalAccounts?.accounts;

  if (!syncQueue || !accounts) {
    return profileMetricsState;
  }

  const validEntropySourceIds = new Set<string>(
    Object.values(accounts)
      .map((account) =>
        account.options?.entropy?.type === 'mnemonic'
          ? account.options.entropy.id
          : undefined,
      )
      .filter((id): id is string => Boolean(id)),
  );

  const staleKeys = Object.keys(syncQueue).filter(
    (key) => key !== 'null' && !validEntropySourceIds.has(key),
  );

  if (staleKeys.length === 0) {
    return profileMetricsState;
  }

  const nextSyncQueue = { ...syncQueue };
  staleKeys.forEach((key) => {
    delete nextSyncQueue[key];
  });

  Logger.log('[PROFILE METRICS DEBUG] Pruned stale entropy sources from syncQueue', {
    staleKeys,
  });

  return {
    ...profileMetricsState,
    syncQueue: nextSyncQueue,
  };
};

/**
 * Initialize the profile metrics controller.
 *
 * @param request - The request object.
 * @param request.controllerMessenger - The messenger to use for the controller.
 * @param request.persistedState - The persisted state to use for the
 * controller.
 * @param request.getController - A function to get other initialized controllers.
 * @returns The initialized controller.
 */
export const profileMetricsControllerInit: ControllerInitFunction<
  ProfileMetricsController,
  ProfileMetricsControllerMessenger,
  ProfileMetricsControllerInitMessenger
> = ({
  controllerMessenger,
  persistedState,
  getController,
  analyticsId,
  getState,
  initMessenger,
}) => {
  const remoteFeatureFlagController = getController(
    'RemoteFeatureFlagController',
  );
  const assertUserOptedIn = () => {
    const analyticsState = initMessenger.call('AnalyticsController:getState');
    const isEnabled =
      analyticsControllerSelectors.selectEnabled(analyticsState);
    return (
      remoteFeatureFlagController.state.remoteFeatureFlags.extensionUxPna25 ===
        true &&
      isEnabled === true &&
      getState().legalNotices.isPna25Acknowledged === true
    );
  };

  const controller = new ProfileMetricsController({
    messenger: controllerMessenger,
    state: pruneStaleEntropySourceSyncQueue(
      persistedState.ProfileMetricsController as
        | ProfileMetricsControllerStateLike
        | undefined,
      persistedState.AccountsController as AccountsControllerStateLike | undefined,
    ),
    assertUserOptedIn,
    getMetaMetricsId: () => analyticsId,
  });

  return {
    controller,
  };
};
