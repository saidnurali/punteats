import * as Sentry from "@sentry/react-native";
import { Stack } from "expo-router";

Sentry.init({
  dsn: "https://0f091efee75d48364fd93e05442fa60d@o4511773028253696.ingest.de.sentry.io/4511773045751888",
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
  tracesSampleRate: 1.0,
});

function RootLayout() {
  return <Stack />;
}

export default Sentry.wrap(RootLayout);
