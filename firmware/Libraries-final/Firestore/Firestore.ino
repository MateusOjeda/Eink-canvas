#include <WiFi.h>
#include <SPI.h>
#include <time.h>

#include "SDManager.h"
#include "FirebaseManager.h"
#include "WiFiManager.h"
#include "TextRenderer.h"

#include "Display_EPD_W21.h"
#include "Display_EPD_W21_spi.h"

#define EPD_CS   2
#define EPD_DC   3
#define EPD_RST  4
#define EPD_BUSY 5
#define EPD_SCK  12
#define EPD_MOSI 11

#define IMAGE_SIZE 192000

#define API_KEY "AIzaSyCzNPNS0mugUk31NpC1XGKKZjR6qQPHF50"

#define STORAGE_BUCKET_ID "einkcanvas.firebasestorage.app"

SDManager sd;
FirebaseManager firebase;
FirebaseJson stateJson;
FirebaseJson displayJson;
WiFiManager wifiManager;
TextRenderer textRenderer;

uint32_t nextSleepMinutes = 0;

#define BUTTON_SYNC  46  // Botao 2
#define BUTTON_NEXT   9  // Botao 3 - acorda o ESP
#define BUTTON_INFO  41  // Botao 12
#define BUTTON_WIFI  42  // Botao 11

#define displayRatePeriod 120


// ============================================================
// FUNCOES DE APOIO
// ============================================================

uint32_t minutesUntilNextDay()
{
  time_t now = time(nullptr);

  struct tm* timeinfo = localtime(&now);

  timeinfo->tm_hour = 0;
  timeinfo->tm_min = 0;
  timeinfo->tm_sec = 0;

  time_t nextDay =
    mktime(timeinfo) + 24 * 60 * 60;

  uint32_t seconds =
    (uint32_t)(nextDay - now);

  return (seconds + 59) / 60;
}

bool canUpdateDisplay()
{
  if (!sd.exists("/display.json"))
  {
    return true;
  }

  uint64_t fileSize = sd.size("/display.json");

  if (fileSize == 0)
  {
    return true;
  }

  char* buffer = new char[fileSize + 1];

  if (!buffer)
  {
    Serial.println("Erro ao alocar memoria para /display.json");
    return true;
  }

  size_t bytesRead = sd.read(
    "/display.json",
    (uint8_t*)buffer,
    fileSize
  );

  buffer[bytesRead] = '\0';

  FirebaseJson json;
  json.setJsonData(buffer);

  delete[] buffer;

  FirebaseJsonData data;

  if (!json.get(data, "lastUpdatedAt"))
  {
    return true;
  }

  String lastUpdatedAt = data.stringValue;

  if (lastUpdatedAt.length() == 0)
  {
    return true;
  }

  time_t lastUpdate = parseTimestamp(lastUpdatedAt);
  time_t now = time(nullptr);

  if (lastUpdate <= 0 || now <= 0)
  {
    Serial.println("Nao foi possivel validar horario do display");
    return true;
  }

  time_t elapsed = now - lastUpdate;

  Serial.printf(
    "Ultimo update do display: %ld segundos atras\n",
    (long)elapsed
  );

  if (elapsed < displayRatePeriod)
  {
    Serial.printf(
      "Display bloqueado. Faltam %ld segundos.\n",
      (long)(displayRatePeriod - elapsed)
    );

    return false;
  }

  return true;
}


bool recordDisplayUpdate()
{
  String timestamp = getCurrentTimestamp();

  if (timestamp.length() == 0)
  {
    Serial.println("Nao foi possivel obter timestamp do display");
    return false;
  }

  displayJson.clear();
  displayJson.set("lastUpdatedAt", timestamp);

  String output;
  displayJson.toString(output, false);

  if (sd.exists("/display.json"))
  {
    sd.remove("/display.json");
  }

  bool success = sd.write(
    "/display.json",
    (const uint8_t*)output.c_str(),
    output.length()
  );

  if (!success)
  {
    Serial.println("Nao foi possivel salvar /display.json");
    return false;
  }

  Serial.println("Display atualizado em:");
  Serial.println(timestamp);

  return true;
}


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

bool displayTextScreen(const String& text)
{
  if (!canUpdateDisplay())
  {
    Serial.println(
      "INFO: atualizacao bloqueada. Menos de 3 minutos desde a ultima atualizacao."
    );

    return false;
  }

  const int width = 800;
  const int height = 480;

  uint8_t* imageData =
    (uint8_t*)malloc(IMAGE_SIZE);

  if (imageData == nullptr)
  {
    Serial.println(
      "INFO: nao foi possivel reservar memoria."
    );

    return false;
  }

  if (!textRenderer.render(
        imageData,
        width,
        height,
        text,
        black,
        white
      ))
  {
    Serial.println(
      "INFO: erro ao renderizar texto."
    );

    free(imageData);

    return false;
  }

  SPI.end();

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

  EPD_init_fast();

  EPD_W21_WriteCMD(0x10);

  for (int i = 0; i < IMAGE_SIZE; i++)
  {
    EPD_W21_WriteDATA(
      imageData[i]
    );
  }

  EPD_W21_WriteCMD(0x12);

  EPD_W21_WriteDATA(0x00);

  delay(1);

  lcd_chkstatus();

  EPD_sleep();

  SPI.endTransaction();
  SPI.end();

  free(imageData);

  if (!sd.begin(Serial))
  {
    Serial.println(
      "INFO: erro ao reinicializar SD."
    );

    return false;
  }

  recordDisplayUpdate();

  Serial.println(
    "INFO: tela exibida."
  );

  return true;
}


bool displayImageFromSD(
  const char* filename
)
{
  if (!canUpdateDisplay())
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
      "ERRO: nao foi possivel inicializar o SD."
    );

    free(imageData);

    return false;
  }

  recordDisplayUpdate();

  free(imageData);

  Serial.println(
    "Memoria liberada."
  );

  return true;
}


bool showPhoto(
  const String& imageId,
  const String& epaperFilePath
)
{
  Serial.println("=== SHOW PHOTO ===");

  String localPath =
    "/" + imageId + ".bin";

  Serial.print("Arquivo local: ");
  Serial.println(localPath);


  // ============================================================
  // VERIFICAR ARQUIVO LOCAL
  // ============================================================

  bool needsDownload = true;

  if (sd.exists(localPath.c_str()))
  {
    uint64_t localSize =
      sd.size(localPath.c_str());

    Serial.print(
      "Imagem ja existe no SD. Tamanho: "
    );

    Serial.print(localSize);

    Serial.println(
      " bytes"
    );

    if (localSize == IMAGE_SIZE)
    {
      needsDownload = false;

      Serial.println(
        "Imagem local valida."
      );
    }
    else
    {
      Serial.println(
        "Imagem local incompleta ou corrompida."
      );

      Serial.println(
        "Removendo arquivo para baixar novamente..."
      );

      if (!sd.remove(localPath.c_str()))
      {
        Serial.println(
          "ERRO: nao foi possivel remover arquivo invalido."
        );

        return false;
      }
    }
  }
  else
  {
    Serial.println(
      "Imagem nao encontrada no SD."
    );
  }


  // ============================================================
  // DOWNLOAD
  // ============================================================

  if (needsDownload)
  {
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
      "Download concluido."
    );


    // ==========================================================
    // VALIDAR DOWNLOAD
    // ==========================================================

    if (!sd.exists(localPath.c_str()))
    {
      Serial.println(
        "ERRO: arquivo nao apareceu no SD apos download."
      );

      return false;
    }

    uint64_t downloadedSize =
      sd.size(localPath.c_str());

    Serial.print(
      "Tamanho apos download: "
    );

    Serial.print(
      downloadedSize
    );

    Serial.println(
      " bytes"
    );

    if (downloadedSize != IMAGE_SIZE)
    {
      Serial.println(
        "ERRO: download incompleto ou invalido."
      );

      Serial.println(
        "Removendo arquivo invalido."
      );

      sd.remove(localPath.c_str());

      return false;
    }

    Serial.println(
      "Download validado."
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
// INFO - OBTER DESCRICAO DA IMAGEM ATUAL
// ============================================================

bool getCurrentImageDescription(
  String& description,
  const String& photosJsonString
)
{
  description = "";

  FirebaseJsonData currentImageData;

  if (!stateJson.get(
        currentImageData,
        "currentImageId"
      ))
  {
    Serial.println(
      "INFO: currentImageId nao encontrado."
    );

    return false;
  }

  String currentImageId =
    currentImageData.to<String>();

  if (currentImageId.length() == 0)
  {
    Serial.println(
      "INFO: nenhuma imagem atual."
    );

    return false;
  }

  Serial.print(
    "INFO: imagem atual: "
  );

  Serial.println(
    currentImageId
  );


  // ============================================================
  // PHOTOS
  // ============================================================

  FirebaseJson photosJson;

  if (!photosJson.setJsonData(
        photosJsonString
      ))
  {
    Serial.println(
      "INFO: dados de photos invalidos."
    );

    return false;
  }


  // ============================================================
  // COLLECTIONS
  // ============================================================

  FirebaseJsonData collectionsData;

  if (!photosJson.get(
        collectionsData,
        "collections"
      ))
  {
    Serial.println(
      "INFO: collections nao encontrado."
    );

    return false;
  }

  FirebaseJsonArray collections;

  if (!collectionsData.getArray(
        collections
      ))
  {
    Serial.println(
      "INFO: erro ao ler collections."
    );

    return false;
  }


  // ============================================================
  // PROCURAR IMAGEM
  // ============================================================

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

    FirebaseJsonData imagesData;

    if (!collection.get(
          imagesData,
          "images"
        ))
    {
      continue;
    }

    FirebaseJsonArray images;

    if (!imagesData.getArray(
          images
        ))
    {
      continue;
    }


    // ==========================================================
    // PROCURAR IMAGEM DENTRO DA COLECAO
    // ==========================================================

    for (
      size_t j = 0;
      j < images.size();
      j++
    )
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

      if (!imageData.getJSON(
            image
          ))
      {
        continue;
      }

      FirebaseJsonData imageIdData;

      if (!image.get(
            imageIdData,
            "id"
          ))
      {
        continue;
      }

      String imageId =
        imageIdData.to<String>();

      if (imageId != currentImageId)
      {
        continue;
      }


      // ========================================================
      // ENCONTRAMOS A IMAGEM
      // ========================================================

      FirebaseJsonData descriptionData;

      if (!image.get(
            descriptionData,
            "description"
          ))
      {
        Serial.println(
          "INFO: imagem nao possui campo description."
        );

        return false;
      }

      description =
        descriptionData.to<String>();

      if (description.length() == 0)
      {
        Serial.println(
          "INFO: campo description esta vazio."
        );

        return false;
      }

      Serial.println(
        "INFO: descricao encontrada:"
      );

      Serial.println(
        description
      );

      return true;
    }
  }

  Serial.println(
    "INFO: imagem atual nao encontrada em photos."
  );

  return false;
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
// CHOOSE PRIORITY PHOTO
// ============================================================

bool choosePriorityPhoto(
  String& outputImageId,
  String& outputEpaperFilePath,
  const String& priorityCollectionId,
  const String& priorityImageId,
  bool hasPriority,
  const String& photosJsonString
)
{
  outputImageId = "";
  outputEpaperFilePath = "";

  if (!hasPriority)
  {
    return false;
  }

  Serial.println(
    "=== CHOOSE PRIORITY PHOTO ==="
  );


  // ============================================================
  // CONFIG
  // ============================================================

  uint64_t configFileSize =
    sd.size("/config.json");

  if (configFileSize == 0)
  {
    Serial.println(
      "PRIORITY: /config.json nao existe ou esta vazio."
    );

    return false;
  }

  uint8_t* configBuffer =
    new uint8_t[configFileSize + 1];

  if (!configBuffer)
  {
    Serial.println(
      "PRIORITY: erro ao alocar memoria."
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
      "PRIORITY: config JSON invalido."
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
      "PRIORITY: orientation nao encontrado."
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
      "PRIORITY: orientation invalida."
    );

    return false;
  }


  // ============================================================
  // PHOTOS
  // ============================================================

  FirebaseJson photosJson;

  if (!photosJson.setJsonData(
        photosJsonString
      ))
  {
    Serial.println(
      "PRIORITY: dados de photos invalidos."
    );

    return false;
  }

  FirebaseJsonData collectionsData;

  if (!photosJson.get(
        collectionsData,
        "collections"
      ))
  {
    Serial.println(
      "PRIORITY: collections nao encontrado."
    );

    return false;
  }

  FirebaseJsonArray collections;

  if (!collectionsData.getArray(
        collections
      ))
  {
    Serial.println(
      "PRIORITY: erro ao ler collections."
    );

    return false;
  }


  // ============================================================
  // PROCURAR COLECAO DA PRIORIDADE
  // ============================================================

  for (size_t i = 0;
       i < collections.size();
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

    String collectionId =
      collectionIdData.to<String>();

    if (collectionId !=
        priorityCollectionId)
    {
      continue;
    }

    if (!collection.get(
          collectionActiveData,
          "active"
        ))
    {
      Serial.println(
        "PRIORITY: colecao sem campo active."
      );

      return false;
    }

    if (!collectionActiveData.to<bool>())
    {
      Serial.println(
        "PRIORITY: colecao inativa."
      );

      return false;
    }

    if (!collection.get(
          imagesData,
          "images"
        ))
    {
      Serial.println(
        "PRIORITY: images nao encontrado."
      );

      return false;
    }

    FirebaseJsonArray images;

    if (!imagesData.getArray(images))
    {
      Serial.println(
        "PRIORITY: erro ao ler images."
      );

      return false;
    }


    // ==========================================================
    // PROCURAR IMAGEM DA PRIORIDADE
    // ==========================================================

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

      String imageId =
        imageIdData.to<String>();

      if (imageId !=
          priorityImageId)
      {
        continue;
      }

      if (!image.get(
            activeData,
            "active"
          ))
      {
        Serial.println(
          "PRIORITY: imagem sem campo active."
        );

        return false;
      }

      if (!activeData.to<bool>())
      {
        Serial.println(
          "PRIORITY: imagem inativa."
        );

        return false;
      }

      if (!image.get(
            widthData,
            "width"
          ))
      {
        Serial.println(
          "PRIORITY: imagem sem width."
        );

        return false;
      }

      if (!image.get(
            heightData,
            "height"
          ))
      {
        Serial.println(
          "PRIORITY: imagem sem height."
        );

        return false;
      }

      if (widthData.to<int>() !=
          requiredWidth ||
          heightData.to<int>() !=
          requiredHeight)
      {
        Serial.println(
          "PRIORITY: dimensao incompativel."
        );

        return false;
      }

      if (!image.get(
            epaperFilePathData,
            "epaperFilePath"
          ))
      {
        Serial.println(
          "PRIORITY: imagem sem epaperFilePath."
        );

        return false;
      }


      // ========================================================
      // RESULTADO
      // ========================================================

      outputImageId =
        imageId;

      outputEpaperFilePath =
        epaperFilePathData.to<String>();

      stateJson.set(
        "lastCollectionId",
        collectionId
      );

      Serial.println(
        "=== FOTO PRIORITARIA ESCOLHIDA ==="
      );

      Serial.print(
        "Collection ID: "
      );

      Serial.println(
        collectionId
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
      "PRIORITY: imagem nao encontrada na colecao."
    );

    return false;
  }


  // ============================================================
  // COLECAO NAO ENCONTRADA
  // ============================================================

  Serial.println(
    "PRIORITY: colecao nao encontrada."
  );

  return false;
}


// ============================================================
// CHOOSE TEMPORARY PHOTO
// ============================================================

bool chooseTemporaryPhoto(
  String& outputImageId,
  String& outputEpaperFilePath,
  const String& temporaryPhotosJsonString
)
{
  outputImageId = "";
  outputEpaperFilePath = "";

  Serial.println("=== CHOOSE TEMPORARY PHOTO ===");

  // =========================================================
  // CONFIG
  // =========================================================

  if (!sd.exists("/config.json"))
  {
    Serial.println(
      "TEMPORARY: /config.json não existe."
    );

    return false;
  }

  uint64_t configSize = sd.size(
    "/config.json"
  );

  if (configSize == 0)
  {
    Serial.println(
      "TEMPORARY: /config.json está vazio."
    );

    return false;
  }

  uint8_t* configBuffer =
    new uint8_t[configSize + 1];

  if (!configBuffer)
  {
    Serial.println(
      "TEMPORARY: erro de memória."
    );

    return false;
  }

  size_t configRead = sd.read(
    "/config.json",
    configBuffer,
    configSize
  );

  if (configRead != configSize)
  {
    delete[] configBuffer;

    Serial.println(
      "TEMPORARY: erro ao ler /config.json."
    );

    return false;
  }

  configBuffer[configRead] = '\0';

  String configJson =
    String((char*)configBuffer);

  delete[] configBuffer;

  FirebaseJson config;
  config.setJsonData(configJson);

  FirebaseJsonData configData;

  if (!config.get(
        configData,
        "orientation"
      ))
  {
    Serial.println(
      "TEMPORARY: orientation não encontrada."
    );

    return false;
  }

  String orientation =
    configData.to<String>();

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
      "TEMPORARY: orientation invalida."
    );

    return false;
  }

  // =========================================================
  // TEMPORARY PHOTOS
  // =========================================================

  FirebaseJson json;

  if (!json.setJsonData(
        temporaryPhotosJsonString
      ))
  {
    Serial.println(
      "TEMPORARY: dados de temporaryPhotos invalidos."
    );

    return false;
  }

  FirebaseJsonData photosData;

  if (!json.get(
        photosData,
        "temporaryPhotos"
      ))
  {
    Serial.println(
      "TEMPORARY: lista temporaryPhotos não encontrada."
    );

    return false;
  }

  FirebaseJsonArray photos;

  if (!photosData.getArray(photos))
  {
    Serial.println(
      "TEMPORARY: erro ao ler temporaryPhotos."
    );

    return false;
  }

  // =========================================================
  // DATA ATUAL
  // =========================================================

  time_t now = time(nullptr);

  struct tm* currentTime =
    localtime(&now);

  if (currentTime == nullptr)
  {
    Serial.println(
      "TEMPORARY: não foi possível obter data atual."
    );

    return false;
  }

  int currentMonth =
    currentTime->tm_mon + 1;

  int currentDay =
    currentTime->tm_mday;

  int currentYear =
    currentTime->tm_year + 1900;

  // =========================================================
  // ONCE
  // =========================================================

  bool foundOnce = false;

  time_t oldestOnceCreatedAt = 0;

  String selectedOnceId;
  String selectedOncePath;

  uint32_t selectedOnceDurationMinutes = 0;

  for (size_t i = 0; i < photos.size(); i++)
  {
    FirebaseJsonData itemData;

    if (!photos.get(itemData, i))
      continue;

    FirebaseJson item;

    item.setJsonData(
      itemData.to<String>()
    );

    FirebaseJsonData data;

    if (!item.get(
          data,
          "recurrence"
        ))
      continue;

    String recurrence =
      data.to<String>();

    if (recurrence != "once")
      continue;

    if (!item.get(
          data,
          "id"
        ))
      continue;

    String imageId =
      data.to<String>();

    if (item.get(
          data,
          "consumedAt"
        ))
    {
      Serial.print(
        "TEMPORARY: ONCE ja consumida: "
      );

      Serial.println(
        imageId
      );

      continue;
    }

    if (!item.get(
          data,
          "durationMinutes"
        ))
      continue;

    uint32_t durationMinutes =
      data.to<uint32_t>();

    if (!item.get(
          data,
          "epaperFilePath"
        ))
      continue;

    String epaperFilePath =
      data.to<String>();

    if (!item.get(
          data,
          "width"
        ))
      continue;

    int width =
      data.to<int>();

    if (!item.get(
          data,
          "height"
        ))
      continue;

    int height =
      data.to<int>();

    if (
      width != requiredWidth ||
      height != requiredHeight
    )
    {
      continue;
    }

    if (!item.get(
          data,
          "createdAt"
        ))
      continue;

    String createdAt =
      data.to<String>();

    time_t createdTimestamp =
      parseTimestamp(createdAt);

    if (createdTimestamp <= 0)
      continue;

    if (
      !foundOnce ||
      createdTimestamp < oldestOnceCreatedAt
    )
    {
      foundOnce = true;

      oldestOnceCreatedAt =
        createdTimestamp;

      selectedOnceId =
        imageId;

      selectedOncePath =
        epaperFilePath;

      selectedOnceDurationMinutes =
        durationMinutes;
    }
  }

  if (foundOnce)
  {
    nextSleepMinutes =
      selectedOnceDurationMinutes;

    outputImageId =
      selectedOnceId;

    outputEpaperFilePath =
      selectedOncePath;

    Serial.println(
      "TEMPORARY: encontrada ONCE válida."
    );

    Serial.print(
      "TEMPORARY: imageId = "
    );

    Serial.println(
      outputImageId
    );

    Serial.print(
      "TEMPORARY: durationMinutes = "
    );

    Serial.println(
      selectedOnceDurationMinutes
    );

    Serial.println(
      "TEMPORARY: escolhendo ONCE mais antiga."
    );

    return true;
  }

  // =========================================================
  // YEARLY
  // =========================================================

  bool foundYearly = false;

  time_t newestYearlyCreatedAt = 0;

  String selectedYearlyId;
  String selectedYearlyPath;

  for (size_t i = 0; i < photos.size(); i++)
  {
    FirebaseJsonData itemData;

    if (!photos.get(itemData, i))
      continue;

    FirebaseJson item;

    item.setJsonData(
      itemData.to<String>()
    );

    FirebaseJsonData data;

    if (!item.get(
          data,
          "recurrence"
        ))
      continue;

    String recurrence =
      data.to<String>();

    if (recurrence != "yearly")
      continue;

    if (!item.get(
          data,
          "id"
        ))
      continue;

    String imageId =
      data.to<String>();

    if (item.get(
          data,
          "consumedAt"
        ))
    {
      String consumedAt =
        data.to<String>();

      time_t consumedTimestamp =
        parseTimestamp(consumedAt);

      if (consumedTimestamp > 0)
      {
        struct tm* consumedTime =
          gmtime(&consumedTimestamp);

        if (
          consumedTime != nullptr &&
          (consumedTime->tm_year + 1900) ==
          currentYear
        )
        {
          Serial.print(
            "TEMPORARY: YEARLY ja consumida neste ano: "
          );

          Serial.println(
            imageId
          );

          continue;
        }
      }
    }

    if (!item.get(
          data,
          "epaperFilePath"
        ))
      continue;

    String epaperFilePath =
      data.to<String>();

    if (!item.get(
          data,
          "width"
        ))
      continue;

    int width =
      data.to<int>();

    if (!item.get(
          data,
          "height"
        ))
      continue;

    int height =
      data.to<int>();

    if (
      width != requiredWidth ||
      height != requiredHeight
    )
    {
      continue;
    }

    if (!item.get(
          data,
          "yearlyDate/month"
        ))
      continue;

    int month =
      data.to<int>();

    if (!item.get(
          data,
          "yearlyDate/day"
        ))
      continue;

    int day =
      data.to<int>();

    if (
      month != currentMonth ||
      day != currentDay
    )
    {
      continue;
    }

    if (!item.get(
          data,
          "createdAt"
        ))
      continue;

    String createdAt =
      data.to<String>();

    time_t createdTimestamp =
      parseTimestamp(createdAt);

    if (createdTimestamp <= 0)
      continue;

    if (
      !foundYearly ||
      createdTimestamp > newestYearlyCreatedAt
    )
    {
      foundYearly = true;

      newestYearlyCreatedAt =
        createdTimestamp;

      selectedYearlyId =
        imageId;

      selectedYearlyPath =
        epaperFilePath;
    }
  }

  if (foundYearly)
  {
    outputImageId =
      selectedYearlyId;

    outputEpaperFilePath =
      selectedYearlyPath;

    Serial.println(
      "TEMPORARY: encontrada YEARLY válida para hoje."
    );

    Serial.print(
      "TEMPORARY: imageId = "
    );

    Serial.println(
      outputImageId
    );

    Serial.println(
      "TEMPORARY: escolhendo YEARLY mais recente."
    );

    nextSleepMinutes =
      minutesUntilNextDay();

    Serial.print(
      "TEMPORARY: YEARLY selecionada. Dormindo por "
    );

    Serial.print(
      nextSleepMinutes
    );

    Serial.println(
      " minutos."
    );

    return true;
  }

  // =========================================================
  // NENHUMA TEMPORARIA
  // =========================================================

  Serial.println(
    "TEMPORARY: nenhuma foto temporária válida."
  );

  return false;
}


// ============================================================
// ESCOLHER PROXIMA FOTO
// ============================================================

bool chooseNextPhoto(
  String& outputImageId,
  String& outputEpaperFilePath,
  const String& photosJsonString
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

  FirebaseJson photosJson;

  if (!photosJson.setJsonData(
        photosJsonString
      ))
  {
    Serial.println(
      "PHOTOS: dados de photos invalidos."
    );

    return false;
  }

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


    if (historyPosition < 0)
    {
      selectedImageIndex = i;

      selectedImageHistoryPosition = -1;

      break;
    }


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
// CHOOSE DISPLAY PHOTO - choice logic
// ============================================================

bool chooseDisplayPhoto(
  String& outputImageId,
  String& outputEpaperFilePath,
  const String& priorityCollectionId,
  const String& priorityImageId,
  bool hasPriority,
  bool& outputIsTemporary,
  const String& photosJson,
  const String& temporaryPhotosJson
)
{
  outputImageId = "";
  outputEpaperFilePath = "";
  outputIsTemporary = false;

  Serial.println(
    "=== CHOOSE DISPLAY PHOTO ==="
  );

  // PRIORIDADE
  if (choosePriorityPhoto(
        outputImageId,
        outputEpaperFilePath,
        priorityCollectionId,
        priorityImageId,
        hasPriority,
        photosJson
      ))
  {
    Serial.println(
      "DISPLAY: usando foto PRIORITARIA."
    );

    return true;
  }

  // TEMPORARIA
  if (chooseTemporaryPhoto(
        outputImageId,
        outputEpaperFilePath,
        temporaryPhotosJson
      ))
  {
    outputIsTemporary = true;

    Serial.println(
      "DISPLAY: usando foto TEMPORARIA."
    );

    return true;
  }

  // NORMAL
  Serial.println(
    "DISPLAY: nenhuma prioridade ou temporaria valida."
  );

  if (chooseNextPhoto(
        outputImageId,
        outputEpaperFilePath,
        photosJson
      ))
  {
    Serial.println(
      "DISPLAY: usando foto NORMAL."
    );

    return true;
  }

  Serial.println(
    "DISPLAY: nenhuma foto disponivel."
  );

  return false;
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

  Serial.println(
    "Conectando ao Wi-Fi salvo..."
  );

  if (!wifiManager.connectToSavedWiFi())
  {
    Serial.println(
      "ERRO: nao foi possivel conectar ao Wi-Fi salvo."
    );

    return;
  }

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
      "ERRO: nao foi possivel inicializar o SD."
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

  Serial.println(
    "PHOTOS: dados mantidos em RAM."
  );


  // ============================================================
  // PRIORIDADE
  // ============================================================

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
  // FIRESTORE - TEMP PHOTOS
  // ============================================================

  Serial.println();

  Serial.println(
    "=== SINCRONIZANDO TEMP PHOTOS ==="
  );

  String temporaryPhotosJson;

  if (!firebase.syncTemporaryPhotos(
        deviceId.c_str(),
        temporaryPhotosJson
      ))
  {
    Serial.println(
      "ERRO: não foi possível sincronizar temp photos."
    );

    return;
  }

  Serial.println(
    "TEMP PHOTOS: dados mantidos em RAM."
  );


  // ============================================================
  // REMOVER CACHES ANTIGOS
  // ============================================================

  if (sd.exists("/photos.json"))
  {
    if (sd.remove("/photos.json"))
    {
      Serial.println(
        "Removido /photos.json antigo."
      );
    }
  }

  if (sd.exists("/temporaryPhotos.json"))
  {
    if (sd.remove("/temporaryPhotos.json"))
    {
      Serial.println(
        "Removido /temporaryPhotos.json antigo."
      );
    }
  }


  // ============================================================
  // ESCOLHER FOTO
  // ============================================================

  String imageId;
  String epaperFilePath;
  bool isTemporary = false;

  if (!chooseDisplayPhoto(
        imageId,
        epaperFilePath,
        priorityCollectionId,
        priorityImageId,
        hasPriority,
        isTemporary,
        photosJson,
        temporaryPhotosJson
      ))
  {
    Serial.println(
      "SYNC: nenhuma foto disponivel."
    );

    return;
  }


  // ============================================================
  // MOSTRAR FOTO
  // ============================================================

  if (!showPhoto(
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
  // CONSUMIR FOTO TEMPORARIA
  // ============================================================

  if (isTemporary)
  {
    Serial.println(
      "TEMPORARY: foto temporaria exibida."
    );

    Serial.println(
      "TEMPORARY: marcando como consumida."
    );

    String consumedAt = getCurrentTimestamp();

    if (!firebase.markTemporaryPhotoConsumed(
          deviceId.c_str(),
          imageId.c_str(),
          consumedAt.c_str()
        ))
    {
      Serial.println("SYNC: erro ao marcar temporary como consumida.");
      return;
    }

    Serial.println(
      "TEMPORARY: foto marcada como consumida."
    );
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


  // ============================================================
  // WI-FI
  // ============================================================

  Serial.println(
    "INFO: conectando ao Wi-Fi salvo..."
  );

  if (!wifiManager.connectToSavedWiFi())
  {
    Serial.println(
      "INFO: nao foi possivel conectar ao Wi-Fi."
    );

    return;
  }

  Serial.println(
    "INFO: Wi-Fi conectado."
  );


  // ============================================================
  // HORARIO
  // ============================================================

  if (!syncClock())
  {
    return;
  }


  // ============================================================
  // INICIALIZAR SD
  // ============================================================

  if (!sd.begin(Serial))
  {
    Serial.println(
      "INFO: nao foi possivel inicializar o SD."
    );

    return;
  }


  // ============================================================
  // CARREGAR STATE
  // ============================================================

  if (!loadState())
  {
    Serial.println(
      "INFO: nao foi possivel carregar state."
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
  {
    Serial.println(
      "INFO: autenticacao Firebase falhou."
    );

    return;
  }


  // ============================================================
  // PHOTOS
  // ============================================================

  String deviceId =
    WiFi.macAddress();

  String photosJson;

  Serial.println(
    "INFO: sincronizando photos..."
  );

  if (!firebase.syncPhotos(
        deviceId.c_str(),
        photosJson
      ))
  {
    Serial.println(
      "INFO: nao foi possivel sincronizar photos."
    );

    return;
  }

  Serial.println(
    "INFO: photos sincronizadas em RAM."
  );


  // ============================================================
  // OBTER DESCRICAO
  // ============================================================

  String description;

  if (!getCurrentImageDescription(
        description,
        photosJson
      ))
  {
    description =
      "Esta imagem nao tem descricao.";
  }


  // ============================================================
  // MOSTRAR DESCRICAO
  // ============================================================

  if (!displayTextScreen(
        description
      ))
  {
    Serial.println(
      "INFO: nao foi possivel mostrar descricao."
    );

    return;
  }


  // ============================================================
  // AGUARDAR 3 MINUTOS
  // ============================================================

  Serial.println(
    "INFO: descricao exibida."
  );

  Serial.println(
    "INFO: aguardando 3 minutos antes de restaurar a imagem."
  );

  delay(displayRatePeriod * 1000);


  // ============================================================
  // OBTER NOVAMENTE A IMAGEM ATUAL
  // ============================================================

  FirebaseJsonData currentImageData;

  if (!stateJson.get(
        currentImageData,
        "currentImageId"
      ))
  {
    Serial.println(
      "INFO: currentImageId nao encontrado."
    );

    return;
  }

  String currentImageId =
    currentImageData.to<String>();

  if (currentImageId.length() == 0)
  {
    Serial.println(
      "INFO: nenhuma imagem atual."
    );

    return;
  }


  // ============================================================
  // RESTAURAR IMAGEM
  // ============================================================

  String imagePath =
    "/" + currentImageId + ".bin";

  Serial.println(
    "INFO: restaurando imagem original."
  );

  if (!displayImageFromSD(
        imagePath.c_str()
      ))
  {
    Serial.println(
      "INFO: nao foi possivel restaurar a imagem."
    );

    return;
  }

  Serial.println(
    "INFO: imagem original restaurada."
  );
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

        actionDetected = true;

        sync();
      }

      else if (
        digitalRead(BUTTON_NEXT) ==
        LOW
      )
      {
        Serial.println(
          "NEXT"
        );

        actionDetected = true;

        next();
      }

      else if (
        digitalRead(BUTTON_INFO) ==
        LOW
      )
      {
        Serial.println(
          "INFO"
        );

        actionDetected = true;

        info();
      }

      else if (
        digitalRead(BUTTON_WIFI) ==
        LOW
      )
      {
        Serial.println(
          "WIFI"
        );

        actionDetected = true;

        wifi();
      }

      if (
        !actionDetected &&
        millis() - startTime >= 10000
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

  uint32_t sleepMinutes =
    updateIntervalMinutes;

  if (nextSleepMinutes > 0)
  {
    sleepMinutes =
      nextSleepMinutes;
  }

  Serial.println();
  Serial.println(
    "Entrando em deep sleep por " +
    String(sleepMinutes) +
    " minutos..."
  );

  esp_sleep_enable_timer_wakeup(
    (uint64_t)sleepMinutes * 60ULL * 1000000ULL
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