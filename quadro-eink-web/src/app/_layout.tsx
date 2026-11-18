import { Stack } from "expo-router";
import WebVersionWatcher from "../components/WebVersionWatcher";
import "./global.css";

export default function RootLayout() {
  return (
    <>
      <WebVersionWatcher />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
