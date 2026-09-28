import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

import { Alert } from "react-native";

import * as ImagePicker from "expo-image-picker";

import {
	onAuthStateChanged,
	type User,
} from "firebase/auth";

import { auth } from "../firebase/config";

import {
	getAuthorizedDevices,
	type AuthorizedDevice,
} from "../firebase/permissions";

import type {
	ProcessedTemporaryPhoto,
	SelectedImage,
} from "../utils/web-photo-flow";

type SendPhotoFlowContextValue = {
	device: AuthorizedDevice | null;
	deviceLoading: boolean;
	deviceError: string | null;

	selectedImage: SelectedImage | null;
	processedPhoto: ProcessedTemporaryPhoto | null;

	durationMinutes: number;
	sendError: string | null;

	pickImage: () => Promise<boolean>;
	setProcessedPhoto: (
		photo: ProcessedTemporaryPhoto | null,
	) => void;
	setDurationMinutes: (minutes: number) => void;
	setSendError: (message: string | null) => void;

	resetImageFlow: () => void;
	resetAll: () => void;
};

const SendPhotoFlowContext =
	createContext<SendPhotoFlowContextValue | null>(
		null,
	);

export function SendPhotoFlowProvider({
	deviceId,
	children,
}: {
	deviceId: string;
	children: ReactNode;
}) {
	const [user, setUser] = useState<User | null>(
		null,
	);

	const [authReady, setAuthReady] =
		useState(false);

	const [device, setDevice] =
		useState<AuthorizedDevice | null>(null);

	const [deviceLoading, setDeviceLoading] =
		useState(true);

	const [deviceError, setDeviceError] =
		useState<string | null>(null);

	const [selectedImage, setSelectedImage] =
		useState<SelectedImage | null>(null);

	const [processedPhoto, setProcessedPhoto] =
		useState<ProcessedTemporaryPhoto | null>(
			null,
		);

	const [
		durationMinutes,
		setDurationMinutes,
	] = useState(60);

	const [sendError, setSendError] =
		useState<string | null>(null);

	useEffect(() => {
		const unsubscribe =
			onAuthStateChanged(
				auth,
				(currentUser) => {
					setUser(currentUser);
					setAuthReady(true);
				},
			);

		return unsubscribe;
	}, []);

	useEffect(() => {
		if (!authReady) {
			return;
		}

		if (!user) {
			setDevice(null);
			setDeviceError(
				"Você precisa estar autenticado.",
			);
			setDeviceLoading(false);
			return;
		}

		let active = true;

		const loadDevice = async () => {
			try {
				setDeviceLoading(true);
				setDeviceError(null);

				const devices =
					await getAuthorizedDevices(
						user.uid,
					);

				if (!active) {
					return;
				}

				const authorized =
					devices.find(
						(item) =>
							item.id === deviceId,
					) ?? null;

				if (!authorized) {
					setDevice(null);
					setDeviceError(
						"Você não tem autorização para este quadro.",
					);
					return;
				}

				setDevice(authorized);
			} catch (error) {
				console.error(
					"Erro ao carregar quadro autorizado:",
					error,
				);

				if (active) {
					setDevice(null);
					setDeviceError(
						"Não foi possível carregar o quadro.",
					);
				}
			} finally {
				if (active) {
					setDeviceLoading(false);
				}
			}
		};

		loadDevice();

		return () => {
			active = false;
		};
	}, [authReady, user, deviceId]);

	const pickImage = async () => {
		const result =
			await ImagePicker.launchImageLibraryAsync(
				{
					mediaTypes: ["images"],
					allowsEditing: false,
					quality: 1,
				},
			);

		if (result.canceled) {
			return false;
		}

		const image = result.assets[0];

		if (!image.width || !image.height) {
			Alert.alert(
				"Erro",
				"A imagem selecionada não possui dimensões válidas.",
			);

			return false;
		}

		setSelectedImage({
			uri: image.uri,
			width: image.width,
			height: image.height,
		});

		setProcessedPhoto(null);
		setSendError(null);

		return true;
	};

	const resetImageFlow = () => {
		setSelectedImage(null);
		setProcessedPhoto(null);
		setDurationMinutes(60);
		setSendError(null);
	};

	const resetAll = () => {
		resetImageFlow();
	};

	return (
		<SendPhotoFlowContext.Provider
			value={{
				device,
				deviceLoading,
				deviceError,

				selectedImage,
				processedPhoto,

				durationMinutes,
				sendError,

				pickImage,
				setProcessedPhoto,
				setDurationMinutes,
				setSendError,

				resetImageFlow,
				resetAll,
			}}
		>
			{children}
		</SendPhotoFlowContext.Provider>
	);
}

export function useSendPhotoFlow() {
	const context =
		useContext(SendPhotoFlowContext);

	if (!context) {
		throw new Error(
			"useSendPhotoFlow must be used inside SendPhotoFlowProvider.",
		);
	}

	return context;
}
