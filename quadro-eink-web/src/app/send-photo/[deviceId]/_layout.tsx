import {
	Stack,
	useLocalSearchParams,
} from "expo-router";

import { SendPhotoFlowProvider } from "../../../contexts/SendPhotoFlowContext";

export default function SendPhotoLayout() {
	const { deviceId } =
		useLocalSearchParams<{
			deviceId: string;
		}>();

	return (
		<SendPhotoFlowProvider
			deviceId={deviceId}
		>
			<Stack
				screenOptions={{
					headerShown: false,
					animation: "none",
				}}
			/>
		</SendPhotoFlowProvider>
	);
}
