# Quadro E-Ink — Referência de Firmware (ESP32 + Spectra 6)

Este arquivo resume a arquitetura planejada do firmware do **Quadro E-Ink** e serve como referência para quando o hardware chegar.

> **Importante:** o código abaixo é propositalmente simplificado. Ele mostra a arquitetura e o fluxo do firmware, mas ainda não é um firmware final pronto para compilar. A integração exata com o driver do display, a rotação física dos pixels, o controle de alimentação e alguns detalhes de deep sleep só serão fechados quando o hardware estiver disponível para teste.

---

## 1. Hardware de referência

Placa: **Good Display ESP32E6-E01**

Microcontrolador indicado no esquema:

- ESP32-S3-WROOM-1-N16R8

Display principal considerado:

- **GDEP073E01**
- Spectra 6
- resolução física nativa: **800 × 480**
- 6 cores principais usadas no projeto:
  - preto
  - branco
  - amarelo
  - vermelho
  - azul
  - verde

A documentação da Good Display indica que a placa é programável em **Arduino** e suporta:

- Wi-Fi
- Bluetooth
- atualização por USB
- imagens pré-armazenadas no cartão SD
- quatro botões físicos
- interface EPD dedicada

### Pinos EPD documentados

```cpp
#define EPD_MOSI 11
#define EPD_CLK  12
#define EPD_BUSY 5
#define EPD_RST  4
#define EPD_DC   3
#define EPD_CS   2
```

### Pinos do SD documentados

```cpp
#define SD_CS    48
#define SD_MOSI  47
#define SD_MISO  13
#define SD_SCK   21
```

### Botões disponíveis na placa

Segundo a documentação:

```text
SW2  -> GPIO46
SW3  -> GPIO9
SW11 -> GPIO42
SW12 -> GPIO41
```

Todos são acionados em nível baixo.

No projeto, três deles podem ser usados como:

```text
NEXT
SYNC
INFO
```

---

## 2. Ideia central do firmware

O firmware não precisa ficar rodando continuamente.

O comportamento desejado é:

```text
ESP acorda
↓
descobre por que acordou
↓
faz uma tarefa
↓
atualiza o e-paper se necessário
↓
salva estado
↓
entra novamente em deep sleep
```

Por isso, o `loop()` pode ficar praticamente vazio.

Fluxo conceitual:

```cpp
void setup() {
    initHardware();

    switch (getWakeReason()) {
        case NEXT:
            showNext();
            break;

        case SYNC:
            syncAndShow();
            break;

        case INFO:
            toggleInfo();
            break;

        case TIMER:
            syncAndShow();
            break;
    }

    goToSleep();
}

void loop() {
}
```

---

## 3. Formato das imagens no SD

O app já processa as fotos antes de enviá-las ao quadro.

O formato planejado é:

```text
4 bits por pixel
2 pixels por byte
```

Isso é suficiente para representar as seis cores.

Mapeamento lógico/nativo considerado:

```text
0x0 = preto
0x1 = branco
0x2 = amarelo
0x3 = vermelho
0x5 = azul
0x6 = verde
```

Exemplo:

```text
byte = 0x15

0001 0101
^^^^ ^^^^
pixel A
      pixel B

1 = branco
5 = azul
```

### Tamanho de arquivo — 7,3"

```text
800 × 480 = 384.000 pixels

4 bits/pixel
= 192.000 bytes
```

### Tamanho de arquivo — 13,3"

Para 1200 × 1600:

```text
1.920.000 pixels
× 4 bits
= 960.000 bytes
```

### Por que manter 4 bpp?

Porque:

- seis cores cabem confortavelmente em 4 bits;
- dois pixels cabem exatamente em um byte;
- a leitura é simples;
- o arquivo fica menor;
- não precisamos armazenar 1 byte inteiro por pixel;
- o firmware pode adaptar o formato ao driver se necessário.

O formato usado por uma ferramenta web da Good Display não precisa ser o mesmo formato que salvamos no SD.

---

## 4. Separação de responsabilidades

A arquitetura desejada é:

```text
APP
│
├── crop
├── dithering
├── escolha da cor lógica de cada pixel
└── gera .bin 4 bpp
        │
        ▼
Firebase / Storage
        │
        ▼
ESP32
│
├── baixa arquivo
├── salva no SD
├── escolhe próxima imagem
├── resolve orientação física
└── envia dados para o driver
        │
        ▼
Spectra 6
```

Assim, o app decide **qual cor cada pixel deve ser**.

O firmware decide **como mandar esses dados ao hardware**.

---

## 5. Estrutura sugerida do firmware

Uma organização possível:

```text
firmware/
│
├── main.ino
│
├── display/
│   ├── display.cpp
│   └── display.h
│
├── storage/
│   ├── storage.cpp
│   └── storage.h
│
├── sync/
│   ├── sync.cpp
│   └── sync.h
│
├── playback/
│   ├── playback.cpp
│   └── playback.h
│
└── state/
    ├── state.cpp
    └── state.h
```

Responsabilidades:

```text
main
→ decide o que fazer ao acordar

display
→ interface com o e-paper

storage
→ SD, arquivos e snapshots

sync
→ Wi-Fi e sincronização remota

playback
→ round-robin + least recently shown

state
→ foto atual, histórico, collection atual etc.
```

---

# 6. Exemplo simplificado de `main.ino`

```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <SD.h>
#include "esp_sleep.h"

#define BTN_NEXT 46
#define BTN_SYNC 9
#define BTN_INFO 42

#define EPD_CS   2
#define EPD_DC   3
#define EPD_RST  4
#define EPD_BUSY 5
#define EPD_MOSI 11
#define EPD_CLK  12

#define SD_CS    48

constexpr size_t IMAGE_SIZE_73 =
    800 * 480 / 2; // 192.000 bytes


enum class WakeReason {
    NEXT,
    SYNC,
    INFO,
    TIMER,
    UNKNOWN
};


void initHardware();
void initSD();

WakeReason getWakeReason();

void handleNext();
void handleSync();
void handleInfo();

void goToSleep();


void setup() {
    Serial.begin(115200);

    initHardware();
    initSD();

    WakeReason reason =
        getWakeReason();

    switch (reason) {

        case WakeReason::NEXT:
            handleNext();
            break;

        case WakeReason::SYNC:
            handleSync();
            break;

        case WakeReason::INFO:
            handleInfo();
            break;

        case WakeReason::TIMER:
            handleSync();
            break;

        default:
            handleSync();
            break;
    }

    goToSleep();
}


void loop() {
    // O firmware passa praticamente todo
    // o tempo em deep sleep.
}
```

---

# 7. NEXT

O botão NEXT não liga Wi-Fi.

Fluxo:

```text
NEXT
↓
acorda
↓
liga SD
↓
lê snapshots locais
↓
escolhe próxima foto
↓
mostra
↓
salva histórico
↓
desliga o que puder
↓
deep sleep
```

Código conceitual:

```cpp
void handleNext() {
    loadPlaybackState();

    String imageId =
        chooseNextImage();

    String filename =
        "/images/" +
        imageId +
        ".bin";

    displayBin(filename);

    addToHistory(imageId);

    savePlaybackState();
}
```

---

# 8. Escolha da próxima foto

A lógica planejada combina:

```text
ROUND-ROBIN entre collections
+
LEAST RECENTLY SHOWN dentro da collection
```

Regras de elegibilidade:

```text
collection.active == true

photo.active == true

orientação da foto
==
orientação atual do quadro
```

Fluxo:

```text
1. pega collections ativas

2. escolhe a próxima collection
   pelo round-robin

3. pega as fotos elegíveis

4. percorre o histórico
   do mais recente para o mais antigo

5. encontra quando cada candidata
   apareceu pela última vez

6. escolhe a menos recentemente exibida

7. se uma nunca apareceu,
   ela ganha prioridade
```

Limites planejados:

```text
máximo aproximado de fotos = 200

histórico =
últimas 1000 exibições
```

Quando a entrada 1001 for adicionada:

```text
remove a mais antiga
adiciona a nova no final
```

O histórico pode ser um simples array de IDs.

Exemplo:

```json
{
  "lastCollectionId": "collection-b",

  "displayHistory": [
    "img-17",
    "img-03",
    "img-42",
    "img-08"
  ]
}
```

---

# 9. Forma eficiente de procurar a least recently shown

Não fazer:

```text
para cada foto:
    percorrer todo o histórico
```

Isso poderia chegar a:

```text
200 × 1000
= 200.000 comparações
```

Ainda seria aceitável, mas é desnecessário.

Melhor:

```text
percorre o histórico uma única vez
de trás para frente
```

Ao encontrar uma foto candidata pela primeira vez, aquela posição já é a última exibição dela.

Exemplo:

```text
histórico do fim para o começo:

999 -> C
998 -> X
997 -> A
...
943 -> E
912 -> B

D não apareceu
```

Resultado:

```text
D = nunca exibida
→ D ganha prioridade
```

Também é possível parar assim que todas as candidatas forem encontradas.

---

# 10. SYNC

O timer normal e o botão SYNC usam essencialmente a mesma rotina.

Fluxo:

```text
acorda
↓
Wi-Fi ON
↓
consulta servidor
↓
baixa novas imagens
↓
remove imagens que não existem mais
↓
atualiza snapshots locais
↓
Wi-Fi OFF
↓
escolhe próxima foto
↓
mostra
↓
salva histórico
↓
deep sleep
```

Código simplificado:

```cpp
void handleSync() {
    connectWiFi();

    DeviceConfig config =
        fetchDeviceConfig();

    ServerState state =
        fetchServerState();

    syncImagesToSD(state);

    saveSnapshots(state);

    disconnectWiFi();

    String imageId =
        chooseNextImage();

    displayBin(
        "/images/" +
        imageId +
        ".bin"
    );

    addToHistory(imageId);

    savePlaybackState();
}
```

A implementação real pode falar:

```text
diretamente com Firebase
```

ou, futuramente:

```text
com uma API própria
```

Essa decisão ainda pode ser tomada depois.

---

# 11. Leitura da imagem do SD

A imagem não precisa necessariamente ser carregada inteira na RAM.

Podemos ler em blocos:

```cpp
void displayBin(
    const String& filename
) {
    File file =
        SD.open(
            filename,
            FILE_READ
        );

    if (!file) {
        Serial.println(
            "Imagem não encontrada"
        );

        return;
    }

    if (
        file.size() !=
        IMAGE_SIZE_73
    ) {
        Serial.println(
            "Tamanho inválido"
        );

        file.close();

        return;
    }

    epdBegin();

    uint8_t buffer[4096];

    while (file.available()) {

        size_t bytesRead =
            file.read(
                buffer,
                sizeof(buffer)
            );

        epdWrite(
            buffer,
            bytesRead
        );
    }

    file.close();

    epdRefresh();

    epdSleep();
}
```

Conceito:

```text
SD
↓
4096 bytes
↓
driver
↓
próximos 4096 bytes
↓
driver
```

Isso evita manter uma segunda cópia completa da imagem na RAM.

---

# 12. `epdWrite()`

Essa parte depende da biblioteca/driver usado.

Possibilidade simples:

```cpp
void epdWrite(
    uint8_t* data,
    size_t length
) {
    display.writeNative(
        data,
        length
    );
}
```

Se o driver exigir outro formato:

```cpp
void epdWrite(
    uint8_t* data,
    size_t length
) {
    for (
        size_t i = 0;
        i < length;
        i++
    ) {
        uint8_t byte =
            data[i];

        uint8_t pixel1 =
            byte >> 4;

        uint8_t pixel2 =
            byte & 0x0F;

        sendPixel(pixel1);
        sendPixel(pixel2);
    }
}
```

O ponto importante é:

> o arquivo do SD pode continuar em 4 bpp mesmo que a biblioteca exija outra representação internamente.

---

# 13. INFO — descrição da foto

Cada foto pode ter:

```ts
description?: string;
```

Limite inicial planejado:

```text
300 caracteres
```

O botão INFO funciona como toggle:

```text
foto
↓ INFO
descrição
↓ INFO
foto
```

Se a foto não tiver descrição:

```text
INFO
→ não faz nada
```

Fluxo simplificado:

```cpp
void handleInfo() {
    PlaybackState state =
        loadPlaybackState();

    PhotoMetadata photo =
        getPhotoMetadata(
            state.currentImageId
        );

    if (
        photo.description.length()
        == 0
    ) {
        return;
    }

    if (
        state.showingDescription
    ) {
        displayBin(
            photo.filename
        );

        state.showingDescription =
            false;
    }
    else {
        renderDescription(
            photo.description
        );

        state.showingDescription =
            true;
    }

    savePlaybackState(state);
}
```

A descrição será renderizada no próprio ESP.

Objetivo visual:

- fonte bonita;
- texto preto;
- fundo branco;
- margens;
- word wrap;
- espaçamento entre linhas;
- paginação, se necessário.

A fonte e os tamanhos só precisam ser escolhidos quando o display físico estiver disponível.

---

# 14. Deep sleep

Depois de fazer sua tarefa:

```cpp
void goToSleep() {

    uint64_t sleepSeconds =
        120ULL * 60ULL;

    esp_sleep_enable_timer_wakeup(
        sleepSeconds *
        1000000ULL
    );

    // Também configurar aqui
    // os GPIOs dos botões
    // como fontes de wake-up.

    esp_deep_sleep_start();
}
```

Quando o ESP entra em deep sleep:

```text
programa praticamente para
```

Ao acordar:

```text
setup() começa novamente
```

Isso simplifica bastante o firmware.

---

# 15. Atualização configurável

O device armazena:

```ts
updateIntervalMinutes: number;
```

No front-end existe um limite mínimo planejado de:

```text
120 minutos
```

Então o deep sleep usará algo equivalente a:

```cpp
uint64_t sleepSeconds =
    updateIntervalMinutes * 60ULL;
```

---

# 16. Aviso temporário

Ideia planejada:

```text
imagem temporária
+
expiresAt
```

Não há horário preciso de início.

Ela começa:

```text
na próxima sincronização
```

Se for necessário mostrar imediatamente:

```text
usuário aperta SYNC
```

Quando o ESP recebe o aviso:

```text
baixa imagem
↓
salva localmente
↓
mostra
↓
programa wake-up para expiresAt
```

Quando chegar a hora:

```text
acorda
↓
remove aviso local
↓
volta para rotação normal
```

Se NEXT for pressionado enquanto um aviso está sendo exibido:

```text
NEXT
↓
descarta aviso imediatamente
↓
apaga arquivo temporário
↓
volta para fotos normais
```

Não haverá histórico desses avisos.

O objetivo é ser um conteúdo realmente volátil.

---

# 17. Próximo wake-up pode mudar

Normalmente:

```text
próximo wake-up =
agora + updateIntervalMinutes
```

Mas se existir um aviso temporário expirando antes:

```text
próxima atualização normal = 20:00

aviso expira = 19:15

→ acordar às 19:15
```

Regra:

```text
nextWake =
min(
    nextNormalSync,
    temporaryNoticeExpiration
)
```

---

# 18. Questão de orientação

Ainda precisa ser validado fisicamente.

O painel 7,3" tem resolução nativa:

```text
800 × 480
```

No app podemos trabalhar com:

```text
landscape:
800 × 480

portrait:
480 × 800
```

Mas o driver físico pode exigir os pixels sempre no layout nativo.

Portanto, futuramente precisamos decidir se a rotação ocorrerá:

```text
no app
```

ou:

```text
no firmware
```

Preferência arquitetural:

> manter o `.bin` com uma convenção lógica simples e fazer a adaptação física no firmware, se necessário.

Mas isso deve ser confirmado com o hardware.

---

# 19. Dithering e firmware são coisas diferentes

O app decide:

```text
qual das seis cores cada pixel terá
```

O firmware não precisa recalcular Floyd-Steinberg, OKLab etc.

Exemplo:

```text
foto JPEG
↓
APP
↓
Floyd-Steinberg / OKLab / outro algoritmo
↓
pixels quantizados
↓
.bin 4 bpp
↓
ESP
↓
display
```

Isso é importante porque o processamento pesado acontece no celular, não no ESP.

---

# 20. Ferramentas da Good Display

A ferramenta oficial analisada usa:

- contraste padrão 1.2;
- conversão RGB -> CIELAB;
- distância modificada:
  - peso 0.2 para luminosidade;
  - peso 3 para a*;
  - peso 3 para b*;
- Floyd-Steinberg;
- Atkinson;
- Stucki;
- Jarvis-Judice-Ninke;
- controle de dither strength.

Ela também usa um protocolo USB de 1 byte por pixel para conversar com o firmware oficial.

Isso **não obriga** nosso sistema a usar 1 byte por pixel no SD.

Nosso formato de 4 bpp pode continuar sendo usado pelo firmware próprio.

---

# 21. O que ainda precisa ser validado quando o hardware chegar

Checklist principal:

```text
[ ] Arduino IDE reconhece a placa corretamente

[ ] cartão SD funciona com os pinos previstos

[ ] deep sleep funciona como esperado

[ ] botões acordam o ESP

[ ] GDEP073E01 funciona com biblioteca/driver escolhido

[ ] códigos nativos de cor são confirmados

[ ] ordem dos nibbles é confirmada

[ ] orientação física é confirmada

[ ] landscape funciona

[ ] portrait funciona

[ ] leitura em chunks funciona

[ ] painel pode ser colocado em sleep/power-off após refresh

[ ] consumo real em deep sleep é medido

[ ] LEDs/reguladores da placa não dominam o consumo

[ ] Wi-Fi é desligado antes de dormir

[ ] SD e EPD podem ser desligados/cortados quando não usados
```

---

# 22. Código final conceitual

A versão mais curta possível do firmware é:

```cpp
void setup() {

    initHardware();

    switch (
        getWakeReason()
    ) {

        case NEXT:
            showNext();
            break;

        case SYNC:
            syncAndShow();
            break;

        case INFO:
            toggleInfo();
            break;

        case TIMER:
            syncAndShow();
            break;
    }

    goToSleep();
}


void loop() {
}
```

O restante do projeto existe para implementar bem estas quatro operações:

```text
showNext()

syncAndShow()

toggleInfo()

goToSleep()
```

Esse é o modelo mental principal do firmware.

---

# 23. Fontes/documentação usadas nesta referência

Arquivos da Good Display fornecidos durante o planejamento:

1. `EN-ESP32E6-E01.pdf`
   - especificações da placa;
   - Arduino como plataforma;
   - métodos de atualização;
   - pinos do SD;
   - pinos do EPD;
   - botões;
   - fluxo oficial com SD, Wi-Fi, Bluetooth e USB.

2. `EN-ESP32E6-E01 - Schematic Diagram.pdf`
   - ESP32-S3-WROOM-1-N16R8;
   - ligações físicas;
   - SD;
   - conectores;
   - alimentação;
   - interface EPD.

3. `EN-ESP32E6-E01 - Firmware flashing guide.pdf`
   - processo de gravação do firmware;
   - uso do Flash Download Tool;
   - firmware oficial pré-compilado da Good Display.

4. `usb2epd.html`
   - código JavaScript da ferramenta oficial;
   - dithering;
   - paleta;
   - CIELAB;
   - protocolo de envio ao ESP32;
   - organização dos pixels na ferramenta oficial.

---

# 24. Resumo final

A arquitetura planejada é:

```text
CELULAR
↓
processa foto
↓
gera .bin 4 bpp
↓
Firebase
↓
ESP32 acorda
↓
sincroniza
↓
salva no SD
↓
escolhe próxima imagem
↓
envia ao Spectra 6
↓
deep sleep
```

Botões:

```text
NEXT
→ próxima foto
→ sem Wi-Fi

SYNC
→ sincroniza
→ mostra conteúdo novo

INFO
→ foto <-> descrição
→ sem Wi-Fi
```

Playback:

```text
round-robin de collections
+
least recently shown
```

Estado local:

```text
até ~200 fotos
histórico das últimas 1000 exibições
```

Princípio fundamental:

> O ESP32 acorda, faz o mínimo necessário, atualiza o e-paper e volta a dormir.
