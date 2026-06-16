import { MockEventsObject } from '../../../framework';

const MINIMAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

export const STATIC_ASSETS_MOCKS: MockEventsObject = {
  HEAD: [
    {
      urlEndpoint: /^https:\/\/clients3\.google\.com\/generate_204$/,
      responseCode: 204,
      response: '',
    },
    {
      // v2 token icon CDN (eip155/{chainId}/erc20/{address}.png)
      urlEndpoint:
        /^https:\/\/static\.cx\.metamask\.io\/api\/v2\/tokenIcons\/assets\/.+\.png$/,
      responseCode: 200,
      response: '',
    },
    {
      // v1 token icon CDN ({chainId}/{address}.png) — used by Bridge, Predict,
      // Rewards, and any component that still references the legacy URL format.
      urlEndpoint:
        /^https:\/\/static\.cx\.metamask\.io\/api\/v1\/tokenIcons\/.+\.png$/,
      responseCode: 200,
      response: '',
    },
  ],
  GET: [
    {
      urlEndpoint:
        /^https:\/\/raw\.githubusercontent\.com\/MetaMask\/contract-metadata\/[^/]+\/images\/.+\.svg$/,
      responseCode: 200,
      response: MINIMAL_SVG,
    },
    {
      urlEndpoint:
        /^https:\/\/token\.api\.cx\.metamask\.io\/assets\/nativeCurrencyLogos\/.+\.svg$/,
      responseCode: 200,
      response: MINIMAL_SVG,
    },
    {
      urlEndpoint:
        /^https:\/\/metamask\.github\.io\/test-dapp\/metamask-fox\.svg$/,
      responseCode: 200,
      response: MINIMAL_SVG,
    },
  ],
};
