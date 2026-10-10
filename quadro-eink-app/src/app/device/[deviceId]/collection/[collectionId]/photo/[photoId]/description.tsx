import { useEffect, useMemo, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import { router, Stack, useLocalSearchParams } from "expo-router";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

import { getPhoto, updatePhotoDescription } from "@/firebase/photos";

import { getDevice } from "@/firebase/devices";
import { getPhotoCollection } from "@/firebase/collections";

import { MAX_PHOTO_DESCRIPTION_LENGTH } from "@/constants/constants";

import { useDeviceProcessing } from "@/contexts/DeviceProcessingContext";

export default function PhotoDescriptionScreen() {
	const { deviceId, collectionId, photoId } = useLocalSearchParams<{
		deviceId: string;
		collectionId: string;
		photoId: string;
	}>();

	const [description, setDescription] = useState("");

	const [deviceName, setDeviceName] = useState("");
	const [collectionName, setCollectionName] = useState("");

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const deviceProcessing = useDeviceProcessing();

	useEffect(() => {
		let isMounted = true;

		const load = async () => {
			try {
				const [photo, device, collection] = await Promise.all([
					getPhoto(deviceId, collectionId, photoId),
					getDevice(deviceId),
					getPhotoCollection(deviceId, collectionId),
				]);

				if (!isMounted) {
					return;
				}

				if (!photo) {
					Alert.alert("Foto não encontrada");

					router.back();
					return;
				}

				setDescription(photo.description ?? "");

				setDeviceName(device?.name ?? "");
				setCollectionName(collection?.name ?? "");
			} catch (error) {
				console.error("Erro ao carregar descrição:", error);

				Alert.alert("Erro", "Não foi possível carregar a descrição.");
			} finally {
				if (isMounted) {
					setLoading(false);
				}
			}
		};

		load();

		return () => {
			isMounted = false;
		};
	}, [deviceId, collectionId, photoId]);

	const subtitle = useMemo(
		() => [collectionName, deviceName].filter(Boolean).join(" · "),
		[collectionName, deviceName],
	);

	const save = async () => {
		try {
			setSaving(true);

			await updatePhotoDescription(
				deviceId,
				collectionId,
				photoId,
				description,
			);

			router.back();
		} catch (error) {
			console.error("Erro ao salvar descrição:", error);

			Alert.alert("Erro", "Não foi possível salvar a descrição.");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />

				<Screen>
					<View style={styles.loading}>
						<ActivityIndicator
							size="large"
							color={colors.primary}
						/>
					</View>
				</Screen>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<KeyboardAvoidingView
				style={styles.keyboardView}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				<Screen
					scroll
					contentContainerStyle={styles.screenContent}
					keyboardShouldPersistTaps="handled"
				>
					<ScreenHeader
						title="Descrição"
						subtitle={subtitle}
						showBackButton
						style={styles.header}
						processing={deviceProcessing}
					/>

					<Text style={styles.label}>Descrição da foto</Text>

					<TextInput
						value={description}
						onChangeText={setDescription}
						maxLength={MAX_PHOTO_DESCRIPTION_LENGTH}
						multiline
						autoFocus
						textAlignVertical="top"
						placeholder="Quem está na foto? O que aconteceu? O que você quer lembrar?"
						placeholderTextColor={colors.textMuted}
						style={styles.input}
					/>

					<Text style={styles.counter}>
						{description.length} / {MAX_PHOTO_DESCRIPTION_LENGTH}
					</Text>

					<PrimaryButton
						title="Salvar descrição"
						onPress={save}
						loading={saving}
						disabled={saving}
						style={styles.saveButton}
					/>
				</Screen>
			</KeyboardAvoidingView>
		</>
	);
}

const styles = StyleSheet.create({
	keyboardView: {
		flex: 1,
		backgroundColor: colors.background,
	},

	screenContent: {
		flexGrow: 1,
	},

	loading: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},

	header: {
		marginBottom: spacing.lg,
	},

	label: {
		marginBottom: spacing.sm,
		...typography.cardTitle,
		color: colors.text,
	},

	input: {
		minHeight: 180,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		...typography.input,
		color: colors.text,
	},

	counter: {
		marginTop: spacing.xs,
		...typography.metadata,
		color: colors.textSecondary,
		textAlign: "right",
	},

	saveButton: {
		marginTop: spacing.xxl,
	},
});
