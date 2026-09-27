# Quadro E-ink

Aplicativo para gerenciamento de quadros digitais E-ink utilizando displays Spectra 6.

O projeto permite organizar coleções de fotos, processar imagens para a paleta do display, enviar fotos agendadas e controlar quais imagens devem aparecer no quadro.

Além do aplicativo mobile, existe um web app simplificado que permite que usuários autorizados enviem fotos agendadas para um quadro.

## Funcionalidades

### App mobile

- Login com Firebase Authentication
- Cadastro e gerenciamento de quadros
- Suporte aos displays:
  - Spectra 6 7.3"
  - Spectra 6 13.3"
- Orientação retrato e paisagem
- Configuração do intervalo de atualização do quadro
- Criação e gerenciamento de coleções
- Ativação e desativação de coleções
- Upload e gerenciamento de fotos
- Descrição opcional para fotos
- Crop e enquadramento antes do processamento
- Conversão das imagens para a paleta Spectra 6
- Geração do arquivo binário utilizado pelo display
- Preview da imagem processada
- Fotos agendadas por duração
- Fotos agendadas com recorrência anual
- Aviso de orientação incompatível
- Recebimento de notificações push quando um convidado envia uma foto agendada
- Abertura direta da tela de fotos agendadas ao tocar na notificação

### Fotos agendadas

Existem dois tipos de foto agendada.

#### Exibição por duração

A foto é exibida na próxima sincronização disponível e permanece no quadro pelo tempo definido a partir do momento em que começa a ser exibida.

```text
recurrence: "once"
durationMinutes: 180
```

No aplicativo mobile, a duração é definida em dias e horas.

```text
duração em horas = 24 × dias + horas
durationMinutes = duração em horas × 60
```

O início e o término da exibição são controlados localmente pelo firmware. Esse estado não precisa ser armazenado como histórico no servidor.

#### Recorrência anual

A imagem fica programada para aparecer durante o dia escolhido, todos os anos.

```text
recurrence: "yearly"

yearlyDate:
  month: 12
  day: 25
```

A recorrência anual utiliza o dia inteiro no fuso local do quadro.

### Web app

O web app permite que convidados autorizados enviem fotos agendadas sem precisar utilizar o aplicativo mobile.

Fluxo:

```text
Login com Google
→ Verificação de autorização
→ Escolher quadro autorizado
→ Escolher foto
→ Crop / enquadramento
→ Processamento Spectra 6
→ Escolher duração
→ Enviar
```

O web app suporta apenas fotos agendadas do tipo:

```text
recurrence: "once"
```

As durações disponíveis no web app são:

- 30 minutos
- 1 hora
- 2 horas
- 3 horas

### Notificações push

Quando um convidado autorizado envia uma foto agendada pelo web app, a criação do documento no Firestore aciona uma Cloud Function.

```text
Web app
→ Firestore cria temporaryPhotos/{photoId}
→ Cloud Function identifica o dono do quadro
→ Busca os push tokens cadastrados
→ Expo Push Service / FCM
→ Notificação chega ao celular
→ Toque abre "Fotos agendadas" daquele quadro
```

As notificações enviadas pelo próprio dono do quadro são ignoradas pela Cloud Function.

Um mesmo usuário pode registrar vários dispositivos.

```text
users/{uid}/pushTokens/{expoPushToken}
  token
  platform
  updatedAt
```

## Fluxo de telas

![Fluxo de telas](docs/appscreens.png)

## Firebase

O projeto utiliza:

- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Hosting
- Firebase Cloud Functions

A estrutura principal de dados e arquivos está representada abaixo.

![Estrutura Firestore e Storage](docs/firestore-storage.png)

### Fotos agendadas no Firestore

```text
devices/{deviceId}/temporaryPhotos/{photoId}
```

Exibição por duração:

```text
createdByUid
createdByEmail
previewPath
epaperFilePath
width
height
createdAt
recurrence: "once"
durationMinutes
```

Recorrência anual:

```text
createdByUid
previewPath
epaperFilePath
width
height
createdAt
recurrence: "yearly"
yearlyDate:
  month
  day
```

Os nomes internos `temporaryPhotos` foram mantidos mesmo com a terminologia de interface alterada para "fotos agendadas".

## Processamento de imagem

As imagens são processadas antes do envio para o quadro.

```text
Imagem original
→ Crop
→ Resize para a resolução do display
→ Conversão para a paleta Spectra 6
→ Preview
→ Arquivo display.bin
```

O arquivo `display.bin` é o arquivo utilizado pelo firmware para desenhar a imagem no display E-ink.

## Desenvolvimento

### App mobile

O aplicativo utiliza Expo / React Native.

#### Build da plataforma de desenvolvimento

```bash
eas build --profile development --platform android
```

#### Rodar com development build

```bash
npx expo start --dev-client
```

O development build precisa estar instalado no dispositivo antes de executar esse comando.

#### Gerar APK de preview

```bash
eas build -p android --profile preview
```

### Web app

#### Rodar localmente

```bash
npx expo start --web -c
```

O `-c` limpa o cache do Expo antes de iniciar.

#### Gerar build e publicar

Gerar os arquivos estáticos:

```bash
npx expo export -p web
```

Os arquivos são gerados em:

```text
dist/
```

Publicar no Firebase Hosting:

```bash
firebase deploy --only hosting
```

Fluxo completo:

```bash
npx expo export -p web
firebase deploy --only hosting
```

### Firebase Functions

Publicar as Cloud Functions:

```bash
firebase deploy --only functions
```

A função responsável pelas notificações é acionada quando uma nova foto agendada é criada em:

```text
devices/{deviceId}/temporaryPhotos/{photoId}
```

## Estrutura geral

```text
Quadro E-ink

App mobile
├── gerenciamento de quadros
├── configurações do display
├── coleções
├── fotos
├── fotos agendadas
├── notificações push
└── processamento Spectra 6

Web app
├── autenticação Google
├── autorização por quadro
├── seleção de foto
├── crop
├── processamento Spectra 6
├── seleção de duração
└── envio de foto agendada

Firebase
├── Authentication
├── Firestore
├── Storage
├── Hosting
└── Cloud Functions
    └── envio de notificações push

Firmware
└── ESP32 + display Spectra 6
```

## Status do projeto

### Aplicativo mobile

Implementado:

- gerenciamento de quadros
- gerenciamento de coleções
- gerenciamento de fotos
- processamento Spectra 6
- fotos agendadas por duração
- recorrência anual
- controle de orientação
- notificações push
- abertura da galeria de fotos agendadas ao tocar na notificação

### Web app

Implementado:

- autenticação Google
- controle de autorização
- envio de fotos agendadas
- seleção de duração com presets de 30 min, 1 h, 2 h e 3 h
- processamento da imagem diretamente no navegador
- publicação via Firebase Hosting

### Firebase

Implementado:

- armazenamento de fotos e configurações no Firestore
- armazenamento de previews e arquivos binários no Storage
- permissões para convidados autorizados
- armazenamento de múltiplos push tokens por usuário
- Cloud Function para envio automático de notificações
- integração com Expo Push Service / FCM

### Firmware

O firmware será responsável por:

- sincronizar fotos e configurações
- armazenar imagens localmente
- selecionar a próxima imagem
- interpretar fotos agendadas por duração
- controlar localmente o início e o término de `durationMinutes`
- interpretar recorrências anuais
- respeitar a orientação configurada do display
- atualizar o display E-ink
- utilizar deep sleep para reduzir o consumo de bateria

## Tecnologias

- React Native
- Expo
- Expo Notifications
- TypeScript
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Hosting
- Firebase Cloud Functions
- Expo Push Service
- Firebase Cloud Messaging (FCM)
- ESP32
- Spectra 6

## Displays suportados

### Spectra 6 7.3"

```text
800 × 480
```

### Spectra 6 13.3"

```text
1600 × 1200
```

As duas resoluções podem ser utilizadas em orientação retrato ou paisagem.
