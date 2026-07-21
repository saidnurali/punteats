import { Redirect } from "expo-router";

// After onboarding finishes, go straight to the login screen
export default function HomeIndex() {
  return <Redirect href="/(home)/login" />;
}
