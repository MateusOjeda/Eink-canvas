#include <WiFi.h>
#include <SPI.h>
#include <time.h>

#include "SDManager.h"
#include "FirebaseManager.h"
#include "WiFiManager.h"

#include "Display_EPD_W21.h"
#include "Display_EPD_W21_spi.h"

#define EPD_CS   2
#define EPD_DC   3
#define EPD_RST  4
#define EPD_BUSY 5
#define EPD_SCK  12
#define EPD_MOSI 11

#define IMAGE_SIZE 192000

#define WIFI_SSID "OJEDA"
#define WIFI_PASSWORD "mateus118"

#define API_KEY "AIzaSyCzNPNS0mugUk31NpC1XGKKZjR6qQPHF50"

#define STORAGE_BUCKET_ID "einkcanvas.firebasestorage.app"

SDManager sd;
FirebaseManager firebase;
FirebaseJson stateJson;
WiFiManager wifiManager;

#define BUTTON_SYNC  46  // Botao 2
#define BUTTON_NEXT   9  // Botao 3 - acorda o ESP
#define BUTTON_INFO  41  // Botao 12
#define BUTTON_WIFI  42  // Botao 11


// ============================================================
// FUNCOES DE APOIO
// ============================================================
bool writeStateFirebase()
{
  String stateOutput;

  stateJson.toString(
    stateOutput,
    false
  );

  String deviceId =
    WiFi.macAddress();

  return firebase.writeState(
    deviceId.c_str(),
    stateOutput
  );
}

bool syncClock()
{
  configTzTime(
    "America/Sao_Paulo",
    "pool.ntp.org",
    "time.nist.gov"
  );

  struct tm timeInfo;

  if (!getLocalTime(&timeInfo))
  {
    Serial.println("CLOCK: falha ao sincronizar.");
    return false;
  }

  Serial.println("CLOCK: sincronizado.");

  return true;
}


String getCurrentTimestamp()
{
  time_t now = time(nullptr);

  struct tm timeInfo;

  gmtime_r(
    &now,
    &timeInfo
  );

  char timestamp[25];

  strftime(
    timestamp,
    sizeof(timestamp),
    "%Y-%m-%dT%H:%M:%SZ",
    &timeInfo
  );

  return String(timestamp);
}


time_t parseTimestamp(const String& timestamp)
{
  int year;
  int month;
  int day;
  int hour;
  int minute;
  int second;

  if (
    sscanf(
      timestamp.c_str(),
      "%d-%d-%dT%d:%d:%dZ",
      &year,
      &month,
      &day,
      &hour,
      &minute,
      &second
    ) != 6
  )
  {
    return 0;
  }

  // Converte a data UTC para Unix timestamp.
  // Não usa mktime(), pois mktime() considera o horário local.

  int days = 0;

  for (int y = 1970; y < year; y++)
  {
    days += 365;

    if (
      (y % 4 == 0 && y % 100 != 0) ||
      (y % 400 == 0)
    )
    {
      days++;
    }
  }

  const int daysInMonth[] =
  {
    31, 28, 31, 30, 31, 30,
    31, 31, 30, 31, 30, 31
  };

  for (int m = 1; m < month; m++)
  {
    days += daysInMonth[m - 1];

    if (
      m == 2 &&
      (
        (year % 4 == 0 && year % 100 != 0) ||
        (year % 400 == 0)
      )
    )
    {
      days++;
    }
  }

  days += day - 1;

  return
    (time_t)days * 86400 +
    hour * 3600 +
    minute * 60 +
    second;
}

// ============================================================
// DISPLAY
// ============================================================

bool displayImageFromSD(
  const char* filename
)
{
  // ============================================================
  // VERIFICAR SE PODE ATUALIZAR
  // ============================================================

  if (!canUpdateImage())
  {
    Serial.println(
      "UPDATE: atualizacao nao disponivel - periodo de refresh respeitado"
    );

    return false;
  }

  Serial.println("Abrindo arquivo...");

  File file = SD.open(
    filename,
    FILE_READ
  );

  if (!file)
  {
    Serial.println(
      "ERRO: nao foi possivel abrir o arquivo."
    );

    return false;
  }

  Serial.print("Arquivo aberto. Tamanho: ");
  Serial.print(file.size());
  Serial.println(" bytes");

  if (file.size() != IMAGE_SIZE)
  {
    Serial.println(
      "ERRO: tamanho do arquivo diferente de 192000 bytes."
    );

    file.close();

    return false;
  }

  uint8_t* imageData =
    (uint8_t*)malloc(IMAGE_SIZE);

  if (imageData == nullptr)
  {
    Serial.println(
      "ERRO: nao foi possivel reservar memoria."
    );

    file.close();

    return false;
  }

  Serial.println("Memoria reservada.");

  size_t bytesRead =
    file.read(
      imageData,
      IMAGE_SIZE
    );

  file.close();

  Serial.println("Arquivo fechado.");

  Serial.print("Bytes lidos: ");
  Serial.println(bytesRead);

  if (bytesRead != IMAGE_SIZE)
  {
    Serial.println(
      "ERRO: leitura incompleta."
    );

    free(imageData);

    return false;
  }

  Serial.println(
    "Arquivo lido completamente."
  );


  // ============================================================
  // SPI DO SD → EPD
  // ============================================================

  SPI.end();

  Serial.println(
    "SPI do SD encerrado."
  );

  SPI.begin(
    EPD_SCK,
    -1,
    EPD_MOSI,
    EPD_CS
  );

  SPI.beginTransaction(
    SPISettings(
      10000000,
      MSBFIRST,
      SPI_MODE0
    )
  );

  Serial.println(
    "SPI do EPD configurado."
  );


  // ============================================================
  // INICIALIZA EPD
  // ============================================================

  Serial.println(
    "Inicializando EPD..."
  );

  EPD_init_fast();

  Serial.println(
    "EPD inicializado."
  );


  // ============================================================
  // ENVIA IMAGEM
  // ============================================================

  Serial.println(
    "Enviando imagem..."
  );

  EPD_W21_WriteCMD(0x10);

  for (int i = 0; i < IMAGE_SIZE; i++)
  {
    EPD_W21_WriteDATA(
      imageData[i]
    );
  }


  // ============================================================
  // ATUALIZA TELA
  // ============================================================

  EPD_W21_WriteCMD(0x12);

  EPD_W21_WriteDATA(0x00);

  delay(1);

  Serial.println(
    "Aguardando refresh..."
  );

  lcd_chkstatus();

  Serial.println(
    "Imagem exibida."
  );


  // ============================================================
  // EPD SLEEP - SD SPI Begin
  // ============================================================

  EPD_sleep();

  Serial.println(
    "EPD em sleep."
  );

  SPI.endTransaction();

  SPI.end();

  if (!sd.begin(Serial))
    {
      Serial.println(
        "ERRO: não foi possível inicializar o SD."
      );

      return false;
    }

  // ============================================================
  // LIBERA RAM
  // ============================================================

  free(imageData);

  Serial.println(
    "Memoria liberada."
  );

  return true;
}

bool showCurrentPhoto(
  const String& imageId,
  const String& epaperFilePath
)
{
  Serial.println("=== SHOW CURRENT PHOTO ===");

  String localPath =
    "/" + imageId + ".bin";

  Serial.print("Arquivo local: ");
  Serial.println(localPath);


  // ============================================================
  // VERIFICAR SE A IMAGEM JA ESTA NO SD
  // ============================================================

  if (!sd.exists(localPath.c_str()))
  {
    Serial.println(
      "Imagem nao encontrada no SD."
    );

    Serial.println(
      "Baixando imagem do Firebase Storage..."
    );

    if (!firebase.downloadImage(
          epaperFilePath.c_str(),
          localPath.c_str()
        ))
    {
      Serial.println(
        "ERRO: nao foi possivel baixar a imagem."
      );

      return false;
    }

    Serial.println(
      "Imagem baixada com sucesso."
    );
  }
  else
  {
    Serial.println(
      "Imagem ja existe no SD."
    );
  }


  // ============================================================
  // MOSTRAR IMAGEM NO DISPLAY
  // ============================================================

  Serial.println(
    "Exibindo imagem no E-Paper..."
  );

  if (!displayImageFromSD(
        localPath.c_str()
      ))
  {
    Serial.println(
      "ERRO: nao foi possivel exibir a imagem."
    );

    return false;
  }

  Serial.println(
    "Imagem exibida com sucesso."
  );

  return true;
}


// ============================================================
// STATE
// ============================================================

bool loadState()
{
  if (!sd.exists("/state.json"))
  {
    Serial.println(
      "STATE: arquivo nao existe. Criando estado inicial."
    );

    stateJson.clear();

    stateJson.setJsonData(
      "{\"lastCollectionId\":\"\",\"currentImageId\":\"\",\"displayHistory\":[]}"
    );

    return true;
  }

  uint64_t fileSize = sd.size("/state.json");

  if (fileSize == 0)
  {
    Serial.println(
      "STATE: arquivo vazio. Criando estado inicial."
    );

    stateJson.clear();

    stateJson.setJsonData(
      "{\"lastCollectionId\":\"\",\"currentImageId\":\"\",\"displayHistory\":[]}"
    );

    return true;
  }

  uint8_t* buffer =
    new uint8_t[fileSize + 1];

  if (!buffer)
  {
    Serial.println(
      "STATE: erro ao alocar memoria."
    );

    return false;
  }

  size_t bytesRead = sd.read(
    "/state.json",
    buffer,
    fileSize
  );

  buffer[bytesRead] = '\0';

  stateJson.clear();

  if (!stateJson.setJsonData(
        (char*)buffer
      ))
  {
    Serial.println(
      "STATE: JSON invalido."
    );

    delete[] buffer;

    return false;
  }

  delete[] buffer;

  Serial.println(
    "STATE: carregado."
  );

  String stateOutput;

  stateJson.toString(
    stateOutput,
    false
  );

  Serial.println(
    "=== STATE JSON ==="
  );

  Serial.println(
    stateOutput
  );

  return true;
}


bool saveState()
{
  Serial.println("SAVE: 1 - iniciando");

  String output;

  stateJson.toString(
    output,
    false
  );

  Serial.println("SAVE: 2 - JSON convertido");

  Serial.print("SAVE: tamanho: ");
  Serial.println(output.length());

  if (sd.exists("/state.json"))
  {
    Serial.println("SAVE: 3 - state.json existe");

    sd.remove("/state.json");

    Serial.println("SAVE: 4 - state.json removido");
  }
  else
  {
    Serial.println("SAVE: 3 - state.json nao existe");
  }

  Serial.println("SAVE: 5 - antes do sd.write");

  if (!sd.write(
        "/state.json",
        (const uint8_t*)output.c_str(),
        output.length()
      ))
  {
    Serial.println(
      "STATE: erro ao salvar /state.json."
    );

    return false;
  }

  Serial.println("SAVE: 6 - sd.write OK");

  Serial.println(
    "STATE: /state.json salvo."
  );

  return true;
}

// ============================================================
// VERIFICAR SE PODE ATUALIZAR A IMAGEM
// ============================================================

bool canUpdateImage()
{
  FirebaseJsonData historyData;

  if (!stateJson.get(
        historyData,
        "displayHistory"
      ))
  {
    Serial.println(
      "UPDATE: displayHistory nao encontrado."
    );

    return true;
  }

  FirebaseJsonArray history;

  if (!historyData.getArray(history))
  {
    Serial.println(
      "UPDATE: erro ao ler displayHistory."
    );

    return false;
  }

  if (history.size() == 0)
  {
    Serial.println(
      "UPDATE: nenhuma imagem exibida anteriormente."
    );

    return true;
  }

  FirebaseJsonData firstItemData;

  if (!history.get(
        firstItemData,
        0
      ))
  {
    return false;
  }

  FirebaseJson firstItem;

  if (!firstItemData.getJSON(
        firstItem
      ))
  {
    Serial.println(
      "UPDATE: primeiro item do historico invalido."
    );

    return false;
  }

  FirebaseJsonData displayedAtData;

  if (!firstItem.get(
        displayedAtData,
        "lastDisplayedAt"
      ))
  {
    Serial.println(
      "UPDATE: lastDisplayedAt nao encontrado."
    );

    return true;
  }

  String lastDisplayedAt =
    displayedAtData.to<String>();

  // Historico antigo migrado.
  // Como nao temos a data, consideramos que
  // a atualizacao esta disponivel.
  if (lastDisplayedAt.length() == 0)
  {
    Serial.println(
      "UPDATE: timestamp antigo sem data. Atualizacao permitida."
    );

    return true;
  }

  time_t lastTimestamp =
    parseTimestamp(
      lastDisplayedAt
    );

  if (lastTimestamp == 0)
  {
    Serial.println(
      "UPDATE: timestamp invalido."
    );

    return false;
  }

  time_t now =
    time(nullptr);

  double elapsed =
    difftime(
      now,
      lastTimestamp
    );

  Serial.print(
    "Segundos desde ultimo update: "
  );

  Serial.println(
    elapsed
  );

  if (elapsed >= 3 * 60)
  {
    Serial.println(
      "UPDATE: disponivel."
    );

    return true;
  }

  Serial.println(
    "UPDATE: ainda nao passaram 3 minutos."
  );

  return false;
}


// ============================================================
// REGISTRAR FOTO EXIBIDA
// ============================================================

bool recordDisplayedPhoto(
  const String& imageId
)
{
  Serial.println("HISTORY: - Start recordDisplayedPhoto()");

  FirebaseJsonData historyData;

  if (!stateJson.get(
        historyData,
        "displayHistory"
      ))
  {
    Serial.println(
      "STATE: displayHistory nao encontrado."
    );

    return false;
  }

  Serial.println("HISTORY: - displayHistory encontrado");

  FirebaseJsonArray history;

  if (!historyData.getArray(history))
  {
    Serial.println(
      "STATE: erro ao ler displayHistory."
    );

    return false;
  }

  Serial.println("HISTORY: - array OK");

  FirebaseJson newItem;

  String timestamp =
    getCurrentTimestamp();

  Serial.println("HISTORY: - timestamp OK");

  newItem.set(
    "imageId",
    imageId
  );

  newItem.set(
    "lastDisplayedAt",
    timestamp
  );

  Serial.println("HISTORY: - novo item OK");

  FirebaseJsonArray newHistory;

  newHistory.add(
    newItem
  );

  Serial.println("HISTORY: - novo historico iniciado");

  for (size_t i = 0; i < history.size(); i++)
  {
    Serial.print("HISTORY: processando item ");
    Serial.println(i);

    FirebaseJsonData historyItemData;

    if (!history.get(
          historyItemData,
          i
        ))
    {
      continue;
    }

    FirebaseJson historyItem;

    if (!historyItemData.getJSON(
          historyItem
        ))
    {
      continue;
    }

    FirebaseJsonData historyImageIdData;

    if (!historyItem.get(
          historyImageIdData,
          "imageId"
        ))
    {
      continue;
    }

    String historyImageId =
      historyImageIdData.to<String>();

    if (historyImageId == imageId)
      continue;

    newHistory.add(
      historyItem
    );
  }

  Serial.println("HISTORY: - loop terminado");

  stateJson.set(
    "currentImageId",
    imageId
  );

  Serial.println("HISTORY: - currentImageId OK");

  stateJson.set(
    "displayHistory",
    newHistory
  );

  Serial.println("HISTORY: - displayHistory OK");

  Serial.println(
    "=== DISPLAY HISTORY ATUALIZADO ==="
  );

  Serial.print("Imagem: ");
  Serial.println(imageId);

  Serial.print("Exibida em: ");
  Serial.println(timestamp);

  Serial.print("Historico: ");
  Serial.println(newHistory.size());

  Serial.println("HISTORY: - antes do saveState");

  bool result = saveState();

  Serial.println("HISTORY: - saveState terminou");

  return result;
}


// ============================================================
// ESPERA BOTAO
// ============================================================

void waitButtonRelease(int pin)
{
  while (digitalRead(pin) == LOW)
  {
    delay(20);
  }

  delay(50);
}


// ============================================================
// ESCOLHER PROXIMA FOTO
// ============================================================

bool chooseNextPhoto(
  String& outputImageId,
  String& outputEpaperFilePath,
  const String& priorityCollectionId,
  const String& priorityImageId,
  bool hasPriority
)
{
  outputImageId = "";
  outputEpaperFilePath = "";

  Serial.println(
    "=== CHOOSE NEXT PHOTO ==="
  );

  // ============================================================
  // CONFIG
  // ============================================================

  uint64_t configFileSize =
    sd.size("/config.json");

  if (configFileSize == 0)
  {
    Serial.println(
      "CONFIG: /config.json nao existe ou esta vazio."
    );

    return false;
  }

  uint8_t* configBuffer =
    new uint8_t[configFileSize + 1];

  if (!configBuffer)
  {
    Serial.println(
      "CONFIG: erro ao alocar memoria."
    );

    return false;
  }

  size_t configBytesRead =
    sd.read(
      "/config.json",
      configBuffer,
      configFileSize
    );

  configBuffer[configBytesRead] = '\0';

  FirebaseJson configJson;

  if (!configJson.setJsonData(
        (char*)configBuffer
      ))
  {
    Serial.println(
      "CONFIG: JSON invalido."
    );

    delete[] configBuffer;

    return false;
  }

  delete[] configBuffer;

  FirebaseJsonData orientationData;

  if (!configJson.get(
        orientationData,
        "orientation"
      ))
  {
    Serial.println(
      "CONFIG: orientation nao encontrado."
    );

    return false;
  }

  String orientation =
    orientationData.to<String>();

  int requiredWidth;
  int requiredHeight;

  if (orientation == "landscape")
  {
    requiredWidth = 800;
    requiredHeight = 480;
  }
  else if (orientation == "portrait")
  {
    requiredWidth = 480;
    requiredHeight = 800;
  }
  else
  {
    Serial.println(
      "CONFIG: orientation invalida."
    );

    return false;
  }

  Serial.print(
    "Orientacao: "
  );

  Serial.println(
    orientation
  );

  Serial.print(
    "Dimensao exigida: "
  );

  Serial.print(
    requiredWidth
  );

  Serial.print(
    "x"
  );

  Serial.println(
    requiredHeight
  );


  // ============================================================
  // PHOTOS
  // ============================================================

  uint64_t photosFileSize =
    sd.size("/photos.json");

  if (photosFileSize == 0)
  {
    Serial.println(
      "PHOTOS: /photos.json nao existe ou esta vazio."
    );

    return false;
  }

  uint8_t* photosBuffer =
    new uint8_t[photosFileSize + 1];

  if (!photosBuffer)
  {
    Serial.println(
      "PHOTOS: erro ao alocar memoria."
    );

    return false;
  }

  size_t photosBytesRead =
    sd.read(
      "/photos.json",
      photosBuffer,
      photosFileSize
    );

  photosBuffer[photosBytesRead] = '\0';

  FirebaseJson photosJson;

  if (!photosJson.setJsonData(
        (char*)photosBuffer
      ))
  {
    Serial.println(
      "PHOTOS: JSON invalido."
    );

    delete[] photosBuffer;

    return false;
  }

  delete[] photosBuffer;

  FirebaseJsonData collectionsData;

  if (!photosJson.get(
        collectionsData,
        "collections"
      ))
  {
    Serial.println(
      "PHOTOS: collections nao encontrado."
    );

    return false;
  }

  FirebaseJsonArray collections;

  if (!collectionsData.getArray(
        collections
      ))
  {
    Serial.println(
      "PHOTOS: erro ao ler collections."
    );

    return false;
  }

  Serial.print(
    "Colecoes encontradas: "
  );

  Serial.println(
    collections.size()
  );


  // ============================================================
  // PRIORIDADE
  // ============================================================

  if (hasPriority)
  {
    Serial.println(
      "=== PROCESSANDO FOTO PRIORITARIA ==="
    );

    Serial.print(
      "Collection ID: "
    );

    Serial.println(
      priorityCollectionId
    );

    Serial.print(
      "Image ID: "
    );

    Serial.println(
      priorityImageId
    );

    // ----------------------------------------------------------
    // PROCURAR A COLECAO DA PRIORIDADE
    // ----------------------------------------------------------

    int priorityCollectionIndex = -1;

    for (
      size_t i = 0;
      i < collections.size();
      i++
    )
    {
      FirebaseJsonData collectionData;

      if (!collections.get(
            collectionData,
            i
          ))
      {
        continue;
      }

      FirebaseJson collection;

      if (!collectionData.getJSON(
            collection
          ))
      {
        continue;
      }

      FirebaseJsonData collectionIdData;

      if (!collection.get(
            collectionIdData,
            "id"
          ))
      {
        continue;
      }

      if (
        collectionIdData.to<String>() ==
        priorityCollectionId
      )
      {
        priorityCollectionIndex = i;
        break;
      }
    }

    if (priorityCollectionIndex < 0)
    {
      Serial.println(
        "PRIORITY: colecao nao encontrada."
      );

      return false;
    }

    FirebaseJsonData priorityCollectionData;

    if (!collections.get(
          priorityCollectionData,
          priorityCollectionIndex
        ))
    {
      Serial.println(
        "PRIORITY: erro ao obter colecao."
      );

      return false;
    }

    FirebaseJson priorityCollection;

    if (!priorityCollectionData.getJSON(
          priorityCollection
        ))
    {
      Serial.println(
        "PRIORITY: erro ao interpretar colecao."
      );

      return false;
    }

    // ----------------------------------------------------------
    // VERIFICAR SE A COLECAO ESTA ATIVA
    // ----------------------------------------------------------

    FirebaseJsonData priorityCollectionActiveData;

    if (!priorityCollection.get(
          priorityCollectionActiveData,
          "active"
        ))
    {
      Serial.println(
        "PRIORITY: campo active da colecao nao encontrado."
      );

      return false;
    }

    if (!priorityCollectionActiveData.to<bool>())
    {
      Serial.println(
        "PRIORITY: colecao esta inativa."
      );

      return false;
    }

    // ----------------------------------------------------------
    // IMAGENS
    // ----------------------------------------------------------

    FirebaseJsonData priorityImagesData;

    if (!priorityCollection.get(
          priorityImagesData,
          "images"
        ))
    {
      Serial.println(
        "PRIORITY: images nao encontrado."
      );

      return false;
    }

    FirebaseJsonArray priorityImages;

    if (!priorityImagesData.getArray(
          priorityImages
        ))
    {
      Serial.println(
        "PRIORITY: erro ao ler images."
      );

      return false;
    }

    // ----------------------------------------------------------
    // PROCURAR A IMAGEM
    // ----------------------------------------------------------

    for (
      size_t i = 0;
      i < priorityImages.size();
      i++
    )
    {
      FirebaseJsonData imageData;

      if (!priorityImages.get(
            imageData,
            i
          ))
      {
        continue;
      }

      FirebaseJson image;

      if (!imageData.getJSON(image))
      {
        continue;
      }

      FirebaseJsonData imageIdData;
      FirebaseJsonData activeData;
      FirebaseJsonData widthData;
      FirebaseJsonData heightData;
      FirebaseJsonData epaperFilePathData;

      if (!image.get(
            imageIdData,
            "id"
          ))
      {
        continue;
      }

      if (!image.get(
            activeData,
            "active"
          ))
      {
        continue;
      }

      if (!image.get(
            widthData,
            "width"
          ))
      {
        continue;
      }

      if (!image.get(
            heightData,
            "height"
          ))
      {
        continue;
      }

      if (!image.get(
            epaperFilePathData,
            "epaperFilePath"
          ))
      {
        continue;
      }

      String imageId =
        imageIdData.to<String>();

      if (imageId != priorityImageId)
      {
        continue;
      }

      if (!activeData.to<bool>())
      {
        Serial.println(
          "PRIORITY: imagem esta inativa."
        );

        return false;
      }

      if (
        widthData.to<int>() != requiredWidth ||
        heightData.to<int>() != requiredHeight
      )
      {
        Serial.println(
          "PRIORITY: imagem possui dimensao incompatível."
        );

        return false;
      }

      outputImageId =
        imageId;

      outputEpaperFilePath =
        epaperFilePathData.to<String>();

      stateJson.set(
        "lastCollectionId",
        priorityCollectionId
      );

      Serial.println(
        "=== FOTO PRIORITARIA ESCOLHIDA ==="
      );

      Serial.print(
        "Image ID: "
      );

      Serial.println(
        outputImageId
      );

      Serial.print(
        "Epaper file path: "
      );

      Serial.println(
        outputEpaperFilePath
      );

      return true;
    }

    Serial.println(
      "PRIORITY: imagem nao encontrada."
    );

    return false;
  }

  // ============================================================
  // ESTADO ATUAL
  // ============================================================

  FirebaseJsonData lastCollectionData;

  stateJson.get(
    lastCollectionData,
    "lastCollectionId"
  );

  String lastCollectionId =
    lastCollectionData.to<String>();

  Serial.print(
    "Ultima colecao: "
  );

  Serial.println(
    lastCollectionId
  );


  // ============================================================
  // ENCONTRAR PROXIMA COLECAO
  // ============================================================

  int selectedCollectionIndex = -1;

  size_t collectionCount =
    collections.size();

  if (collectionCount == 0)
  {
    Serial.println(
      "PHOTOS: nenhuma colecao encontrada."
    );

    return false;
  }

  int lastCollectionIndex = -1;


  // Primeiro encontramos onde esta
  // a ultima colecao.
  for (size_t i = 0;
       i < collectionCount;
       i++)
  {
    FirebaseJsonData collectionData;

    if (!collections.get(
          collectionData,
          i
        ))
    {
      continue;
    }

    FirebaseJson collection;

    if (!collectionData.getJSON(
          collection
        ))
    {
      continue;
    }

    FirebaseJsonData idData;

    if (!collection.get(
          idData,
          "id"
        ))
    {
      continue;
    }

    if (idData.to<String>() ==
        lastCollectionId)
    {
      lastCollectionIndex = i;
      break;
    }
  }


  // ============================================================
  // PROCURAR COLECAO A PARTIR DA PROXIMA
  // ============================================================

  for (size_t offset = 1;
       offset <= collectionCount;
       offset++)
  {
    size_t index;

    if (lastCollectionIndex >= 0)
    {
      index =
        (lastCollectionIndex + offset)
        % collectionCount;
    }
    else
    {
      index =
        (offset - 1)
        % collectionCount;
    }

    FirebaseJsonData collectionData;

    if (!collections.get(
          collectionData,
          index
        ))
    {
      continue;
    }

    FirebaseJson collection;

    if (!collectionData.getJSON(
          collection
        ))
    {
      continue;
    }

    FirebaseJsonData collectionIdData;
    FirebaseJsonData collectionActiveData;
    FirebaseJsonData imagesData;

    if (!collection.get(
          collectionIdData,
          "id"
        ))
    {
      continue;
    }

    if (!collection.get(
          collectionActiveData,
          "active"
        ))
    {
      continue;
    }

    if (!collection.get(
          imagesData,
          "images"
        ))
    {
      continue;
    }

    if (!collectionActiveData.to<bool>())
      continue;

    FirebaseJsonArray images;

    if (!imagesData.getArray(images))
      continue;

    bool hasValidImage = false;

    for (size_t j = 0;
         j < images.size();
         j++)
    {
      FirebaseJsonData imageData;

      if (!images.get(
            imageData,
            j
          ))
      {
        continue;
      }

      FirebaseJson image;

      if (!imageData.getJSON(image))
        continue;

      FirebaseJsonData activeData;
      FirebaseJsonData widthData;
      FirebaseJsonData heightData;

      if (!image.get(
            activeData,
            "active"
          ))
      {
        continue;
      }

      if (!image.get(
            widthData,
            "width"
          ))
      {
        continue;
      }

      if (!image.get(
            heightData,
            "height"
          ))
      {
        continue;
      }

      if (!activeData.to<bool>())
        continue;

      if (widthData.to<int>() !=
          requiredWidth)
        continue;

      if (heightData.to<int>() !=
          requiredHeight)
        continue;

      hasValidImage = true;

      break;
    }

    if (hasValidImage)
    {
      selectedCollectionIndex =
        index;

      Serial.print(
        "Colecao escolhida: "
      );

      Serial.println(
        collectionIdData.to<String>()
      );

      break;
    }
  }

  if (selectedCollectionIndex < 0)
  {
    Serial.println(
      "PHOTOS: nenhuma colecao possui imagem compativel."
    );

    return false;
  }


  // ============================================================
  // IMAGEM MENOS RECENTEMENTE EXIBIDA
  // ============================================================

  FirebaseJsonData selectedCollectionData;

  if (!collections.get(
        selectedCollectionData,
        selectedCollectionIndex
      ))
  {
    Serial.println(
      "PHOTOS: erro ao ler colecao escolhida."
    );

    return false;
  }

  FirebaseJson selectedCollection;

  if (!selectedCollectionData.getJSON(
        selectedCollection
      ))
  {
    Serial.println(
      "PHOTOS: erro ao interpretar colecao."
    );

    return false;
  }

  FirebaseJsonData selectedImagesData;

  if (!selectedCollection.get(
        selectedImagesData,
        "images"
      ))
  {
    Serial.println(
      "PHOTOS: images nao encontrado."
    );

    return false;
  }

  FirebaseJsonArray selectedImages;

  if (!selectedImagesData.getArray(
        selectedImages
      ))
  {
    Serial.println(
      "PHOTOS: erro ao ler images."
    );

    return false;
  }


  // ============================================================
  // HISTORICO
  // ============================================================

  FirebaseJsonData historyData;

  stateJson.get(
    historyData,
    "displayHistory"
  );

  FirebaseJsonArray history;

  if (!historyData.getArray(history))
  {
    Serial.println(
      "STATE: erro ao ler displayHistory."
    );

    return false;
  }


  int selectedImageIndex = -1;
  int selectedImageHistoryPosition = -1;


  // ============================================================
  // PROCURAR IMAGEM MENOS RECENTEMENTE EXIBIDA
  // ============================================================

  for (size_t i = 0;
       i < selectedImages.size();
       i++)
  {
    FirebaseJsonData imageData;

    if (!selectedImages.get(
          imageData,
          i
        ))
    {
      continue;
    }

    FirebaseJson image;

    if (!imageData.getJSON(image))
      continue;

    FirebaseJsonData imageIdData;
    FirebaseJsonData activeData;
    FirebaseJsonData widthData;
    FirebaseJsonData heightData;

    if (!image.get(
          imageIdData,
          "id"
        ))
    {
      continue;
    }

    if (!image.get(
          activeData,
          "active"
        ))
    {
      continue;
    }

    if (!image.get(
          widthData,
          "width"
        ))
    {
      continue;
    }

    if (!image.get(
          heightData,
          "height"
        ))
    {
      continue;
    }

    if (!activeData.to<bool>())
      continue;

    if (widthData.to<int>() !=
        requiredWidth)
      continue;

    if (heightData.to<int>() !=
        requiredHeight)
      continue;

    String imageId =
      imageIdData.to<String>();


    // ==========================================================
    // PROCURAR IMAGEM NO HISTORICO
    // ==========================================================

    int historyPosition = -1;

    for (size_t h = 0;
         h < history.size();
         h++)
    {
      FirebaseJsonData historyItemData;

      if (!history.get(
            historyItemData,
            h
          ))
      {
        continue;
      }

      FirebaseJson historyItem;

      if (!historyItemData.getJSON(
            historyItem
          ))
      {
        continue;
      }

      FirebaseJsonData historyImageIdData;

      if (!historyItem.get(
            historyImageIdData,
            "imageId"
          ))
      {
        continue;
      }

      if (historyImageIdData.to<String>() ==
          imageId)
      {
        historyPosition = h;

        break;
      }
    }


    // Nunca exibida:
    // prioridade maxima.
    if (historyPosition < 0)
    {
      selectedImageIndex = i;

      selectedImageHistoryPosition = -1;

      break;
    }


    // Quanto maior o indice no historico,
    // mais antiga a ultima exibicao.
    if (selectedImageIndex < 0 ||
        historyPosition >
        selectedImageHistoryPosition)
    {
      selectedImageIndex = i;

      selectedImageHistoryPosition =
        historyPosition;
    }
  }

  if (selectedImageIndex < 0)
  {
    Serial.println(
      "PHOTOS: nenhuma imagem compativel encontrada."
    );

    return false;
  }


  // ============================================================
  // OBTER IMAGEM ESCOLHIDA
  // ============================================================

  FirebaseJsonData selectedImageData;

  if (!selectedImages.get(
        selectedImageData,
        selectedImageIndex
      ))
  {
    Serial.println(
      "STATE: erro ao obter imagem selecionada."
    );

    return false;
  }

  FirebaseJson selectedImage;

  if (!selectedImageData.getJSON(
        selectedImage
      ))
  {
    Serial.println(
      "STATE: erro ao converter imagem selecionada."
    );

    return false;
  }

  FirebaseJsonData imageIdData;
  FirebaseJsonData epaperFilePathData;

  if (!selectedImage.get(
        imageIdData,
        "id"
      ))
  {
    Serial.println(
      "STATE: imagem selecionada sem id."
    );

    return false;
  }

  if (!selectedImage.get(
        epaperFilePathData,
        "epaperFilePath"
      ))
  {
    Serial.println(
      "STATE: imagem selecionada sem epaperFilePath."
    );

    return false;
  }

  String selectedImageId =
    imageIdData.to<String>();

  outputImageId =
    selectedImageId;

  outputEpaperFilePath =
    epaperFilePathData.to<String>();


  // ============================================================
  // ATUALIZAR COLECAO ATUAL
  // ============================================================

  FirebaseJsonData selectedCollectionIdData;

  if (!selectedCollection.get(
        selectedCollectionIdData,
        "id"
      ))
  {
    Serial.println(
      "PHOTOS: colecao escolhida sem id."
    );

    return false;
  }

  String selectedCollectionId =
    selectedCollectionIdData.to<String>();

  stateJson.set(
    "lastCollectionId",
    selectedCollectionId
  );


  // IMPORTANTE:
  //
  // currentImageId e displayHistory so serao
  // atualizados depois que o display realmente
  // mostrar a imagem.
  //
  // Portanto nao salvamos o state aqui.


  // ============================================================
  // RESULTADO
  // ============================================================

  Serial.println(
    "=== FOTO ESCOLHIDA ==="
  );

  Serial.print(
    "Image ID: "
  );

  Serial.println(
    outputImageId
  );

  Serial.print(
    "Epaper file path: "
  );

  Serial.println(
    outputEpaperFilePath
  );

  Serial.print(
    "Imagem: "
  );

  Serial.println(
    selectedImageId
  );

  Serial.print(
    "Posicao no historico: "
  );

  Serial.println(
    selectedImageHistoryPosition
  );

  return true;
}


// ============================================================
// ROTINAS PRINCIPAIS SYNC, NEXT, INFO, WIFI
// ============================================================

void sync()
{
  Serial.println(
    "=== SYNC ==="
  );


  // ============================================================
  // WI-FI
  // ============================================================

  WiFi.begin(
    WIFI_SSID,
    WIFI_PASSWORD
  );

  Serial.print(
    "Conectando ao Wi-Fi"
  );

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  Serial.println(
    "Wi-Fi conectado."
  );

  Serial.print(
    "IP: "
  );

  Serial.println(
    WiFi.localIP()
  );

  String deviceId =
    WiFi.macAddress();

  Serial.print(
    "Device ID: "
  );

  Serial.println(
    deviceId
  );


  // ============================================================
  // HORARIO
  // ============================================================

  if (!syncClock())
    return;


  // ============================================================
  // SD
  // ============================================================

  Serial.println();

  Serial.println(
    "=== INICIALIZANDO SD ==="
  );

  if (!sd.begin(Serial))
    {
      Serial.println(
        "ERRO: não foi possível inicializar o SD."
      );

      return;
    }

  // ============================================================
  // LOAD STATE
  // ============================================================

  if (!loadState())
    {
      Serial.println(
        "ERRO: nao foi possivel carregar state."
      );

      return;
  }

  // ============================================================
  // FIREBASE
  // ============================================================

  firebase.begin(
    API_KEY,
    STORAGE_BUCKET_ID,
    Serial
  );

  if (!firebase.authenticate())
    return;


  // ============================================================
  // FIRESTORE - CONFIG
  // ============================================================

  String configJson;

  if (!firebase.readDeviceConfig(
        deviceId.c_str(),
        configJson
      ))
  {
    Serial.println(
      "ERRO: não foi possível sincronizar config."
    );

    return;
  }

  if (sd.exists("/config.json"))
    sd.remove("/config.json");

  if (!sd.write(
        "/config.json",
        (const uint8_t*)configJson.c_str(),
        configJson.length()
      ))
  {
    Serial.println(
      "ERRO: não foi possível salvar /config.json."
    );

    return;
  }

  Serial.println(
    "config.json salvo no SD."
  );


  // ============================================================
  // FIRESTORE - PHOTOS
  // ============================================================

  Serial.println();

  Serial.println(
    "=== SINCRONIZANDO PHOTOS ==="
  );

  String photosJson;

  if (!firebase.syncPhotos(
        deviceId.c_str(),
        photosJson
      ))
  {
    Serial.println(
      "ERRO: não foi possível sincronizar photos."
    );

    return;
  }

  if (sd.exists("/photos.json"))
    sd.remove("/photos.json");

  if (!sd.write(
        "/photos.json",
        (const uint8_t*)photosJson.c_str(),
        photosJson.length()
      ))
  {
    Serial.println(
      "ERRO: não foi possível salvar /photos.json."
    );

    return;
  }

  Serial.println(
    "photos.json salvo no SD."
  );


  String priorityCollectionId;
  String priorityImageId;
  bool hasPriority = false;

  if (!firebase.readDevicePriority(
        deviceId.c_str(),
        priorityCollectionId,
        priorityImageId,
        hasPriority
      ))
  {
    Serial.println(
      "ERRO: nao foi possivel ler prioridade."
    );

    return;
  }

  // ============================================================
  // ESCOLHER FOTO
  // ============================================================

  String imageId;
  String epaperFilePath;

  if (!chooseNextPhoto(
        imageId,
        epaperFilePath,
        priorityCollectionId,
        priorityImageId,
        hasPriority
      ))
  {
    Serial.println(
      "ERRO: nao foi possivel escolher a proxima foto."
    );

    return;
  }


  // ============================================================
  // MOSTRAR FOTO
  // ============================================================

  if (!showCurrentPhoto(
        imageId,
        epaperFilePath
      ))
  {
    Serial.println(
      "ERRO: nao foi possivel mostrar a foto."
    );

    return;
  }


  // ============================================================
  // CONSUMIR PRIORIDADE
  // ============================================================

  if (
    hasPriority &&
    imageId == priorityImageId
  )
  {
    Serial.println(
      "PRIORITY: foto prioritaria exibida."
    );

    Serial.println(
      "PRIORITY: removendo prioridade."
    );

    if (!firebase.clearDevicePriority(
          deviceId.c_str()
        ))
    {
      Serial.println(
        "ERRO: nao foi possivel remover prioridade."
      );

      return;
    }

    Serial.println(
      "PRIORITY: prioridade removida."
    );
  }


  // ============================================================
  // REGISTRAR FOTO EXIBIDA
  // ============================================================

  if (!recordDisplayedPhoto(
        imageId
      ))
  {
    Serial.println(
      "ERRO: nao foi possivel registrar historico."
    );

    return;
  }


  // ============================================================
  // REGISTRAR STATE FIREBASE
  // ============================================================

  if (!writeStateFirebase())
  {
    Serial.println(
      "ERRO: nao foi possivel registrar state Firebase."
    );

    return;
  }
  

  // ============================================================
  // FINAL
  // ============================================================

  Serial.println(
    "END Sync"
  );
}


void next()
{
  Serial.println(
    "=== NEXT ==="
  );
}


void info()
{
  Serial.println(
    "=== INFO ==="
  );

  // TODO:
  // - identificar a foto atual
  // - ler a descricao local
  // - mostrar a descricao no e-paper
}


void wifi()
{
  Serial.println(
    "=== WIFI ==="
  );

  firebase.begin(
    API_KEY,
    STORAGE_BUCKET_ID,
    Serial
  );

  if (wifiManager.startConfiguration())
  {
    sync();
  }
}

// ============================================================
// SETUP
// ============================================================

void setup()
{
  Serial.begin(115200);

  wifiManager.setFirebaseManager(firebase);

  delay(1000);

  pinMode(
    BUTTON_SYNC,
    INPUT_PULLUP
  );

  pinMode(
    BUTTON_NEXT,
    INPUT_PULLUP
  );

  pinMode(
    BUTTON_INFO,
    INPUT_PULLUP
  );

  pinMode(
    BUTTON_WIFI,
    INPUT_PULLUP
  );

  pinMode(
    EPD_BUSY,
    INPUT
  );

  pinMode(
    EPD_RST,
    OUTPUT
  );

  pinMode(
    EPD_DC,
    OUTPUT
  );

  pinMode(
    EPD_CS,
    OUTPUT
  );

  digitalWrite(
    EPD_CS,
    HIGH
  );

  Serial.println();

  Serial.println(
    "=== QUADRO E-INK ==="
  );

  esp_sleep_wakeup_cause_t reason =
    esp_sleep_get_wakeup_cause();


  // ============================================================
  // MOTIVO DO WAKE
  // ============================================================

  switch (reason)
  {
    case ESP_SLEEP_WAKEUP_EXT1:

      Serial.println(
        "Acordou pelo botao 3 / GPIO9."
      );

      break;


    case ESP_SLEEP_WAKEUP_TIMER:

      Serial.println(
        "Acordou pelo TIMER."
      );

      break;


    case ESP_SLEEP_WAKEUP_UNDEFINED:

      Serial.println(
        "Boot normal."
      );

      break;


    default:

      Serial.print(
        "Outro motivo de wake: "
      );

      Serial.println(
        reason
      );

      break;
  }


  // ============================================================
  // BOOT NORMAL
  // ============================================================

  if (reason == ESP_SLEEP_WAKEUP_UNDEFINED)
  {
    sync();
  }


  // ============================================================
  // ACORDOU PELO TIMER
  // ============================================================

  else if (
    reason == ESP_SLEEP_WAKEUP_TIMER
  )
  {
    sync();
  }


  // ============================================================
  // ACORDOU PELO BOTAO 3 / NEXT
  // ============================================================

  else if (
    reason == ESP_SLEEP_WAKEUP_EXT1
  )
  {
    Serial.println();

    Serial.println(
      "Solte o botao 3..."
    );

    waitButtonRelease(
      BUTTON_NEXT
    );

    Serial.println(
      "Botao 3 solto."
    );

    Serial.println(
      "Agora aperte o segundo botao:"
    );

    bool actionDetected = false;

    unsigned long startTime =
      millis();

    while (!actionDetected)
    {
      if (
        digitalRead(BUTTON_SYNC) ==
        LOW
      )
      {
        Serial.println(
          "SYNC"
        );

        sync();

        actionDetected = true;
      }

      else if (
        digitalRead(BUTTON_NEXT) ==
        LOW
      )
      {
        Serial.println(
          "NEXT"
        );

        next();

        actionDetected = true;
      }

      else if (
        digitalRead(BUTTON_INFO) ==
        LOW
      )
      {
        Serial.println(
          "INFO"
        );

        info();

        actionDetected = true;
      }

      else if (
        digitalRead(BUTTON_WIFI) ==
        LOW
      )
      {
        Serial.println(
          "WIFI"
        );

        wifi();

        actionDetected = true;
      }

      if (
        millis() - startTime >=
        10000
      )
      {
        Serial.println(
          "Timeout aguardando segundo botao."
        );

        break;
      }

      delay(20);
    }
  }


  // ============================================================
  // DEEP SLEEP
  // ============================================================

  esp_sleep_enable_ext1_wakeup_io(
    (1ULL << BUTTON_NEXT),
    ESP_EXT1_WAKEUP_ANY_LOW
  );

  delay(2000); // IMPORTANTE!!! NÃO RETIRAR

  Serial.flush();

  uint32_t updateIntervalMinutes;

  if (!sd.getUpdateIntervalMinutes(updateIntervalMinutes))
  {
    updateIntervalMinutes = 120;
  }

  Serial.println();
  Serial.println(
    "Entrando em deep sleep por " +
    String(updateIntervalMinutes) +
    " minutos..."
  );

  esp_sleep_enable_timer_wakeup(
    (uint64_t)updateIntervalMinutes * 60ULL * 1000000ULL
  );

  delay(500);

  esp_deep_sleep_start();

  Serial.println(
    "END Setup"
  );
}


void loop()
{
}