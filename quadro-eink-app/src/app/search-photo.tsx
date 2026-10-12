import { useCallback, useEffect, useState } from "react";
import { File, Paths } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";

import {
	ActivityIndicator,
	Alert,
	Image,
	Linking,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import { Stack } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

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
	links: {
		html: string;
	};
	user: {
		name: string;
		links: {
			html: string;
		};
	};
};

type UnsplashSearchResponse = {
	results: UnsplashPhoto[];
	total: number;
	total_pages: number;
};

export default function SearchPhotoScreen() {
	const { deviceId, collectionId, mode } = useLocalSearchParams<{
		deviceId: string;
		collectionId?: string;
		mode?: "collection" | "temporary";
	}>();

	const [query, setQuery] = useState("Montanhas");
	const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);

	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const [selectingPhoto, setSelectingPhoto] = useState(false);

	const [searchLanguage, setSearchLanguage] = useState<"pt" | "en">("pt");

	const searchPhotos = useCallback(
		async (searchQuery: string, requestedPage = 1) => {
			if (!ACCESS_KEY) {
				Alert.alert(
					"Configuração necessária",
					"Adicione EXPO_PUBLIC_UNSPLASH_ACCESS_KEY ao arquivo .env.",
				);
				return;
			}

			if (!searchQuery.trim()) {
				Alert.alert("Busca vazia", "Digite o que deseja encontrar.");
				return;
			}

			const isFirstPage = requestedPage === 1;

			if (isFirstPage) {
				setLoading(true);
				setPhotos([]);
				setPage(1);
			} else {
				setLoadingMore(true);
			}

			try {
				const params = new URLSearchParams({
					query: searchQuery.trim(),
					page: String(requestedPage),
					per_page: String(PAGE_SIZE),
					orientation: "landscape",
					content_filter: "high",
					lang: searchLanguage,
				});

				const response = await fetch(
					`https://api.unsplash.com/search/photos?${params.toString()}`,
					{
						headers: {
							Authorization: `Client-ID ${ACCESS_KEY}`,
							"Accept-Version": "v1",
						},
					},
				);

				if (!response.ok) {
					throw new Error(
						`Unsplash API: ${response.status} ${response.statusText}`,
					);
				}

				const data = (await response.json()) as UnsplashSearchResponse;

				setPhotos((current) =>
					isFirstPage
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
			} catch (error) {
				console.error("Erro ao buscar fotos no Unsplash:", error);

				Alert.alert(
					"Erro na busca",
					"Não foi possível carregar as fotos. Verifique sua conexão, a chave da API e os limites de requisição.",
				);
			} finally {
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[searchLanguage],
	);

	useEffect(() => {
		searchPhotos("landscape");
	}, [searchPhotos]);

	const handleSearch = () => {
		searchPhotos(query, 1);
	};

	const handleLoadMore = () => {
		if (!loading && !loadingMore && photos.length < total) {
			searchPhotos(query, page + 1);
		}
	};

	const selectPhoto = async (photo: UnsplashPhoto) => {
		try {
			setSelectingPhoto(true);

			const fileName = `unsplash-${photo.id}.jpg`;
			const destination = new File(Paths.cache, fileName);

			await File.downloadFileAsync(photo.urls.full, destination);

			router.navigate({
				pathname: "/add-photo",
				params: {
					deviceId,
					...(collectionId ? { collectionId } : {}),
					mode: mode ?? "collection",
					selectedFileName: fileName,
					selectedWidth: String(photo.width),
					selectedHeight: String(photo.height),
				},
			});
		} catch (error) {
			console.error("Erro ao selecionar foto do Unsplash:", error);
			Alert.alert("Erro", "Não foi possível baixar esta foto.");
		} finally {
			setSelectingPhoto(false);
		}
	};

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<Screen scroll>
				<ScreenHeader title="Buscar fotos" showBackButton />

				<Card padding="md" style={styles.searchCard}>
					<Text style={styles.fieldLabel}>
						O que você quer encontrar?
					</Text>

					<View style={styles.searchRow}>
						<TextInput
							value={query}
							onChangeText={setQuery}
							onSubmitEditing={handleSearch}
							placeholder={
								searchLanguage === "pt"
									? "Ex.: montanhas, animais"
									: "Ex.: mountains, animals..."
							}
							placeholderTextColor={colors.textMuted}
							returnKeyType="search"
							autoCapitalize="none"
							autoCorrect={false}
							style={styles.searchInput}
						/>

						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Buscar fotos"
							onPress={handleSearch}
							disabled={loading}
							style={styles.searchButton}
						>
							<Ionicons
								name="search"
								size={22}
								color={colors.white}
							/>
						</Pressable>
					</View>

					<View style={styles.languageSelector}>
						<Pressable
							style={[
								styles.languageOption,
								searchLanguage === "pt" &&
									styles.languageOptionActive,
							]}
							onPress={() => setSearchLanguage("pt")}
							accessibilityRole="button"
							accessibilityState={{
								selected: searchLanguage === "pt",
							}}
						>
							<Text
								style={[
									styles.languageText,
									searchLanguage === "pt" &&
										styles.languageTextActive,
								]}
							>
								Português
							</Text>
						</Pressable>

						<Pressable
							style={[
								styles.languageOption,
								searchLanguage === "en" &&
									styles.languageOptionActive,
							]}
							onPress={() => setSearchLanguage("en")}
							accessibilityRole="button"
							accessibilityState={{
								selected: searchLanguage === "en",
							}}
						>
							<Text
								style={[
									styles.languageText,
									searchLanguage === "en" &&
										styles.languageTextActive,
								]}
							>
								English
							</Text>
						</Pressable>
					</View>

					<Text style={styles.hint}>
						As fotos são pesquisadas diretamente na API do Unsplash.
					</Text>
				</Card>

				<View style={styles.resultsHeader}>
					<Text style={styles.resultsTitle}>
						{hasSearched ? "Resultados" : "Fotos"}
					</Text>

					{hasSearched ? (
						<Text style={styles.resultsCount}>
							{photos.length} de {total.toLocaleString("pt-BR")}
						</Text>
					) : null}
				</View>

				{loading && photos.length === 0 ? (
					<View style={styles.loadingContainer}>
						<ActivityIndicator
							size="large"
							color={colors.primary}
						/>
						<Text style={styles.loadingText}>
							Buscando fotos...
						</Text>
					</View>
				) : photos.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Feather
							name="image"
							size={38}
							color={colors.textSecondary}
						/>

						<Text style={styles.emptyTitle}>
							Nenhuma foto encontrada
						</Text>

						<Text style={styles.emptyText}>
							Tente pesquisar por outro assunto.
						</Text>
					</View>
				) : (
					<View style={styles.photoGrid}>
						{photos.map((photo) => (
							<Pressable
								key={photo.id}
								style={styles.photoItem}
								onPress={() => selectPhoto(photo)}
								disabled={selectingPhoto}
								accessibilityRole="button"
								accessibilityLabel={
									photo.alt_description ??
									photo.description ??
									"Abrir foto"
								}
							>
								<Card padding="none" style={styles.photoCard}>
									<Image
										source={{ uri: photo.urls.small }}
										style={styles.photoImage}
										resizeMode="cover"
									/>
								</Card>
							</Pressable>
						))}
					</View>
				)}

				{photos.length > 0 && photos.length < total ? (
					<PrimaryButton
						title={
							loadingMore
								? "Carregando..."
								: "Carregar mais fotos"
						}
						onPress={handleLoadMore}
						disabled={loadingMore || loading}
						style={styles.loadMoreButton}
						leftIcon={
							loadingMore ? (
								<ActivityIndicator color={colors.white} />
							) : (
								<Ionicons
									name="add"
									size={23}
									color={colors.white}
								/>
							)
						}
					/>
				) : null}
			</Screen>
		</>
	);
}

const styles = StyleSheet.create({
	searchCard: {
		marginBottom: spacing.xl,
	},

	fieldLabel: {
		...typography.body,
		fontWeight: "600",
		color: colors.text,
		marginBottom: spacing.sm,
	},

	searchRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},

	searchInput: {
		flex: 1,
		minWidth: 0,
		height: 48,
		paddingHorizontal: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		color: colors.text,
		fontSize: 15,
	},

	searchButton: {
		width: 48,
		height: 48,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.md,
		backgroundColor: colors.primary,
	},

	hint: {
		...typography.caption,
		color: colors.textSecondary,
		marginTop: spacing.sm,
	},

	resultsHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: spacing.md,
	},

	resultsTitle: {
		...typography.sectionTitle,
		color: colors.text,
	},

	resultsCount: {
		...typography.caption,
		color: colors.textSecondary,
	},

	photoGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.md,
	},

	photoItem: {
		width: "48%",
		flexGrow: 0,
		flexShrink: 0,
	},

	photoCard: {
		overflow: "hidden",
	},

	photoImage: {
		width: "100%",
		aspectRatio: 1,
		backgroundColor: colors.surfaceMuted,
	},
	photoInfo: {
		padding: spacing.sm,
		gap: spacing.xs,
	},

	photoDescription: {
		...typography.body,
		fontSize: 13,
		color: colors.text,
	},

	photoAuthor: {
		...typography.caption,
		color: colors.textSecondary,
	},

	loadingContainer: {
		paddingVertical: 60,
		alignItems: "center",
		gap: spacing.md,
	},

	loadingText: {
		...typography.body,
		color: colors.textSecondary,
	},

	emptyContainer: {
		paddingVertical: 48,
		alignItems: "center",
		gap: spacing.sm,
	},

	emptyTitle: {
		...typography.emptyTitle,
		color: colors.text,
	},

	emptyText: {
		...typography.body,
		color: colors.textSecondary,
		textAlign: "center",
	},

	loadMoreButton: {
		marginTop: spacing.xl,
		marginBottom: spacing.xxl,
	},

	languageSelector: {
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.md,
	},

	languageOption: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: spacing.sm,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
	},

	languageOptionActive: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},

	languageText: {
		...typography.body,
		color: colors.text,
	},

	languageTextActive: {
		color: colors.white,
		fontWeight: "600",
	},
});
