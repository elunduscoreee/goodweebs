import { ApolloProvider } from "@apollo/react-hooks";
import { AppLoading } from "expo";
import React, { useState, useEffect } from "react";
import { AsyncStorage } from "react-native";
import * as Sentry from "sentry-expo";
import { ANILIST_ACCESS_TOKEN_STORAGE } from "yep/constants";
import { client } from "yep/graphql/client";
import { useFonts } from "yep/hooks/font";
import { Navigation } from "yep/navigation";

Sentry.init({
  dsn:
    "https://b2756b0df548451d98707d024aff00d1@o58038.ingest.sentry.io/5248224",
});

export default function App() {
  const [checkedForToken, setCheckedForToken] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const fontsLoaded = useFonts({
    "Manrope-Bold": require("yep/assets/fonts/manrope/Manrope-Bold.otf"),
    "Manrope-ExtraBold": require("yep/assets/fonts/manrope/Manrope-ExtraBold.otf"),
    "Manrope-ExtraLight": require("yep/assets/fonts/manrope/Manrope-ExtraLight.otf"),
    "Manrope-Light": require("yep/assets/fonts/manrope/Manrope-Light.otf"),
    "Manrope-Medium": require("yep/assets/fonts/manrope/Manrope-Medium.otf"),
    "Manrope-Regular": require("yep/assets/fonts/manrope/Manrope-Regular.otf"),
    "Manrope-SemiBold": require("yep/assets/fonts/manrope/Manrope-SemiBold.otf"),
  });

  useEffect(function navigateIfAccessTokenExists() {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(ANILIST_ACCESS_TOKEN_STORAGE);
        if (token) {
          setAccessToken(token);
        }
      } catch (_) {
      } finally {
        setCheckedForToken(true);
      }
    })();
  });

  return fontsLoaded && checkedForToken ? (
    <ApolloProvider client={client}>
      <Navigation accessToken={accessToken} />
    </ApolloProvider>
  ) : (
    <AppLoading />
  );
}
