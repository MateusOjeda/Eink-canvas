import { useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

import { FontAwesome } from "@expo/vector-icons";

import { signInWithGoogle } from "@/firebase/auth";

export default function LoginScreen() {
	const [isSigningIn, setIsSigningIn] = useState(false);

	const handleGoogleSignIn = async () => {
		if (isSigningIn) {
			return;
		}

		try {
			setIsSigningIn(true);

			await signInWithGoogle();
		} catch (error) {
			console.error("Erro ao entrar com Google:", error);

			Alert.alert("Não foi possível entrar", "Tente novamente.");
		} finally {
			setIsSigningIn(false);
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<Text style={styles.title}>Quadro E-ink</Text>

				<Text style={styles.subtitle}>
					Entre para administrar seus quadros.
				</Text>

				<Pressable
					style={({ pressed }) => [
						styles.googleButton,
						pressed && styles.googleButtonPressed,
					]}
					onPress={handleGoogleSignIn}
					disabled={isSigningIn}
				>
					{isSigningIn ? (
						<ActivityIndicator />
					) : (
						<>
							<FontAwesome
								name="google"
								size={20}
								color="#222222"
							/>

							<Text style={styles.googleButtonText}>
								Entrar com Google
							</Text>
						</>
					)}
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#FBF7F3",
		justifyContent: "center",
		paddingHorizontal: 32,
	},

	content: {
		gap: 16,
	},

	title: {
		fontSize: 32,
		fontWeight: "700",
		color: "#222222",
	},

	subtitle: {
		fontSize: 16,
		color: "#666666",
		marginBottom: 24,
	},

	googleButton: {
		height: 54,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#D8D2CD",
		backgroundColor: "#FFFFFF",

		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",

		gap: 12,
	},

	googleButtonPressed: {
		opacity: 0.7,
	},

	googleButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#222222",
	},
});
