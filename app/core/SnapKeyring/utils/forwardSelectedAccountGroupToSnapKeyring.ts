import { AccountGroupId } from '@metamask/account-api';
import Engine from '../../Engine';
import Logger from '../../../util/Logger';

/**
 * Forward currently selected account group to the Snap keyring.
 *
 * @param groupId - Currently selected account group.
 */
export async function forwardSelectedAccountGroupToSnapKeyring(
  groupId: AccountGroupId | '',
) {
  const { AccountTreeController } = Engine.context;

  // This logic should be moved to the Snap keyring package and rely on the messaging
  // system to subscribe to events and use actions to get the currently selected
  // accounts from the tree.
  //
  // Though, we decided to do it at client-level for simplicity and because it's a
  // change that needed to be cherry-picked in the 7.57.
  //
  // This will be addressed in later releases.

  if (groupId) {
    const group = AccountTreeController.getAccountGroupObject(groupId);
    if (group) {
      Logger.log('[AUTH_DEBUG] forwardSelectedAccountGroupToSnapKeyring: calling getSnapKeyring, keyring isUnlocked =', Engine.context.KeyringController.state.isUnlocked);
      const snapKeyring = await Engine.getSnapKeyring();
      Logger.log('[AUTH_DEBUG] forwardSelectedAccountGroupToSnapKeyring: getSnapKeyring done, calling setSelectedAccounts');
      snapKeyring.setSelectedAccounts(group.accounts);
      Logger.log('[AUTH_DEBUG] forwardSelectedAccountGroupToSnapKeyring: setSelectedAccounts done');
    } else {
      Logger.log('[AUTH_DEBUG] forwardSelectedAccountGroupToSnapKeyring: no group found for groupId =', groupId);
    }
  } else {
    Logger.log('[AUTH_DEBUG] forwardSelectedAccountGroupToSnapKeyring: groupId is empty, skipping');
  }
}
