import { useCallback, useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
	ActivityIndicator,
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
	useWindowDimensions,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

import { useSendPhotoFlow } from "../../../contexts/SendPhotoFlowContext";

const ACCESS_KEY = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY;
const PAGE_SIZE = 10;

type UnsplashPhoto = {
	id: string;
	width: number;
	height: number;
	alt_description: string | null;
	description: string | null;
	urls: {
		regular: string;
		small: string;
		full: string;
	};
};

type UnsplashResponse = {
	results: UnsplashPhoto[];
	total: number;
};

export default function SearchPhotoScreen() {
	const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
	const { width } = useWindowDimensions();
	const compact = width < 600;

	const {
		device,
		deviceLoading,
		deviceError,
		setSelectedImage,
		setProcessedPhoto,
		setSendError,
	} = useSendPhotoFlow();

	const [query, setQuery] = useState("Montanhas");
	const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const [selectingId, setSelectingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const orientation = device?.orientation ?? "landscape";

	const searchPhotos = useCallback(
		async (term: string, requestedPage = 1) => {
			if (!ACCESS_KEY) {
				setError(
					"Chave do Unsplash não configurada. Verifique EXPO_PUBLIC_UNSPLASH_ACCESS_KEY no .env do web app.",
				);
				return;
			}

			if (!term.trim()) {
				setError("Digite o que deseja encontrar.");
				return;
			}

			const firstPage = requestedPage === 1;

			if (firstPage) {
				setLoading(true);
				setPhotos([]);
				setPage(1);
				setError(null);
			} else {
				setLoadingMore(true);
			}

			try {
				const params = new URLSearchParams({
					query: term.trim(),
					page: String(requestedPage),
					per_page: String(PAGE_SIZE),
					orientation,
					content_filter: "high",
					lang: "pt",
				});

				const response = await fetch(
					`https://api.unsplash.com/search/photos?${params}`,
					{
						headers: {
							Authorization: `Client-ID ${ACCESS_KEY}`,
							"Accept-Version": "v1",
						},
					},
				);

				if (!response.ok) {
					throw new Error(`Unsplash: ${response.status}`);
				}

				const data = (await response.json()) as UnsplashResponse;

				setPhotos((current) =>
					firstPage
						? data.results
						: [
								...current,
								...data.results.filter(
									(photo) =>
										!current.some(
											(item) => item.id === photo.id,
										),
								),
							],
				);
				setTotal(data.total);
				setPage(requestedPage);
				setHasSearched(true);
			} catch (err) {
				console.error("Erro na busca do Unsplash:", err);
				setError(
					"Não foi possível carregar as fotos. Verifique a conexão, a chave da API e os limites de requisição.",
				);
			} finally {
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[orientation],
	);

	useEffect(() => {
		void searchPhotos("Montanhas", 1);
	}, [searchPhotos]);

	const handleSearch = () => {
		void searchPhotos(query, 1);
	};

	const handleLoadMore = () => {
		if (!loading && !loadingMore && photos.length < total) {
			void searchPhotos(query, page + 1);
		}
	};

	const selectPhoto = async (photo: UnsplashPhoto) => {
		try {
			setSelectingId(photo.id);
			setError(null);

			// Baixa a imagem e cria um URI local temporário para o recorte.
			const response = await fetch(photo.urls.full);
			if (!response.ok) {
				throw new Error(`Falha ao baixar imagem: ${response.status}`);
			}

			const blob = await response.blob();
			const uri = URL.createObjectURL(blob);

			setSelectedImage({
				uri,
				width: photo.width,
				height: photo.height,
			});
			setProcessedPhoto(null);
			setSendError(null);

			router.push({
				pathname: "/send-photo/[deviceId]/crop",
				params: { deviceId: deviceId ?? device?.id ?? "" },
			});
		} catch (err) {
			console.error("Erro ao selecionar foto:", err);
			setError("Não foi possível baixar esta foto. Tente outra.");
		} finally {
			setSelectingId(null);
		}
	};

	if (deviceLoading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator size="large" color="#668882" />
			</View>
		);
	}

	if (!device || deviceError) {
		return (
			<View style={styles.center}>
				<Text style={styles.errorText}>
					{deviceError ?? "Quadro não encontrado."}
				</Text>
				<Pressable onPress={() => router.replace("/")}>
					<Text style={styles.backLink}>Voltar</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<ScrollView
			style={styles.screen}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<View style={styles.header}>
				<Pressable
					onPress={() => router.back()}
					hitSlop={10}
					style={styles.backButton}
					accessibilityRole="button"
					accessibilityLabel="Voltar"
				>
					<Feather name="arrow-left" size={23} color="#4A4F54" />
				</Pressable>
				<View style={styles.headerText}>
					<Text style={styles.title}>Buscar fotos</Text>
					<Text style={styles.subtitle}>
						Encontre uma imagem para {device.name}
					</Text>
				</View>
			</View>

			<View style={styles.searchCard}>
				<Text style={styles.label}>O que você quer encontrar?</Text>

				<View style={styles.searchRow}>
					<TextInput
						value={query}
						onChangeText={setQuery}
						onSubmitEditing={handleSearch}
						placeholder="Ex.: Montanhas, Animais, Pinturas"
						placeholderTextColor="#888888"
						returnKeyType="search"
						autoCapitalize="sentences"
						autoCorrect={false}
						style={styles.input}
					/>
					<Pressable
						onPress={handleSearch}
						disabled={loading}
						style={({ pressed }) => [
							styles.searchButton,
							pressed && styles.pressed,
							loading && styles.disabled,
						]}
						accessibilityRole="button"
						accessibilityLabel="Buscar fotos"
					>
						<Ionicons name="search" size={22} color="#FFFFFF" />
					</Pressable>
				</View>
			</View>

			<View style={styles.resultsHeader}>
				<Text style={styles.resultsTitle}>
					{hasSearched ? "Resultados" : "Fotos"}
				</Text>
				{hasSearched && (
					<Text style={styles.count}>
						{photos.length} de {total.toLocaleString("pt-BR")}
					</Text>
				)}
			</View>

			{loading && photos.length === 0 ? (
				<View style={styles.stateContainer}>
					<ActivityIndicator size="large" color="#668882" />
					<Text style={styles.stateText}>Buscando fotos...</Text>
				</View>
			) : photos.length === 0 ? (
				<View style={styles.stateContainer}>
					<Feather name="image" size={38} color="#777F88" />
					<Text style={styles.emptyTitle}>
						Nenhuma foto encontrada
					</Text>
					<Text style={styles.stateText}>
						Tente pesquisar por outro assunto.
					</Text>
				</View>
			) : (
				<View style={styles.grid}>
					{photos.map((photo) => (
						<Pressable
							key={photo.id}
							style={[
								styles.photoItem,
								compact
									? styles.photoItemCompact
									: styles.photoItemWide,
							]}
							onPress={() => void selectPhoto(photo)}
							disabled={selectingId !== null}
							accessibilityRole="button"
							accessibilityLabel={
								photo.alt_description ??
								photo.description ??
								"Selecionar foto"
							}
						>
							<View style={styles.photoCard}>
								<Image
									source={{ uri: photo.urls.small }}
									style={styles.photoImage}
									resizeMode="cover"
								/>
								{selectingId === photo.id && (
									<View style={styles.imageLoading}>
										<ActivityIndicator
											size="large"
											color="#FFFFFF"
										/>
									</View>
								)}
							</View>
						</Pressable>
					))}
				</View>
			)}

			{photos.length > 0 && photos.length < total && (
				<Pressable
					onPress={handleLoadMore}
					disabled={loadingMore || loading}
					style={({ pressed }) => [
						styles.moreButton,
						pressed && styles.pressed,
						(loadingMore || loading) && styles.disabled,
					]}
				>
					{loadingMore ? (
						<ActivityIndicator color="#FFFFFF" />
					) : (
						<Ionicons name="add" size={22} color="#FFFFFF" />
					)}
					<Text style={styles.moreButtonText}>
						{loadingMore ? "Carregando..." : "Carregar mais fotos"}
					</Text>
				</Pressable>
			)}

			<Text style={styles.attribution}>
				Fotos fornecidas pelo Unsplash.
			</Text>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: "#FAF9F7",
	},
	content: {
		width: "100%",
		maxWidth: 1000,
		alignSelf: "center",
		padding: 20,
		paddingBottom: 40,
	},
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
		backgroundColor: "#FAF9F7",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 20,
		gap: 12,
	},
	backButton: {
		width: 36,
		height: 40,
		justifyContent: "center",
	},
	headerText: {
		flex: 1,
	},
	title: {
		fontSize: 28,
		lineHeight: 34,
		fontWeight: "700",
		color: "#1A1A1A",
	},
	subtitle: {
		marginTop: 3,
		fontSize: 15,
		color: "#666666",
	},
	searchCard: {
		padding: 18,
		backgroundColor: "#FFFFFF",
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "#EEEEEE",
		marginBottom: 24,
	},
	label: {
		fontSize: 15,
		fontWeight: "600",
		color: "#333333",
		marginBottom: 10,
	},
	searchRow: {
		flexDirection: "row",
		gap: 8,
	},
	input: {
		flex: 1,
		minWidth: 0,
		height: 48,
		paddingHorizontal: 14,
		borderWidth: 1,
		borderColor: "#DDDDDD",
		borderRadius: 10,
		color: "#222222",
		fontSize: 15,
	},
	searchButton: {
		width: 48,
		height: 48,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#668882",
	},
	hint: {
		marginTop: 10,
		fontSize: 13,
		lineHeight: 19,
		color: "#777777",
	},
	resultsHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 14,
	},
	resultsTitle: {
		fontSize: 20,
		fontWeight: "700",
		color: "#222222",
	},
	count: {
		fontSize: 13,
		color: "#777777",
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
	},
	photoItem: {
		overflow: "hidden",
	},
	photoItemCompact: {
		width: "48%",
	},
	photoItemWide: {
		width: "31%",
	},
	photoCard: {
		position: "relative",
		overflow: "hidden",
		borderRadius: 12,
		backgroundColor: "#EEEEEE",
	},
	photoImage: {
		width: "100%",
		aspectRatio: 1,
	},
	imageLoading: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#00000066",
	},
	stateContainer: {
		paddingVertical: 48,
		alignItems: "center",
		gap: 12,
	},
	stateText: {
		fontSize: 15,
		lineHeight: 21,
		color: "#777777",
		textAlign: "center",
	},
	emptyTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#555555",
	},
	errorText: {
		marginBottom: 12,
		color: "#B42318",
		fontSize: 14,
		lineHeight: 20,
	},
	backLink: {
		marginTop: 12,
		color: "#4E6863",
		fontWeight: "600",
	},
	moreButton: {
		marginTop: 24,
		minHeight: 48,
		paddingHorizontal: 16,
		borderRadius: 12,
		backgroundColor: "#668882",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
	},
	moreButtonText: {
		fontSize: 15,
		fontWeight: "600",
		color: "#FFFFFF",
	},
	attribution: {
		marginTop: 24,
		textAlign: "center",
		fontSize: 12,
		color: "#888888",
	},
	pressed: {
		opacity: 0.8,
	},
	disabled: {
		opacity: 0.6,
	},
});
