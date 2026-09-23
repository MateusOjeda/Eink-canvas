import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { router, useLocalSearchParams } from "expo-router";

import { Paths } from "expo-file-system";

export default function PreviewPhotoScreen() {
	const params = useLocalSearchParams<{
		fileName: string;
		imageWidth: string;
		imageHeight: string;
	}>();

	const uri = Paths.join(Paths.cache, params.fileName);

	const imageWidth = Number(params.imageWidth);

	const imageHeight = Number(params.imageHeight);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Prévia Spectra 6</Text>

			<Text style={styles.resolution}>
				{imageWidth} × {imageHeight}
			</Text>

			<View style={styles.previewContainer}>
				<Image
					source={{ uri }}
					style={[
						styles.image,
						{
							aspectRatio: imageWidth / imageHeight,
						},
					]}
					resizeMode="contain"
				/>
			</View>

			<Text style={styles.hint}>
				Esta é a imagem já convertida para as cores da tela.
			</Text>

			<Pressable
				style={styles.secondaryButton}
				onPress={() => router.back()}
			>
				<Text style={styles.secondaryButtonText}>Voltar e ajustar</Text>
			</Pressable>

			<Pressable
				style={styles.primaryButton}
				onPress={() => {
					console.log("Usar imagem:", params.fileName);
				}}
			>
				<Text style={styles.primaryButtonText}>Usar imagem</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#ffffff",
		padding: 24,
	},

	title: {
		fontSize: 22,
		fontWeight: "600",
		textAlign: "center",
	},

	resolution: {
		marginTop: 6,
		fontSize: 14,
		color: "#666666",
		textAlign: "center",
	},

	previewContainer: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},

	image: {
		width: "100%",
		maxHeight: "100%",
	},

	hint: {
		fontSize: 14,
		color: "#666666",
		textAlign: "center",
		marginBottom: 20,
	},

	secondaryButton: {
		paddingVertical: 16,
		borderWidth: 1,
		borderColor: "#111111",
		borderRadius: 12,
		alignItems: "center",
		marginBottom: 10,
	},

	secondaryButtonText: {
		color: "#111111",
		fontSize: 16,
		fontWeight: "600",
	},

	primaryButton: {
		paddingVertical: 16,
		backgroundColor: "#111111",
		borderRadius: 12,
		alignItems: "center",
	},

	primaryButtonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
});
