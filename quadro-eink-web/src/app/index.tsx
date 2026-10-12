import { useCallback, useEffect, useState } from "react";

import {
	ActivityIndicator,
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";

import { router } from "expo-router";

import { Feather } from "@expo/vector-icons";

import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "../firebase/config";

import { signInWithGoogle, signOutUser } from "../firebase/auth";

import {
	getAuthorizedDevices,
	type AuthorizedDevice,
} from "../firebase/permissions";

import {
	getTemporaryPhotoHistory,
	type TemporaryPhotoHistoryItem,
	type TemporaryPhotoHistoryPage,
} from "../firebase/photos";

function TemporaryPhotoHistory({ deviceId }: { deviceId: string }) {
	const [expanded, setExpanded] = useState(false);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState(false);
	const [items, setItems] = useState<TemporaryPhotoHistoryItem[]>([]);
	const [lastDoc, setLastDoc] =
		useState<TemporaryPhotoHistoryPage["lastDoc"]>(null);
	const [hasMore, setHasMore] = useState(false);

	const loadPage = async (more = false) => {
		if (loading || loadingMore) return;
		if (more && (!hasMore || !lastDoc)) return;

		setError(false);

		if (more) {
			setLoadingMore(true);
		} else {
			setLoading(true);
		}

		try {
			const page = await getTemporaryPhotoHistory(
				deviceId,
				more ? lastDoc : null,
			);

			setItems((previous) =>
				more ? [...previous, ...page.items] : page.items,
			);
			setLastDoc(page.lastDoc);
			setHasMore(page.hasMore);
			setLoaded(true);
		} catch (err) {
			console.error("Erro ao carregar histórico de fotos:", err);
			setError(true);
		} finally {
			setLoading(false);
			setLoadingMore(false);
		}
	};

	const toggle = () => {
		const next = !expanded;
		setExpanded(next);

		if (next && !loaded) {
			void loadPage();
		}
	};

	const formatDate = (date: Date | null) => {
		if (!date) return "Data indisponível";

		return date.toLocaleString("pt-BR", {
			dateStyle: "short",
			timeStyle: "short",
		});
	};

	const formatDuration = (minutes: number) => {
		if (minutes >= 60 && minutes % 60 === 0) {
			return `${minutes / 60} h`;
		}

		return `${minutes} min`;
	};

	return (
		<View style={historyStyles.container}>
			<Pressable
				style={({ pressed }) => [
					historyStyles.toggle,
					pressed && historyStyles.pressed,
				]}
				onPress={toggle}
			>
				<Text style={historyStyles.toggleText}>Ver histórico</Text>
				<Feather
					name={expanded ? "chevron-up" : "chevron-down"}
					size={19}
					color="#668882"
				/>
			</Pressable>

			{expanded && (
				<View style={historyStyles.panel}>
					{loading ? (
						<ActivityIndicator size="small" color="#668882" />
					) : error ? (
						<View>
							<Text style={historyStyles.message}>
								Não foi possível carregar o histórico.
							</Text>
							<Pressable onPress={() => void loadPage()}>
								<Text style={historyStyles.action}>
									Tentar novamente
								</Text>
							</Pressable>
						</View>
					) : items.length === 0 ? (
						<Text style={historyStyles.message}>
							Você ainda não enviou fotos temporárias para este
							quadro.
						</Text>
					) : (
						<>
							<ScrollView
								style={historyStyles.list}
								contentContainerStyle={
									historyStyles.listContent
								}
								nestedScrollEnabled
							>
								{items.map((item) => (
									<View
										key={item.id}
										style={historyStyles.item}
									>
										{item.previewUrl ? (
											<Image
												source={{
													uri: item.previewUrl,
												}}
												style={historyStyles.image}
												resizeMode="contain"
											/>
										) : (
											<View
												style={[
													historyStyles.image,
													historyStyles.imageFallback,
												]}
											>
												<Feather
													name="image"
													size={23}
													color="#9AA6A3"
												/>
											</View>
										)}

										<View style={historyStyles.details}>
											<Text style={historyStyles.date}>
												{formatDate(item.createdAt)}
											</Text>
											<Text
												style={historyStyles.duration}
											>
												Duração:{" "}
												{formatDuration(
													item.durationMinutes,
												)}
											</Text>
										</View>
									</View>
								))}
							</ScrollView>

							{hasMore && (
								<Pressable
									style={historyStyles.moreButton}
									disabled={loadingMore}
									onPress={() => void loadPage(true)}
								>
									{loadingMore ? (
										<ActivityIndicator
											size="small"
											color="#668882"
										/>
									) : (
										<Text style={historyStyles.action}>
											Mostrar mais
										</Text>
									)}
								</Pressable>
							)}
						</>
					)}
				</View>
			)}
		</View>
	);
}

const historyStyles = StyleSheet.create({
	container: {
		width: "100%",
		marginTop: 10,
		borderTopWidth: 1,
		borderTopColor: "#E9ECEA",
	},
	toggle: {
		minHeight: 42,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 7,
	},
	toggleText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#668882",
	},
	pressed: {
		opacity: 0.7,
	},
	panel: {
		maxHeight: 260,
		paddingTop: 6,
		paddingBottom: 12,
	},
	list: {
		flexShrink: 1,
		minHeight: 0,
	},
	listContent: {
		gap: 10,
		paddingBottom: 8,
	},
	item: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		padding: 9,
		borderWidth: 1,
		borderColor: "#E9ECEA",
		borderRadius: 12,
	},
	image: {
		width: 66,
		height: 66,
		borderRadius: 8,
		backgroundColor: "#F4F5F4",
	},
	imageFallback: {
		alignItems: "center",
		justifyContent: "center",
	},
	details: {
		flex: 1,
		gap: 6,
	},
	date: {
		fontSize: 13,
		fontWeight: "600",
		color: "#333333",
	},
	duration: {
		fontSize: 12,
		color: "#777777",
	},
	message: {
		paddingVertical: 12,
		fontSize: 13,
		lineHeight: 19,
		color: "#777777",
		textAlign: "center",
	},
	action: {
		fontSize: 14,
		fontWeight: "600",
		color: "#668882",
		textAlign: "center",
		paddingTop: 10,
	},
	moreButton: {
		minHeight: 38,
		alignItems: "center",
		justifyContent: "center",
	},
});

const DEVICE_IMAGES = [
	require("../../assets/placeholders/home-device-1.png"),
	require("../../assets/placeholders/home-device-2.png"),
	require("../../assets/placeholders/home-device-3.png"),
];

export default function HomeScreen() {
	const { width } = useWindowDimensions();

	const compact = width < 420;

	const [user, setUser] = useState<User | null>(null);

	const [loading, setLoading] = useState(true);

	const [signingIn, setSigningIn] = useState(false);

	const [checkingPermission, setCheckingPermission] = useState(false);

	const [refreshing, setRefreshing] = useState(false);

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

	const loadPermissions = useCallback(
		async (isRefresh = false) => {
			if (!user) {
				return;
			}

			try {
				if (isRefresh) {
					setRefreshing(true);
				} else {
					setCheckingPermission(true);
				}

				setPermissionError(false);

				const devices = await getAuthorizedDevices(user.uid);

				setAuthorizedDevices(devices);
			} catch (error) {
				console.error("Erro ao carregar autorizações:", error);

				setPermissionError(true);
			} finally {
				if (isRefresh) {
					setRefreshing(false);
				} else {
					setCheckingPermission(false);
				}
			}
		},
		[user],
	);

	useEffect(() => {
		if (!user) {
			setAuthorizedDevices(null);
			setPermissionError(false);
			return;
		}

		loadPermissions();
	}, [user, loadPermissions]);

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
			<View style={styles.centerContainer}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!user) {
		return (
			<View style={styles.centerContainer}>
				<View style={styles.authCard}>
					<View style={styles.authImageContainer}>
						<Image
							source={require("../../assets/placeholders/login-icon.png")}
							style={styles.authImage}
							resizeMode="contain"
						/>
					</View>

					<Text style={styles.authTitle}>Quadro E-ink</Text>

					<Text style={styles.authDescription}>
						Entre com sua conta Google para acessar seus quadros e
						imprimir fotos.
					</Text>

					<Pressable
						style={({ pressed }) => [
							styles.authButton,
							pressed && !signingIn && styles.authButtonPressed,
							signingIn && styles.authButtonDisabled,
						]}
						onPress={handleSignIn}
						disabled={signingIn}
					>
						{signingIn ? (
							<ActivityIndicator color="#FFFFFF" />
						) : (
							<>
								<Feather
									name="log-in"
									size={19}
									color="#FFFFFF"
								/>

								<Text style={styles.authButtonText}>
									Entrar com Google
								</Text>
							</>
						)}
					</Pressable>
				</View>
			</View>
		);
	}

	if (checkingPermission || authorizedDevices === null) {
		return (
			<View style={styles.centerContainer}>
				<ActivityIndicator size="large" />

				<Text style={styles.loadingText}>
					Verificando autorização...
				</Text>
			</View>
		);
	}

	if (permissionError) {
		return (
			<View style={styles.centerContainer}>
				<View style={styles.card}>
					<Text style={styles.title}>Erro</Text>

					<Text style={styles.description}>
						Não foi possível verificar suas autorizações.
					</Text>

					<View style={styles.inlineButtons}>
						<Pressable
							style={styles.inlineSecondaryButton}
							onPress={() => loadPermissions(true)}
						>
							{refreshing ? (
								<ActivityIndicator size="small" />
							) : (
								<Text style={styles.inlineSecondaryButtonText}>
									Tentar de novo
								</Text>
							)}
						</Pressable>

						<Pressable
							style={styles.inlineSecondaryButton}
							onPress={signOutUser}
						>
							<Text style={styles.inlineSecondaryButtonText}>
								Sair
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		);
	}

	if (authorizedDevices.length === 0) {
		return (
			<View style={styles.centerContainer}>
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

					<View style={styles.inlineButtons}>
						<Pressable
							style={styles.inlineSecondaryButton}
							onPress={() => loadPermissions(true)}
						>
							{refreshing ? (
								<ActivityIndicator size="small" />
							) : (
								<Text style={styles.inlineSecondaryButtonText}>
									Atualizar
								</Text>
							)}
						</Pressable>

						<Pressable
							style={styles.inlineSecondaryButton}
							onPress={signOutUser}
						>
							<Text style={styles.inlineSecondaryButtonText}>
								Sair
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		);
	}

	return (
		<ScrollView
			style={styles.screen}
			contentContainerStyle={[
				styles.screenContent,
				compact && styles.screenContentCompact,
			]}
		>
			<View style={[styles.card, compact && styles.cardCompact]}>
				<View style={styles.headerRow}>
					<Text
						style={[styles.title, compact && styles.titleCompact]}
						numberOfLines={1}
					>
						Escolha um quadro
					</Text>

					{/* <Pressable
						style={({ pressed }) => [
							styles.headerActionButton,
							pressed && styles.pressed,
						]}
						onPress={() => loadPermissions(true)}
						disabled={refreshing}
					>
						{refreshing ? (
							<ActivityIndicator size="small" color="#5E9188" />
						) : (
							<Feather
								name="refresh-cw"
								size={21}
								color="#5E9188"
							/>
						)}
					</Pressable> */}
				</View>

				<Text style={styles.description}>
					Você tem permissão para imprimir uma foto agendada em:
				</Text>

				<View style={styles.deviceList}>
					{authorizedDevices.map((device, index) => (
						<View
							key={device.id}
							style={[
								styles.deviceCard,
								compact && styles.deviceCardCompact,
							]}
						>
							<View style={styles.deviceMain}>
								<View
									style={[
										styles.deviceThumbnail,
										compact &&
											styles.deviceThumbnailCompact,
									]}
								>
									<Image
										source={
											DEVICE_IMAGES[
												index % DEVICE_IMAGES.length
											]
										}
										style={styles.deviceImage}
										resizeMode="cover"
									/>
								</View>

								<View style={styles.deviceInfo}>
									<Text style={styles.deviceName}>
										{device.name}
									</Text>

									<Text style={styles.deviceId} selectable>
										{device.id}
									</Text>
								</View>
							</View>

							<Pressable
								style={({ pressed }) => [
									styles.deviceButton,
									pressed && styles.deviceButtonPressed,
								]}
								onPress={() => {
									router.push({
										pathname: "/send-photo/[deviceId]",
										params: { deviceId: device.id },
									});
								}}
							>
								<Feather
									name="image"
									size={18}
									color="#FFFFFF"
								/>
								<Text style={styles.deviceButtonText}>
									Imprimir foto
								</Text>
							</Pressable>

							<TemporaryPhotoHistory deviceId={device.id} />
						</View>
					))}
				</View>

				<View style={styles.footer}>
					<View style={styles.footerDivider} />

					<Pressable
						style={({ pressed }) => [
							styles.logoutButton,
							pressed && styles.pressed,
						]}
						onPress={signOutUser}
					>
						<Feather name="log-out" size={20} color="#717780" />

						<Text style={styles.logoutButtonText}>Sair</Text>
					</Pressable>
				</View>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: "#FAF9F7",
	},

	screenContent: {
		flexGrow: 1,
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 24,
	},

	screenContentCompact: {
		paddingHorizontal: 14,
		paddingVertical: 18,
	},

	centerContainer: {
		flex: 1,
		backgroundColor: "#FAF9F7",
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},

	card: {
		flex: 1,
		width: "100%",
		maxWidth: 720,
		backgroundColor: "#FFFFFF",
		borderRadius: 24,
		paddingHorizontal: 32,
		paddingTop: 36,
		paddingBottom: 24,

		shadowColor: "#000000",
		shadowOffset: {
			width: 0,
			height: 8,
		},
		shadowOpacity: 0.04,
		shadowRadius: 24,

		elevation: 2,
	},

	cardCompact: {
		borderRadius: 20,
		paddingHorizontal: 18,
		paddingTop: 26,
		paddingBottom: 18,
	},

	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},

	title: {
		flexShrink: 1,
		fontSize: 34,
		lineHeight: 40,
		fontWeight: "700",
		color: "#171A21",
	},

	titleCompact: {
		fontSize: 25,
		lineHeight: 31,
	},

	description: {
		maxWidth: 560,
		marginTop: 14,
		marginBottom: 30,
		fontSize: 18,
		lineHeight: 27,
		color: "#687080",
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

	pressed: {
		opacity: 0.72,
	},

	headerActionButton: {
		width: 44,
		height: 44,
		flexShrink: 0,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#D9DEDC",
		backgroundColor: "#FFFFFF",
		alignItems: "center",
		justifyContent: "center",
	},

	primaryButton: {
		backgroundColor: "#5E9188",
		borderRadius: 12,
		paddingVertical: 15,
		paddingHorizontal: 24,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 50,
	},

	primaryButtonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
	},

	secondaryButton: {
		marginTop: 18,
		borderWidth: 1,
		borderColor: "#D7DAD9",
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: "center",
	},

	secondaryButtonText: {
		fontSize: 15,
		fontWeight: "600",
		color: "#444B52",
	},

	inlineButtons: {
		flexDirection: "row",
		gap: 12,
		marginTop: 24,
	},

	inlineSecondaryButton: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#D7DAD9",
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 48,
	},

	inlineSecondaryButtonText: {
		fontSize: 15,
		fontWeight: "600",
		color: "#444B52",
	},

	deviceList: {
		gap: 16,
	},

	deviceCard: {
		borderWidth: 1,
		borderColor: "#E4E7E5",
		borderRadius: 18,
		backgroundColor: "#FFFFFF",
		padding: 16,
		gap: 14,
		shadowColor: "#000000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.025,
		shadowRadius: 12,
		elevation: 1,
	},

	deviceCardCompact: {
		borderRadius: 16,
		padding: 12,
		gap: 12,
	},

	deviceMain: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},

	deviceThumbnail: {
		width: 104,
		height: 110,
		borderRadius: 14,
		backgroundColor: "#F3F5F4",
		overflow: "hidden",
	},

	deviceThumbnailCompact: {
		width: 72,
		height: 92,
		borderRadius: 12,
	},

	deviceImage: {
		width: "100%",
		height: "100%",
	},
	deviceInfo: {
		flex: 1,
		minWidth: 0,
	},

	deviceName: {
		fontSize: 17,
		lineHeight: 23,
		fontWeight: "700",
		color: "#171A21",
	},

	deviceId: {
		marginTop: 5,
		fontSize: 12,
		lineHeight: 17,
		color: "#747C89",
		overflow: "hidden",
	},

	deviceButton: {
		width: "100%",
		minHeight: 46,
		paddingHorizontal: 14,
		borderRadius: 12,
		backgroundColor: "#668882",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 9,
	},

	deviceButtonCompact: {
		minHeight: 46,
		paddingHorizontal: 14,
	},

	deviceButtonPressed: {
		backgroundColor: "#4e6863",
	},

	deviceButtonText: {
		color: "#FFFFFF",
		fontSize: 15,
		fontWeight: "600",
	},

	footer: {
		marginTop: "auto",
		paddingTop: 28,
	},

	footerDivider: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: "#E4E6E5",
		marginBottom: 12,
	},

	logoutButton: {
		alignSelf: "center",
		minHeight: 36,
		paddingHorizontal: 14,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 9,
	},

	logoutButtonText: {
		fontSize: 16,
		fontWeight: "500",
		color: "#717780",
	},

	authCard: {
		width: "100%",
		maxWidth: 460,

		paddingHorizontal: 28,
		paddingVertical: 36,

		backgroundColor: "#FFFFFF",

		borderRadius: 24,

		alignItems: "center",

		shadowColor: "#000000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.06,
		shadowRadius: 8,

		elevation: 2,
	},

	authIcon: {
		width: 72,
		height: 72,

		borderRadius: 36,

		backgroundColor: "#EDF2F1",

		alignItems: "center",
		justifyContent: "center",

		marginBottom: 20,
	},

	authTitle: {
		fontSize: 28,
		lineHeight: 34,
		fontWeight: "700",

		color: "#1A1A1A",

		textAlign: "center",
	},

	authDescription: {
		maxWidth: 340,

		marginTop: 8,
		marginBottom: 28,

		fontSize: 15,
		lineHeight: 21,

		color: "#666666",

		textAlign: "center",
	},

	authButton: {
		width: "100%",
		minHeight: 48,

		paddingHorizontal: 16,
		paddingVertical: 12,

		borderRadius: 12,

		backgroundColor: "#668882",

		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",

		gap: 10,
	},

	authButtonPressed: {
		backgroundColor: "#4e6863",
	},

	authButtonDisabled: {
		opacity: 0.5,
	},

	authButtonText: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: "600",

		color: "#FFFFFF",
	},

	authImageContainer: {
		width: 110,
		height: 110,

		marginBottom: 20,

		alignItems: "center",
		justifyContent: "center",
	},

	authImage: {
		width: "100%",
		height: "100%",
	},
});
