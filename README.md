app build plataforma de desenvolvimento:
eas build --profile development --platform android

app run plataforma de desenvolvimento:
npx expo start --dev-client

app build apk preview:
eas build -p android --profile preview

web app run:
npx expo start --web -c

web app build dist:
npx expo export -p web
