import { useEffect, useState } from "react";

import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "../firebase/config";

import { signInWithGoogle, signOutUser } from "../firebase/auth";

import {
	getAuthorizedDevices,
	type AuthorizedDevice,
} from "../firebase/permissions";

export default function HomeScreen() {
	const [user, setUser] = useState<User | null>(null);

	const [loading, setLoading] = useState(true);

	const [signingIn, setSigningIn] = useState(false);

	const [checkingPermission, setCheckingPermission] = useState(false);

	const [authorizedDevices, setAuthorizedDevices] = useState<
		AuthorizedDevice[] | null
	>(null);

	const [permissionError, setPermissionError] = useState(false);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			setUser(currentUser);
			setLoading(false);
		});

		return unsubscribe;
	}, []);

	useEffect(() => {
		if (!user) {
			setAuthorizedDevices(null);
			setPermissionError(false);

			return;
		}

		const loadPermissions = async () => {
			try {
				setCheckingPermission(true);
				setPermissionError(false);

				const devices = await getAuthorizedDevices(user.uid);

				setAuthorizedDevices(devices);
			} catch (error) {
				console.error("Erro ao carregar autorizações:", error);

				setPermissionError(true);
			} finally {
				setCheckingPermission(false);
			}
		};

		loadPermissions();
	}, [user]);

	const handleSignIn = async () => {
		try {
			setSigningIn(true);

			await signInWithGoogle();
		} catch (error) {
			console.error("Erro ao entrar com Google:", error);
		} finally {
			setSigningIn(false);
		}
	};

	if (loading) {
		return (
			<View style={styles.container}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!user) {
		return (
			<View style={styles.container}>
				<View style={styles.card}>
					<Text style={styles.title}>Quadro E-ink</Text>

					<Text style={styles.description}>
						Entre com sua conta Google para continuar.
					</Text>

					<Pressable
						style={styles.primaryButton}
						onPress={handleSignIn}
						disabled={signingIn}
					>
						<Text style={styles.primaryButtonText}>
							{signingIn ? "Entrando..." : "Entrar com Google"}
						</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	if (checkingPermission || authorizedDevices === null) {
		return (
			<View style={styles.container}>
				<ActivityIndicator size="large" />

				<Text style={styles.loadingText}>
					Verificando autorização...
				</Text>
			</View>
		);
	}

	if (permissionError) {
		return (
			<View style={styles.container}>
				<View style={styles.card}>
					<Text style={styles.title}>Erro</Text>

					<Text style={styles.description}>
						Não foi possível verificar suas autorizações.
					</Text>

					<Pressable
						style={styles.secondaryButton}
						onPress={signOutUser}
					>
						<Text style={styles.secondaryButtonText}>Sair</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	/*
	 * Logado, mas nenhum documento de autorização.
	 */
	if (authorizedDevices.length === 0) {
		return (
			<View style={styles.container}>
				<View style={styles.card}>
					<Text style={styles.title}>Aguardando autorização</Text>

					<Text style={styles.description}>
						Sua conta foi identificada, mas ainda não possui acesso
						a nenhum quadro.
					</Text>

					<Text style={styles.label}>E-mail</Text>

					<Text style={styles.value}>{user.email ?? "—"}</Text>

					<Text style={styles.label}>UID</Text>

					<Text style={styles.uid} selectable>
						{user.uid}
					</Text>

					<Pressable
						style={styles.secondaryButton}
						onPress={signOutUser}
					>
						<Text style={styles.secondaryButtonText}>Sair</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	/*
	 * Um ou mais quadros autorizados.
	 */
	return (
		<View style={styles.container}>
			<View style={styles.card}>
				<Text style={styles.title}>Escolha um quadro</Text>

				<Text style={styles.description}>
					Você tem permissão para enviar uma foto temporária para:
				</Text>

				{authorizedDevices.map((device) => (
					<View key={device.id} style={styles.device}>
						<View style={styles.deviceInfo}>
							<Text style={styles.deviceName}>{device.name}</Text>

							<Text style={styles.deviceId}>{device.id}</Text>
						</View>

						<Pressable
							style={styles.deviceButton}
							onPress={() => {
								console.log("Enviar para:", device.id);
							}}
						>
							<Text style={styles.deviceButtonText}>
								Enviar foto
							</Text>
						</Pressable>
					</View>
				))}

				<Pressable style={styles.secondaryButton} onPress={signOutUser}>
					<Text style={styles.secondaryButtonText}>Sair</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,

		backgroundColor: "#FBF7F3",

		alignItems: "center",
		justifyContent: "center",

		padding: 24,
	},

	card: {
		width: "100%",
		maxWidth: 520,

		backgroundColor: "#ffffff",

		borderRadius: 16,

		padding: 28,
	},

	title: {
		fontSize: 28,
		fontWeight: "700",

		color: "#222222",

		marginBottom: 12,
	},

	description: {
		fontSize: 16,
		lineHeight: 22,

		color: "#666666",

		marginBottom: 28,
	},

	label: {
		marginTop: 16,

		fontSize: 13,
		fontWeight: "600",

		color: "#777777",
	},

	value: {
		marginTop: 4,

		fontSize: 16,

		color: "#222222",
	},

	uid: {
		marginTop: 4,

		fontSize: 14,

		color: "#222222",
	},

	loadingText: {
		marginTop: 16,

		fontSize: 15,

		color: "#666666",
	},

	primaryButton: {
		backgroundColor: "#111111",

		borderRadius: 12,

		paddingVertical: 15,

		alignItems: "center",
	},

	primaryButtonText: {
		color: "#ffffff",

		fontSize: 16,
		fontWeight: "600",
	},

	secondaryButton: {
		marginTop: 32,

		borderWidth: 1,
		borderColor: "#cccccc",

		borderRadius: 12,

		paddingVertical: 14,

		alignItems: "center",
	},

	secondaryButtonText: {
		fontSize: 15,
		fontWeight: "600",

		color: "#333333",
	},

	device: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",

		gap: 16,

		paddingVertical: 16,

		borderBottomWidth: 1,
		borderBottomColor: "#eeeeee",
	},

	deviceInfo: {
		flex: 1,
	},

	deviceName: {
		fontSize: 16,
		fontWeight: "600",

		color: "#222222",
	},

	deviceId: {
		marginTop: 4,

		fontSize: 12,

		color: "#888888",
	},

	deviceButton: {
		backgroundColor: "#111111",

		borderRadius: 10,

		paddingHorizontal: 16,
		paddingVertical: 11,
	},

	deviceButtonText: {
		color: "#ffffff",

		fontSize: 14,
		fontWeight: "600",
	},
});
