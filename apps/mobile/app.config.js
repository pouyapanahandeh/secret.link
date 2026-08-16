/**
 * Dynamic Expo config — keeps static app.json as the base and injects
 * secrets / environment-specific Android Play values at build time.
 */
const appJson = require("./app.json");

const googleMapsApiKey =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  "";

module.exports = () => {
  const expo = appJson.expo;
  return {
    ...expo,
    android: {
      ...expo.android,
      config: {
        ...(expo.android?.config || {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    extra: {
      ...expo.extra,
      privacyPolicyUrl: "https://secretlink.life/privacy",
      termsOfServiceUrl: "https://secretlink.life/terms",
      supportUrl: "https://secretlink.life/contact",
    },
  };
};
