import { createLogger } from '../framework/logger';
import Assertions from '../framework/Assertions';
import { Gestures } from '../framework';
import Matchers from '../framework/Matchers';
import Utilities, { sleep } from '../framework/Utilities';
import LoginView from '../page-objects/wallet/LoginView';
import OnboardingView from '../page-objects/Onboarding/OnboardingView';

const logger = createLogger({
  name: 'GeneralFlow',
});

const findVisibleElement = async (
  elements: Promise<Detox.IndexableNativeElement>[],
  timeout = 10000,
): Promise<Promise<Detox.IndexableNativeElement> | null> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    for (const element of elements) {
      try {
        await Assertions.expectElementToBeVisible(element, { timeout: 750 });
        return element;
      } catch {
        // Try the next selector while the dev launcher UI settles.
      }
    }

    await sleep(500);
  }

  return null;
};

/**
 * Dismisses development build screens.
 * Handles 'Development servers' and 'Developer menu' screens.
 * These screens are expected to appear when running locally.
 */
export const dismissDevScreens = async (): Promise<void> => {
  const port = process.env.METRO_PORT_E2E || '8081';
  const host = process.env.METRO_HOST_E2E;
  const candidateHosts = [...new Set([host, 'localhost'].filter(Boolean))];
  const devServerCandidates = [
    ...candidateHosts.flatMap((candidateHost) => [
      Matchers.getElementByText(`http://${candidateHost}:${port}`),
      Matchers.getElementByLabel(`http://${candidateHost}:${port}`),
    ]),
    Matchers.getElementByTextContains(`:${port}`),
    Matchers.getElementByLabelContains(`:${port}`),
  ];

  try {
    // 1. Check for Development Servers screen
    const devServerRow = await findVisibleElement(devServerCandidates, 12000);
    if (!devServerRow) {
      throw new Error('Development server row was not found');
    }
    const devServerAttributes = await (await devServerRow).getAttributes();
    await Assertions.expectElementToBeVisible(devServerRow, {
      timeout: 2000,
      description: 'Dev Server Row should be visible',
    });
    if ('frame' in devServerAttributes) {
      const tapPoint = {
        x: Math.round(devServerAttributes.frame.x + devServerAttributes.frame.width / 2),
        y: Math.round(devServerAttributes.frame.y + devServerAttributes.frame.height / 2),
      };
      await device.tap(tapPoint);
    } else {
      await Gestures.tap(devServerRow, { elemDescription: 'Dev Server Row' });
    }

    // 2. Check for Developer Menu onboarding
    const continueButton = await findVisibleElement(
      [
        Matchers.getElementByText('Continue'),
        Matchers.getElementByLabel('Continue'),
      ],
      5000,
    );
    if (continueButton) {
      await Gestures.tap(continueButton, {
        elemDescription: 'Dev Menu Continue Button',
      });
    }

    // 3. Close the Developer Menu if the onboarding continues into the options list.
    const fastRefreshButton = await findVisibleElement(
      [Matchers.getElementByID('fast-refresh')],
      5000,
    );
    if (fastRefreshButton) {
      await Gestures.tap(fastRefreshButton, {
        elemDescription: 'Dev Menu Fast Refresh Button',
      });
    }
  } catch {
    logger.error('Dev screens dismiss error');
  }
};

/**
 * Waits for app initialization and rehydration to complete.
 * This ensures the app is in a stable state before proceeding with tests.
 * Handles the case where React Native reload triggers state rehydration that may
 * cause the app to briefly log out and return to the login screen.
 *
 * @async
 * @function waitForAppReady
 * @param {number} timeout - Maximum time to wait in milliseconds (default: 15000)
 * @returns {Promise<void>} Resolves when app is ready
 * @throws {Error} Throws an error if app fails to stabilize within timeout
 */
export const waitForAppReady = async (
  timeout: number = 15000,
): Promise<void> => {
  const startTime = Date.now();

  logger.debug('Waiting for app to complete rehydration and stabilize...');

  try {
    await sleep(500);
    await Utilities.executeWithRetry(
      async () => {
        await Assertions.expectElementToBeVisible(LoginView.container, {
          description: 'Login view should be stable',
          timeout: 2000,
        });

        // Verify it stays visible (not flickering)
        await sleep(1000);

        await Assertions.expectElementToBeVisible(LoginView.container, {
          description: 'Login view should remain visible',
          timeout: 1000,
        });
      },
      {
        timeout,
        description:
          'wait for app to complete rehydration and stabilize on login screen',
      },
    );

    logger.debug(`App ready after ${Date.now() - startTime}ms`);
  } catch (error) {
    let detectedScreen = 'unknown';

    try {
      await Assertions.expectElementToBeVisible(OnboardingView.container, {
        timeout: 1000,
        description: 'Onboarding screen should be visible when login screen is absent',
      });
      detectedScreen = 'onboarding';
    } catch {
      try {
        await Assertions.expectElementToBeVisible(LoginView.container, {
          timeout: 1000,
          description: 'Login screen should still be detectable when not stable',
        });
        detectedScreen = 'login-not-stable';
      } catch {
        // Keep the default value when neither startup screen can be detected.
      }
    }

    logger.error(`App failed to stabilize within ${timeout}ms`, error);
    throw new Error(
      `App did not stabilize on login screen within ${timeout}ms. ` +
        `Detected startup screen: ${detectedScreen}. ` +
        `This may indicate rehydration issues, fixture state not being applied, or state corruption.`,
    );
  }
};
