import {
	createContext,
	useContext,
	useEffect,
	useState,
	type PropsWithChildren,
} from "react";

import { subscribeToDeviceProcessingStatus } from "@/firebase/devices";

const DeviceProcessingContext = createContext(false);

type DeviceProcessingProviderProps = PropsWithChildren<{
	deviceId?: string;
}>;

export function DeviceProcessingProvider({
	deviceId,
	children,
}: DeviceProcessingProviderProps) {
	const [processing, setProcessing] = useState(false);

	useEffect(() => {
		if (!deviceId) {
			setProcessing(false);
			return;
		}

		setProcessing(false);

		return subscribeToDeviceProcessingStatus(deviceId, setProcessing);
	}, [deviceId]);

	return (
		<DeviceProcessingContext.Provider value={processing}>
			{children}
		</DeviceProcessingContext.Provider>
	);
}

export function useDeviceProcessing() {
	return useContext(DeviceProcessingContext);
}
