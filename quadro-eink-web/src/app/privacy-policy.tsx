import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const sections = [
	{
		title: "1. Introduction",
		content:
			"EinkCanvas is an application designed to help users manage and display images on compatible electronic ink (e-ink) devices. This Privacy Policy explains how information is handled when you use the application and its related services.",
	},
	{
		title: "2. Information We Process",
		content:
			"Depending on the features you use, EinkCanvas may process authentication identifiers, device identifiers, device configuration data, images and collections you upload or select, image metadata, synchronization status, and technical information needed to operate and troubleshoot the application.",
	},
	{
		title: "3. How Information Is Used",
		content:
			"Information is used to provide application features, store and organize images, synchronize images and settings with compatible e-ink devices, authenticate users, associate devices with their configurations, and maintain the reliability and security of the application.",
	},
	{
		title: "4. Third-Party Services",
		content:
			"EinkCanvas uses Firebase services provided by Google to support application functionality. Depending on the feature, these services may include authentication, database storage, and image storage. These services process information according to their applicable terms and privacy policies.",
	},
	{
		title: "5. Data Sharing",
		content:
			"EinkCanvas does not sell users' personal information. Information may be processed by service providers when necessary to operate the application, provide requested features, maintain security, or comply with applicable legal obligations.",
	},
	{
		title: "6. Data Retention and Deletion",
		content:
			"Information is retained for as long as necessary to provide the application's functionality and fulfill operational requirements. Users may contact the developer to request assistance with deleting their information. Some information may remain in backups or be retained when required by law.",
	},
	{
		title: "7. Data Security",
		content:
			"Reasonable measures are used to protect information processed by the application. However, no method of electronic storage or transmission can guarantee absolute security.",
	},
	{
		title: "8. Children's Privacy",
		content:
			"EinkCanvas is not specifically directed at children under the age of 13 and does not intentionally collect personal information from children under 13 as a specific feature. Please contact the developer if you believe a child has provided personal information through the application.",
	},
	{
		title: "9. Changes to This Policy",
		content:
			"This Privacy Policy may be updated as the application evolves. The latest version will be made available at this public URL.",
	},
	{
		title: "10. Contact",
		content:
			"For questions, privacy requests, or concerns regarding this Privacy Policy, please contact the developer through the EinkCanvas project repository:",
		link: "https://github.com/MateusOjeda/Eink-canvas",
	},
];

export default function PrivacyPolicyScreen() {
	return (
		<>
			<Stack.Screen
				options={{
					title: "Privacy Policy | EinkCanvas",
				}}
			/>

			<ScrollView
				style={styles.screen}
				contentContainerStyle={styles.container}
			>
				<View style={styles.content}>
					<Text style={styles.brand}>EinkCanvas</Text>

					<Text style={styles.title}>Privacy Policy</Text>

					<Text style={styles.updated}>
						Last updated: October 11, 2026
					</Text>

					<Text style={styles.intro}>
						Your privacy matters. This policy explains how
						EinkCanvas handles information when you use the
						application.
					</Text>

					{sections.map((section) => (
						<View key={section.title} style={styles.section}>
							<Text style={styles.sectionTitle}>
								{section.title}
							</Text>

							<Text style={styles.paragraph}>
								{section.content}
							</Text>
						</View>
					))}

					<Text style={styles.footer}>© 2026 EinkCanvas</Text>
				</View>
			</ScrollView>
		</>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: "#FBF7F3",
	},
	container: {
		paddingHorizontal: 20,
		paddingVertical: 48,
		alignItems: "center",
	},
	content: {
		width: "100%",
		maxWidth: 760,
	},
	brand: {
		color: "#668882",
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: 2,
		textTransform: "uppercase",
		marginBottom: 12,
	},
	title: {
		color: "#263D39",
		fontSize: 36,
		fontWeight: "700",
		marginBottom: 12,
	},
	updated: {
		color: "#68716F",
		fontSize: 14,
		marginBottom: 28,
	},
	intro: {
		color: "#374541",
		fontSize: 17,
		lineHeight: 28,
		marginBottom: 32,
	},
	section: {
		marginBottom: 28,
	},
	sectionTitle: {
		color: "#263D39",
		fontSize: 19,
		fontWeight: "700",
		marginBottom: 10,
	},
	paragraph: {
		color: "#414B47",
		fontSize: 16,
		lineHeight: 27,
	},
	link: {
		color: "#426F66",
		fontSize: 16,
		lineHeight: 26,
		marginTop: 10,
		textDecorationLine: "underline",
	},
	footer: {
		color: "#68716F",
		fontSize: 13,
		marginTop: 24,
		paddingTop: 20,
		borderTopWidth: 1,
		borderTopColor: "#DDDCD5",
		width: "100%",
	},
});
