import Engine from '../../core/Engine';
import { forwardSelectedAccountGroupToSnapKeyring } from '../../core/SnapKeyring/utils/forwardSelectedAccountGroupToSnapKeyring';
import Logger from '../../util/Logger';

export class AccountTreeInitService {
  initializeAccountTree = async (): Promise<void> => {
    const { AccountTreeController, AccountsController } = Engine.context;

    Logger.log('[AUTH_DEBUG] initializeAccountTree: calling updateAccounts, keyring isUnlocked =', Engine.context.KeyringController.state.isUnlocked);
    await AccountsController.updateAccounts();
    Logger.log('[AUTH_DEBUG] initializeAccountTree: updateAccounts done');

    AccountTreeController.init();
    Logger.log('[AUTH_DEBUG] initializeAccountTree: AccountTreeController.init done');

    const selectedGroup = AccountTreeController.getSelectedAccountGroup();
    Logger.log('[AUTH_DEBUG] initializeAccountTree: selectedGroup =', selectedGroup);

    // Forward initial selected accounts.
    await forwardSelectedAccountGroupToSnapKeyring(selectedGroup);
    Logger.log('[AUTH_DEBUG] initializeAccountTree: forwardSelectedAccountGroupToSnapKeyring done');
  };

  clearState = async (): Promise<void> => {
    const { AccountTreeController } = Engine.context;

    AccountTreeController.clearState();
  };
}

export default new AccountTreeInitService();
