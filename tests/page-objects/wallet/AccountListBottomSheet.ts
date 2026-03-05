import { waitFor } from 'detox';
import { CellComponentSelectorsIDs } from '../../../app/component-library/components/Cells/Cell/CellComponent.testIds';
import {
  AccountListBottomSheetSelectorsIDs,
  AccountListBottomSheetSelectorsText,
} from '../../../app/components/Views/AccountSelector/AccountListBottomSheet.testIds';
import { AddAccountBottomSheetSelectorsIDs } from '../../../app/components/Views/AddAccountActions/AddAccountBottomSheet.testIds';
import { WalletViewSelectorsIDs } from '../../../app/components/Views/Wallet/WalletView.testIds';
import { ConnectAccountBottomSheetSelectorsIDs } from '../../../app/components/Views/AccountConnect/ConnectAccountBottomSheet.testIds';
import { AccountCellIds } from '../../../app/component-library/components-temp/MultichainAccounts/AccountCell/AccountCell.testIds';
import Matchers from '../../framework/Matchers';
import Gestures from '../../framework/Gestures';
import { createLogger } from '../../framework/logger';

const logger = createLogger({ name: 'AccountListBottomSheet' });

class AccountListBottomSheet {
  get importSrpAction(): DetoxElement {
    return Matchers.getElementByID(
      AddAccountBottomSheetSelectorsIDs.IMPORT_SRP_BUTTON,
    );
  }

  get importAccountAction(): DetoxElement {
    return Matchers.getElementByID(
      AddAccountBottomSheetSelectorsIDs.IMPORT_ACCOUNT_BUTTON,
    );
  }

  get accountList(): DetoxElement {
    return Matchers.getElementByID(
      AccountListBottomSheetSelectorsIDs.ACCOUNT_LIST_ID,
    );
  }

  get accountTypeLabel(): DetoxElement {
    return Matchers.getElementByID(
      AccountListBottomSheetSelectorsIDs.ACCOUNT_TYPE_LABEL,
    );
  }

  get accountTagLabel(): DetoxElement {
    return Matchers.getElementByID(CellComponentSelectorsIDs.TAG_LABEL);
  }

  get title(): DetoxElement {
    return Matchers.getElementByText(
      AccountListBottomSheetSelectorsText.ACCOUNTS_LIST_TITLE,
    );
  }

  get addAccountButton(): DetoxElement {
    return Matchers.getElementByID(
      AccountListBottomSheetSelectorsIDs.ACCOUNT_LIST_ADD_BUTTON_ID,
    );
  }

  private async countElementsById(testId: string): Promise<number> {
    let count = 0;

    for (;;) {
      try {
        await waitFor(element(by.id(testId)).atIndex(count))
          .toExist()
          .withTimeout(100);
        count += 1;
      } catch {
        return count;
      }
    }
  }

  private async logAccountNamesV2(): Promise<void> {
    const count = await this.countElementsById(AccountCellIds.ADDRESS);
    logger.debug(`V2 account cell count: ${AccountCellIds.ADDRESS}=${count}`);

    for (let index = 0; index < count; index += 1) {
      try {
        const accountElement = (await Matchers.getElementByID(
          AccountCellIds.ADDRESS,
          index,
        )) as Detox.IndexableNativeElement;
        const attributes = await accountElement.getAttributes();
        logger.debug(
          `V2 account cell[${index}] attributes: ${JSON.stringify({
            text: 'text' in attributes ? attributes.text : undefined,
            label: 'label' in attributes ? attributes.label : undefined,
            identifier:
              'identifier' in attributes ? attributes.identifier : undefined,
            frame: 'frame' in attributes ? attributes.frame : undefined,
          })}`,
        );
      } catch (error) {
        logger.debug(`V2 account cell[${index}] attributes unavailable`, error);
      }
    }
  }

  private async getPreferredAddWalletButton(): Promise<Detox.IndexableNativeElement> {
    const addWalletButtonCount = await this.countElementsById(
      AccountListBottomSheetSelectorsIDs.ACCOUNT_LIST_ADD_BUTTON_ID,
    );
    logger.debug(
      `Add wallet button count: ${AccountListBottomSheetSelectorsIDs.ACCOUNT_LIST_ADD_BUTTON_ID}=${addWalletButtonCount}`,
    );

    for (let index = 0; index < addWalletButtonCount; index += 1) {
      const candidate = (await Matchers.getElementByID(
        AccountListBottomSheetSelectorsIDs.ACCOUNT_LIST_ADD_BUTTON_ID,
        index,
      )) as Detox.IndexableNativeElement;

      let isVisible = false;
      try {
        await waitFor(candidate).toBeVisible().withTimeout(100);
        isVisible = true;
      } catch {
        // Keep scanning for a visible match.
      }

      logger.debug(`Add wallet button[${index}] visible=${isVisible}`);
      if (isVisible) {
        return candidate;
      }
    }

    return (await Matchers.getElementByID(
      AccountListBottomSheetSelectorsIDs.ACCOUNT_LIST_ADD_BUTTON_ID,
      0,
    )) as Detox.IndexableNativeElement;
  }

  private async logAddWalletButtonAttributes(
    button: Detox.IndexableNativeElement,
  ): Promise<Detox.ElementAttributes> {
    const attributes = await button.getAttributes();
    logger.debug(
      `Add wallet button attributes: ${JSON.stringify(
        this.extractDebugAttributes(attributes),
      )}`,
    );
    return attributes;
  }

  private extractDebugAttributes(attributes: Detox.ElementAttributes) {
    return {
      enabled: 'enabled' in attributes ? attributes.enabled : undefined,
      label: 'label' in attributes ? attributes.label : undefined,
      text: 'text' in attributes ? attributes.text : undefined,
      identifier: 'identifier' in attributes ? attributes.identifier : undefined,
      frame: 'frame' in attributes ? attributes.frame : undefined,
      visible: 'visible' in attributes ? attributes.visible : undefined,
      activationPoint:
        'activationPoint' in attributes ? attributes.activationPoint : undefined,
      normalizedActivationPoint:
        'normalizedActivationPoint' in attributes
          ? attributes.normalizedActivationPoint
          : undefined,
    };
  }

  private async logElementSnapshot(
    name: string,
    targetElement: Detox.IndexableNativeElement,
  ): Promise<void> {
    try {
      const attributes = await targetElement.getAttributes();
      logger.debug(
        `${name}: ${JSON.stringify(this.extractDebugAttributes(attributes))}`,
      );
    } catch (error) {
      logger.debug(`${name} unavailable`, error);
    }
  }

  private async logActionCounts(
    label: string,
    actionIds: string[],
  ): Promise<void> {
    const counts = await Promise.all(
      actionIds.map(async (actionId) => ({
        actionId,
        count: await this.countElementsById(actionId),
      })),
    );
    logger.debug(
      `${label}: ${counts
        .map(({ actionId, count }) => `${actionId}=${count}`)
        .join(', ')}`,
    );
  }

  private async logPostTapDiagnostics(
    context: string,
    button: Detox.IndexableNativeElement,
    actionIds: string[] = [],
  ): Promise<void> {
    await this.logElementSnapshot(`${context} button snapshot immediately`, button);
    await this.logElementSnapshot(
      `${context} account list snapshot immediately`,
      (await this.accountList) as Detox.IndexableNativeElement,
    );
    if (actionIds.length > 0) {
      await this.logActionCounts(`${context} action counts immediately`, actionIds);
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
    await this.logElementSnapshot(`${context} button snapshot after 300ms`, button);
    if (actionIds.length > 0) {
      await this.logActionCounts(`${context} action counts after 300ms`, actionIds);
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
    await this.logElementSnapshot(`${context} button snapshot after 1500ms`, button);
    await this.logElementSnapshot(
      `${context} account list snapshot after 1500ms`,
      (await this.accountList) as Detox.IndexableNativeElement,
    );
    if (actionIds.length > 0) {
      await this.logActionCounts(`${context} action counts after 1500ms`, actionIds);
    }
  }

  private async waitForButtonToLeaveSyncingState(
    button: Detox.IndexableNativeElement,
    description: string,
    timeout = 25000,
  ): Promise<Detox.ElementAttributes> {
    const deadline = Date.now() + timeout;
    let lastAttributes = await button.getAttributes();

    for (;;) {
      const text =
        'text' in lastAttributes ? String(lastAttributes.text ?? '') : '';
      const label =
        'label' in lastAttributes ? String(lastAttributes.label ?? '') : '';
      const normalizedText = text.trim();
      const normalizedLabel = label.trim();
      const loadingStates = new Set([
        'Syncing',
        'Discovering accounts...',
        'Discovering accounts',
      ]);
      const isSyncing =
        loadingStates.has(normalizedText) || loadingStates.has(normalizedLabel);

      if (!isSyncing) {
        return lastAttributes;
      }

      if (Date.now() >= deadline) {
        logger.debug(
          `${description} remained in Syncing state after ${timeout}ms; proceeding with last known attributes.`,
        );
        return lastAttributes;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      lastAttributes = await button.getAttributes();
    }
  }

  get addEthereumAccountButton(): DetoxElement {
    return Matchers.getElementByText(
      AccountListBottomSheetSelectorsText.ADD_ETHEREUM_ACCOUNT,
    );
  }

  get removeAccountAlertText(): DetoxElement {
    return Matchers.getElementByText(
      AccountListBottomSheetSelectorsText.REMOVE_IMPORTED_ACCOUNT,
    );
  }

  get connectAccountsButton(): DetoxElement {
    return Matchers.getElementByID(
      ConnectAccountBottomSheetSelectorsIDs.SELECT_MULTI_BUTTON,
    );
  }

  createAccountLink(index: number): DetoxElement {
    return Matchers.getElementByID(
      AccountListBottomSheetSelectorsIDs.CREATE_ACCOUNT,
      index,
    );
  }

  async getAccountElementByAccountName(
    accountName: string,
  ): Promise<DetoxElement> {
    return Matchers.getElementByIDAndLabel(
      CellComponentSelectorsIDs.BASE_TITLE,
      accountName,
    );
  }

  getAccountElementByAccountNameV2(accountName: string): DetoxElement {
    return Matchers.getElementByIDAndLabel(AccountCellIds.ADDRESS, accountName);
  }

  async expectAccountByNameV2(
    accountName: string,
    options: { timeout?: number; description?: string } = {},
  ): Promise<void> {
    const {
      timeout = 15000,
      description = `Account with name "${accountName}" should be present`,
    } = options;
    const isAndroid = device.getPlatform() === 'android';
    const effectiveTimeout = isAndroid ? Math.max(timeout, 30000) : timeout;
    const accountElement =
      (await this.getAccountElementByAccountNameV2(
        accountName,
      )) as Detox.IndexableNativeElement;

    if (isAndroid) {
      logger.debug(
        `Expecting V2 account by existence on Android: ${accountName}`,
      );
      try {
        await waitFor(accountElement).toExist().withTimeout(effectiveTimeout);
        return;
      } catch {
        logger.debug(
          `V2 account by id+label did not resolve for "${accountName}", attempting text-based search with scrolling.`,
        );
      }

      const accountByText =
        (await Matchers.getElementByText(
          accountName,
        )) as Detox.IndexableNativeElement;
      const deadline = Date.now() + effectiveTimeout;
      let attempt = 0;

      while (Date.now() < deadline) {
        try {
          await waitFor(accountByText).toBeVisible().withTimeout(300);
          logger.debug(
            `Resolved V2 account "${accountName}" using text fallback after ${attempt} scroll attempt(s).`,
          );
          return;
        } catch {
          // Continue and scroll to search for virtualized rows.
        }

        const direction = attempt % 3 === 2 ? 'down' : 'up';
        await Gestures.swipe(this.accountList, direction, {
          speed: 'fast',
          percentage: 0.35,
        });
        attempt += 1;
      }

      try {
        await waitFor(accountElement).toExist().withTimeout(500);
      } catch (error) {
        await this.logAccountNamesV2();
        throw error;
      }
      return;
    }

    await waitFor(accountElement).toBeVisible().withTimeout(effectiveTimeout);
    logger.debug(description);
  }

  async getSelectElement(index: number): DetoxElement {
    return Matchers.getElementByID(CellComponentSelectorsIDs.SELECT, index);
  }

  async getMultiselectElement(index: number): Promise<DetoxElement> {
    return Matchers.getElementByID(
      CellComponentSelectorsIDs.MULTISELECT,
      index,
    );
  }

  /**
   * Retrieves the title/name of an element using the `cellbase-avatar-title` ID.
   * Note: The `select-with-menu` ID element seems to never receive the tap event,
   * so this method fetches the title/name instead.
   *
   * @param {number} index - The index of the element to retrieve.
   * @returns {Detox.IndexableNativeElement} The matcher for the element's title/name.
   */
  getSelectWithMenuElementName(index: number): DetoxElement {
    return Matchers.getElementByID(CellComponentSelectorsIDs.BASE_TITLE, index);
  }

  async tapEditAccountActionsAtIndex(index: number): Promise<void> {
    await Gestures.tapAtIndex(
      Matchers.getElementByID(WalletViewSelectorsIDs.ACCOUNT_ACTIONS),
      index,
    );
  }

  async accountNameInList(accountName: string): Promise<DetoxElement> {
    return Matchers.getElementByText(accountName, 1);
  }

  async tapAccountIndex(index: number): Promise<void> {
    await Gestures.waitAndTap(this.getMultiselectElement(index), {
      elemDescription: `Account at index ${index}`,
    });
  }

  async tapToSelectActiveAccountAtIndex(index: number): Promise<void> {
    await Gestures.waitAndTap(this.getSelectWithMenuElementName(index), {
      elemDescription: `Account at index ${index}`,
    });
  }

  async longPressAccountAtIndex(index: number): Promise<void> {
    await Gestures.longPress(this.getSelectWithMenuElementName(index), {
      elemDescription: 'Account name',
    });
  }

  async tapAddAccountButton(): Promise<void> {
    const addWalletActionIds = [
      AddAccountBottomSheetSelectorsIDs.IMPORT_ACCOUNT_BUTTON,
      AddAccountBottomSheetSelectorsIDs.IMPORT_SRP_BUTTON,
    ];
    const waitForAddWalletActions = async () => {
      const importSrpAction =
        (await this.importSrpAction) as Detox.IndexableNativeElement;
      const importAccountAction =
        (await this.importAccountAction) as Detox.IndexableNativeElement;

      await waitFor(importSrpAction).toExist().withTimeout(3000);
      await waitFor(importAccountAction).toExist().withTimeout(10000);
    };

    const addWalletButton = await this.getPreferredAddWalletButton();
    const addWalletButtonAttributes =
      await this.logAddWalletButtonAttributes(addWalletButton);

    if ('frame' in addWalletButtonAttributes) {
      const tapPoint = {
        x: Math.round(
          addWalletButtonAttributes.frame.x +
            addWalletButtonAttributes.frame.width / 2,
        ),
        y: Math.round(
          addWalletButtonAttributes.frame.y +
            addWalletButtonAttributes.frame.height / 2,
        ),
      };
      logger.debug(
        `Add wallet button coordinate tap point: ${JSON.stringify(tapPoint)}`,
      );
      await device.tap(tapPoint, false);
    } else {
      logger.debug(
        'Add wallet button frame unavailable, falling back to semantic tap first.',
      );
      await Gestures.waitAndTap(Promise.resolve(addWalletButton), {
        elemDescription: 'Add wallet button',
        checkVisibility: false,
        checkStability: true,
      });
    }

    await this.logPostTapDiagnostics(
      'Add wallet',
      addWalletButton,
      addWalletActionIds,
    );

    try {
      await waitForAddWalletActions();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      await this.logActionCounts(
        'Add wallet action counts after 10s',
        addWalletActionIds,
      );

      logger.debug(
        'Add wallet action IDs still missing after coordinate tap; retrying with semantic tap.',
      );
      await Gestures.waitAndTap(Promise.resolve(addWalletButton), {
        elemDescription: 'Add wallet button',
        checkVisibility: false,
        checkStability: true,
      });
      await this.logPostTapDiagnostics(
        'Add wallet semantic retry',
        addWalletButton,
        addWalletActionIds,
      );

      try {
        await waitForAddWalletActions();
      } catch {
        throw new Error(
          'Add wallet footer button did not expose the add-wallet action testIDs ' +
            `(${AddAccountBottomSheetSelectorsIDs.IMPORT_SRP_BUTTON}, ` +
            `${AddAccountBottomSheetSelectorsIDs.IMPORT_ACCOUNT_BUTTON}) ` +
            'after both coordinate and semantic taps.',
        );
      }
    }
  }

  async tapAddAccountButtonV2(options?: {
    srpIndex?: number;
    shouldWait?: boolean;
  }): Promise<void> {
    const createAccountCount = await this.countElementsById(
      AccountListBottomSheetSelectorsIDs.CREATE_ACCOUNT,
    );
    logger.debug(
      `Add Account button V2 count: ${AccountListBottomSheetSelectorsIDs.CREATE_ACCOUNT}=${createAccountCount}`,
    );

    const button = (await Matchers.getElementByID(
      AccountListBottomSheetSelectorsIDs.CREATE_ACCOUNT,
      options?.srpIndex ?? 0,
    )) as Detox.IndexableNativeElement;

    if (options?.shouldWait) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    const attributes = await this.waitForButtonToLeaveSyncingState(
      button,
      'Add Account button V2',
    );
    logger.debug(
      `Add Account button V2 attributes: ${JSON.stringify({
        enabled: 'enabled' in attributes ? attributes.enabled : undefined,
        label: 'label' in attributes ? attributes.label : undefined,
        text: 'text' in attributes ? attributes.text : undefined,
        identifier:
          'identifier' in attributes ? attributes.identifier : undefined,
        frame: 'frame' in attributes ? attributes.frame : undefined,
      })}`,
    );

    if ('frame' in attributes) {
      const tapPoint = {
        x: Math.round(attributes.frame.x + attributes.frame.width / 2),
        y: Math.round(attributes.frame.y + attributes.frame.height / 2),
      };
      logger.debug(
        `Add Account button V2 coordinate tap point: ${JSON.stringify(tapPoint)}`,
      );
      await device.tap(tapPoint, false);
      await this.logPostTapDiagnostics('Add Account V2', button);
      return;
    }

    await Gestures.waitAndTap(Promise.resolve(button), {
      elemDescription: 'Add Account button in V2 multichain accounts',
      checkVisibility: false,
      checkStability: true,
    });
    await this.logPostTapDiagnostics('Add Account V2 semantic fallback', button);
  }

  async tapAddEthereumAccountButton(): Promise<void> {
    await Gestures.waitAndTap(this.addEthereumAccountButton, {
      elemDescription: 'Add Ethereum Account button',
    });
  }

  async tapCreateAccount(index: number): Promise<void> {
    const link = this.createAccountLink(index);
    await Gestures.waitAndTap(link, {
      elemDescription: 'Create account link',
    });
  }

  async longPressImportedAccount(): Promise<void> {
    await Gestures.longPress(this.getSelectElement(1), {
      elemDescription: 'Imported account',
    });
  }

  async swipeToDismissAccountsModal(): Promise<void> {
    await Gestures.swipe(this.title, 'down', {
      speed: 'fast',
      percentage: 0.6,
    });
  }

  async tapYesToRemoveImportedAccountAlertButton(): Promise<void> {
    await Gestures.waitAndTap(this.removeAccountAlertText, {
      elemDescription: 'Yes to remove imported account alert button',
    });
  }

  async tapConnectAccountsButton(): Promise<void> {
    await Gestures.waitAndTap(this.connectAccountsButton, {
      elemDescription: 'Connect accounts button',
    });
  }

  async tapAccountByName(accountName: string): Promise<void> {
    const name = Matchers.getElementByText(accountName);

    await Gestures.waitAndTap(name);
  }

  async tapAccountByNameV2(accountName: string): Promise<void> {
    const accountElement = this.getAccountElementByAccountNameV2(accountName);
    await Gestures.waitAndTap(accountElement, {
      elemDescription: `Tap on account with name: ${accountName}`,
    });
  }

  async scrollToAccount(index: number): Promise<void> {
    await Gestures.scrollToElement(
      Matchers.getElementByID(WalletViewSelectorsIDs.ACCOUNT_ACTIONS, index),
      Matchers.getIdentifier(
        AccountListBottomSheetSelectorsIDs.ACCOUNT_LIST_ID,
      ),
    );
  }

  async scrollToBottomOfAccountList(): Promise<void> {
    await Gestures.swipe(this.accountList, 'up', {
      speed: 'fast',
    });
  }

  // V2 Multichain Accounts Methods
  get ellipsisMenuButton(): DetoxElement {
    return Matchers.getElementByID(AccountCellIds.MENU);
  }

  /**
   * Get the ellipsis menu button for a specific account by index
   * @param accountIndex - The index of the account (0-based)
   * @returns The ellipsis menu element at the specified index
   */
  async getEllipsisMenuButtonAtIndex(
    accountIndex: number,
  ): Promise<Detox.IndexableNativeElement> {
    const el = (await this.ellipsisMenuButton) as Detox.IndexableNativeElement;
    return el.atIndex(accountIndex) as Detox.IndexableNativeElement;
  }

  /**
   * Tap the ellipsis menu button for a specific account in V2 multichain accounts
   * @param accountIndex - The index of the account to tap (0-based)
   */
  async tapAccountEllipsisButtonV2(
    accountIndex: number,
    { shouldWait = false }: { shouldWait: boolean } = { shouldWait: false },
  ): Promise<void> {
    await Gestures.tapAtIndex(this.ellipsisMenuButton, accountIndex, {
      elemDescription: `V2 ellipsis menu button for account at index ${accountIndex}`,
      delay: shouldWait ? 1500 : 0,
    });
  }

  /**
   * Dismiss the account list modal in V2 multichain accounts
   * Note: EditAccountName screen auto-dismisses after save in V2, so no manual close needed
   * V2 has multiple modal layers - need to swipe twice to fully dismiss
   */
  async dismissAccountListModalV2(): Promise<void> {
    // First swipe to dismiss the MultichainAccountActions modal
    await this.swipeToDismissAccountsModal();

    // Second swipe to dismiss the AccountListBottomSheet
    await this.swipeToDismissAccountsModal();
  }
}

export default new AccountListBottomSheet();
