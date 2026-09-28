import { useEffect, useState } from "react";

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

import {
	router,
	Stack,
	useLocalSearchParams,
} from "expo-router";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import {
	colors,
	radius,
	spacing,
	typography,
} from "@/theme";

import {
	createPhotoCollection,
	getPhotoCollection,
	renamePhotoCollection,
} from "@/firebase/collections";

import { getDevice } from "@/firebase/devices";

export default function EditCollectionScreen() {
	const { deviceId, collectionId } =
		useLocalSearchParams<{
			deviceId: string;
			collectionId?: string;
		}>();

	const [name, setName] = useState("");
	const [deviceName, setDeviceName] =
		useState("");

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		let isMounted = true;

		const load = async () => {
			try {
				const [device, photoCollection] =
					await Promise.all([
						getDevice(deviceId),
						collectionId
							? getPhotoCollection(
									deviceId,
									collectionId,
								)
							: Promise.resolve(null),
					]);

				if (!isMounted) {
					return;
				}

				setDeviceName(device?.name ?? "");

				if (
					collectionId &&
					!photoCollection
				) {
					Alert.alert(
						"Coleção não encontrada",
					);

					router.back();
					return;
				}

				if (photoCollection) {
					setName(photoCollection.name);
				}
			} catch (error) {
				console.error(error);

				Alert.alert(
					"Erro",
					"Não foi possível carregar a coleção.",
				);
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
	}, [deviceId, collectionId]);

	const save = async () => {
		const trimmedName = name.trim();

		if (!trimmedName) {
			Alert.alert(
				"Nome obrigatório",
				"Digite um nome para a coleção.",
			);

			return;
		}

		try {
			setSaving(true);

			if (collectionId) {
				await renamePhotoCollection(
					deviceId,
					collectionId,
					trimmedName,
				);
			} else {
				await createPhotoCollection(
					deviceId,
					trimmedName,
				);
			}

			router.back();
		} catch (error) {
			console.error(error);

			Alert.alert(
				"Erro",
				"Não foi possível salvar a coleção.",
			);
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<>
				<Stack.Screen
					options={{ headerShown: false }}
				/>

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
			<Stack.Screen
				options={{ headerShown: false }}
			/>

			<KeyboardAvoidingView
				style={styles.keyboardView}
				behavior={
					Platform.OS === "ios"
						? "padding"
						: "height"
				}
			>
				<Screen
					scroll
					contentContainerStyle={
						styles.screenContent
					}
					keyboardShouldPersistTaps="handled"
				>
					<ScreenHeader
						title={
							collectionId
								? "Editar coleção"
								: "Nova coleção"
						}
						subtitle={deviceName}
						showBackButton
						style={styles.header}
					/>

					<View style={styles.form}>
						<Text style={styles.label}>
							Nome da coleção
						</Text>

						<TextInput
							value={name}
							onChangeText={setName}
							placeholder="Ex.: Família"
							placeholderTextColor={
								colors.textMuted
							}
							autoFocus
							returnKeyType="done"
							onSubmitEditing={save}
							style={styles.input}
						/>

						<PrimaryButton
							title="Salvar coleção"
							onPress={save}
							loading={saving}
							disabled={
								!name.trim() ||
								saving
							}
							style={
								styles.saveButton
							}
						/>
					</View>
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

	form: {
		flex: 1,
	},

	label: {
		marginBottom: spacing.sm,
		...typography.cardTitle,
		color: colors.text,
	},

	input: {
		minHeight: 52,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		...typography.input,
		color: colors.text,
	},

	saveButton: {
		marginTop: spacing.xxl,
	},
});
