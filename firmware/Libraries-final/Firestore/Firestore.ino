#include <WiFi.h>
#include <SPI.h>
#include <time.h>
#include <HTTPClient.h>
#include <sys/time.h>
#include <esp_heap_caps.h>
#include <Preferences.h>

#include "SDManager.h"
#include "FirebaseManager.h"
#include "WiFiManager.h"
#include "TextRenderer.h"

#include "Display_EPD_W21.h"
#include "Display_EPD_W21_spi.h"

#define EPD_CS 2
#define EPD_DC 3
#define EPD_RST 4
#define EPD_BUSY 5
#define EPD_SCK 12
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
String deviceId;

#define BUTTON_SYNC 46 // Botao 2
#define BUTTON_3 9     // Botao 3 - acorda o ESP
#define BUTTON_INFO 41 // Botao 12
#define BUTTON_WIFI 42 // Botao 11

#define displayRatePeriod 120

// O registro de erros nao usa cartao SD nem depende de horario/rede.
// O unico registro pendente fica em NVS, sobrescrito a cada nova falha.
static bool firebaseAuthenticatedForErrors = false;

String getCurrentTimestamp();

static bool hasReliableClock()
{
  return time(nullptr) >= 1735689600; // 2025-01-01 UTC
}

static bool flushLastErrorToFirebase()
{
  if (!firebaseAuthenticatedForErrors || WiFi.status() != WL_CONNECTED ||
      !Firebase.ready())
    return false;

  Preferences prefs;
  if (!prefs.begin("inkcanvas_err", true))
    return false;
  const bool pending = prefs.getBool("pending", false);
  const String code = prefs.getString("code", "");
  const String message = prefs.getString("message", "");
  const String occurredAt = prefs.getString("occurred", "");
  const int httpCode = prefs.getInt("http", 0);
  prefs.end();

  if (!pending || code.isEmpty())
    return true;

  const String id = WiFi.macAddress();
  if (id.isEmpty() || id == "00:00:00:00:00:00")
    return false;

  if (!firebase.writeLastError(id.c_str(), code, message, occurredAt, httpCode))
    return false; // Nao apagar pendencia; repetir na proxima conexao.

  if (prefs.begin("inkcanvas_err", false))
  {
    prefs.putBool("pending", false);
    prefs.end();
  }
  Serial.printf("DIAGNOSTICS: ultimo erro enviado (%s).\n", code.c_str());
  return true;
}

static void registerLastError(const char *code, const char *message,
                              int httpCode = 0)
{
  Serial.printf("DIAGNOSTICS ERROR [%s]: %s (HTTP %d)\n",
                code, message, httpCode);
  Preferences prefs;
  if (!prefs.begin("inkcanvas_err", false))
  {
    Serial.println("DIAGNOSTICS: nao foi possivel abrir NVS.");
    return;
  }

  // Campos curtos; jamais incluir credenciais, tokens, SSID ou payload de fotos.
  prefs.putString("code", String(code).substring(0, 64));
  prefs.putString("message", String(message).substring(0, 200));
  prefs.putString("occurred", hasReliableClock() ? getCurrentTimestamp() : "");
  prefs.putInt("http", httpCode);
  prefs.putBool("pending", true); // Marcar pendente somente apos os dados.
  prefs.end();

  // Quando ha Firebase, publica de imediato. Se falhar, a NVS preserva.
  // O envio nunca chama registerLastError: impede recursao e logs infinitos.
  if (firebaseAuthenticatedForErrors)
    flushLastErrorToFirebase();
}

static bool failSync(const char *code, const char *message,
                     int httpCode = 0)
{
  registerLastError(code, message, httpCode);
  return false;
}

// Diagnostico de RAM interna: o Wi-Fi precisa desta memoria ate com PSRAM.
static void printMemory(const char *step)
{
  const uint32_t caps = MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT;
  Serial.printf(
      "MEM [%s] interno=%u B | maior=%u B | minimo=%u B | PSRAM=%u B\n",
      step,
      (unsigned)heap_caps_get_free_size(caps),
      (unsigned)heap_caps_get_largest_free_block(caps),
      (unsigned)heap_caps_get_minimum_free_size(caps),
      (unsigned)heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
}

// ============================================================
// FUNCOES DE APOIO
// ============================================================

uint32_t minutesUntilNextDay()
{
  time_t now = time(nullptr);

  struct tm *timeinfo = localtime(&now);

  timeinfo->tm_hour = 0;
  timeinfo->tm_min = 0;
  timeinfo->tm_sec = 0;

  time_t nextDay =
      mktime(timeinfo) + 24 * 60 * 60;

  uint32_t seconds =
      (uint32_t)(nextDay - now);

  return (seconds + 59) / 60;
}

bool secondsUntilNextScheduledUpdate(uint64_t &secondsUntilNext)
{
  secondsUntilNext = 0;

  if (!sd.exists("/config.json"))
  {
    Serial.println("SCHEDULE: config.json nao encontrado.");
    return false;
  }

  uint64_t fileSize = sd.size("/config.json");

  if (fileSize == 0)
  {
    Serial.println("SCHEDULE: config.json vazio.");
    return false;
  }

  char *buffer = new char[fileSize + 1];

  if (buffer == nullptr)
  {
    Serial.println("SCHEDULE: erro de memoria.");
    return false;
  }

  size_t bytesRead = sd.read(
      "/config.json",
      (uint8_t *)buffer,
      fileSize);

  if (bytesRead != fileSize)
  {
    delete[] buffer;
    Serial.println("SCHEDULE: erro ao ler config.json.");
    return false;
  }

  buffer[bytesRead] = '\0';

  FirebaseJson config;

  if (!config.setJsonData(buffer))
  {
    delete[] buffer;
    Serial.println("SCHEDULE: JSON invalido.");
    return false;
  }

  delete[] buffer;

  FirebaseJsonData updateTimesData;

  if (!config.get(updateTimesData, "updateTimes"))
  {
    Serial.println("SCHEDULE: updateTimes nao encontrado.");
    return false;
  }

  FirebaseJsonArray updateTimes;

  if (!updateTimesData.getArray(updateTimes))
  {
    Serial.println("SCHEDULE: updateTimes nao e um array.");
    return false;
  }

  time_t now = time(nullptr);

  if (now < 1700000000) // 1970
  {
    Serial.println("SCHEDULE: relogio nao sincronizado.");
    return false;
  }

  struct tm currentTime;

  if (localtime_r(&now, &currentTime) == nullptr)
  {
    Serial.println("SCHEDULE: erro ao obter horario local.");
    return false;
  }

  bool found = false;
  uint64_t shortestSeconds = UINT64_MAX;

  for (size_t i = 0; i < updateTimes.size(); i++)
  {
    FirebaseJsonData timeData;

    if (!updateTimes.get(timeData, i))
      continue;

    String scheduledTime = timeData.to<String>();

    if (scheduledTime.length() != 5 ||
        scheduledTime.charAt(2) != ':')
    {
      Serial.print("SCHEDULE: horario invalido: ");
      Serial.println(scheduledTime);
      continue;
    }

    int hour = scheduledTime.substring(0, 2).toInt();
    int minute = scheduledTime.substring(3, 5).toInt();

    if (hour < 0 || hour > 23 ||
        minute < 0 || minute > 59)
    {
      Serial.print("SCHEDULE: horario invalido: ");
      Serial.println(scheduledTime);
      continue;
    }

    struct tm candidate = currentTime;

    candidate.tm_hour = hour;
    candidate.tm_min = minute;
    candidate.tm_sec = 0;
    candidate.tm_isdst = -1;

    time_t candidateTimestamp = mktime(&candidate);

    // Se o horario de hoje ja passou, considerar amanha.
    if (candidateTimestamp <= now + 180) // 3 minutos de tolerancia
    {
      candidate.tm_mday++;
      candidate.tm_isdst = -1;

      candidateTimestamp = mktime(&candidate);
    }

    if (candidateTimestamp <= now)
      continue;

    uint64_t secondsRemaining =
        (uint64_t)(candidateTimestamp - now);

    if (!found || secondsRemaining < shortestSeconds)
    {
      found = true;
      shortestSeconds = secondsRemaining;
    }
  }

  if (!found)
  {
    Serial.println("SCHEDULE: nenhum horario valido.");
    return false;
  }

  secondsUntilNext = shortestSeconds;

  Serial.print("SCHEDULE: proxima atualizacao em ");
  Serial.print(secondsUntilNext / 3600);
  Serial.print("h ");
  Serial.print((secondsUntilNext % 3600) / 60);
  Serial.println("min.");

  return true;
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

  char *buffer = new char[fileSize + 1];

  if (!buffer)
  {
    Serial.println("Erro ao alocar memoria para /display.json");
    return true;
  }

  size_t bytesRead = sd.read(
      "/display.json",
      (uint8_t *)buffer,
      fileSize);

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
      (long)elapsed);

  if (elapsed < displayRatePeriod)
  {
    Serial.printf(
        "Display bloqueado. Faltam %ld segundos.\n",
        (long)(displayRatePeriod - elapsed));

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
      (const uint8_t *)output.c_str(),
      output.length());

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
      false);

  deviceId = WiFi.macAddress();

  return firebase.writeState(
      deviceId.c_str(),
      stateOutput);
}

bool setProcessingStatus(
    const String &deviceId,
    const String &status)
{
  String timestamp =
      getCurrentTimestamp();

  if (timestamp.length() == 0)
  {
    Serial.println(
        "PROCESSING: nao foi possivel obter timestamp.");

    return false;
  }

  return firebase.writeProcessingStatus(
      deviceId.c_str(),
      status,
      timestamp.c_str());
}

// NTP nao e utilizado. Para HTTPS com validacao, o ESP precisa ter hora
// plausivel primeiro; o Date HTTP apenas inicializa esse relogio.
static bool parseHttpDateUtc(const String &dateHeader, time_t &epoch)
{
  char dayName[4] = {}, monthName[4] = {};
  int day = 0, year = 0, hour = -1, minute = -1, second = -1;
  if (!dateHeader.endsWith(" GMT") ||
      sscanf(dateHeader.c_str(), "%3s, %d %3s %d %d:%d:%d GMT",
             dayName, &day, monthName, &year,
             &hour, &minute, &second) != 7)
    return false;

  static const char *months[] = {
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
  int month = -1;
  for (int i = 0; i < 12; ++i)
    if (strcmp(monthName, months[i]) == 0)
    {
      month = i;
      break;
    }
  if (month < 0 || year < 2025 || year > 2100 || day < 1 || day > 31 ||
      hour < 0 || hour > 23 || minute < 0 || minute > 59 ||
      second < 0 || second > 60)
    return false;

  // Converte calendario UTC para Unix epoch sem timegm(), indisponivel
  // em algumas versoes do core ESP32. Nao altera o fuso global (BRT3).
  const int m = month + 1;  // 1..12
  const int adjustedYear = year - (m <= 2 ? 1 : 0);
  const int era = adjustedYear / 400;
  const unsigned yearOfEra = (unsigned)(adjustedYear - era * 400);
  const unsigned dayOfYear =
      (153u * (unsigned)(m + (m > 2 ? -3 : 9)) + 2u) / 5u +
      (unsigned)day - 1u;
  const unsigned yearOfEraDays =
      yearOfEra * 365u + yearOfEra / 4u - yearOfEra / 100u + dayOfYear;
  const int64_t daysSinceEpoch =
      (int64_t)era * 146097LL + (int64_t)yearOfEraDays - 719468LL;
  const int64_t epochSeconds =
      daysSinceEpoch * 86400LL + (int64_t)hour * 3600LL +
      (int64_t)minute * 60LL + second;
  if (epochSeconds < 1735689600LL)
    return false;
  const time_t parsed = (time_t)epochSeconds;
  struct tm checked = {};
  gmtime_r(&parsed, &checked);
  if (checked.tm_year != year - 1900 || checked.tm_mon != month ||
      checked.tm_mday != day || checked.tm_hour != hour ||
      checked.tm_min != minute)
    return false;
  epoch = parsed;
  return true;
}

bool syncClock()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("CLOCK: Wi-Fi desconectado.");
    return false;
  }

  // Mesmo fuso do firmware anterior (Brasilia UTC-3); SEM configTzTime().
  setenv("TZ", "BRT3", 1);
  tzset();

  const char *urls[] = {
      "http://connectivitycheck.gstatic.com/generate_204",
      "http://www.google.com/generate_204"};
  for (const char *url : urls)
  {
    WiFiClient client;
    HTTPClient http;
    http.setConnectTimeout(5000);
    http.setTimeout(7000);
    if (!http.begin(client, url))
      continue;
    const char *headers[] = {"Date"};
    http.collectHeaders(headers, 1);
    const int status = http.GET();
    const String dateHeader = http.header("Date");
    http.end();

    time_t epoch = 0;
    if (status == 204 && parseHttpDateUtc(dateHeader, epoch))
    {
      struct timeval tv = {};
      tv.tv_sec = epoch;
      if (settimeofday(&tv, nullptr) == 0)
      {
        struct tm local = {};
        localtime_r(&epoch, &local);
        Serial.printf("CLOCK: HTTP Date OK (%04d-%02d-%02d %02d:%02d:%02d BRT).\n",
                      local.tm_year + 1900, local.tm_mon + 1, local.tm_mday,
                      local.tm_hour, local.tm_min, local.tm_sec);
        return true;
      }
    }
    Serial.printf("CLOCK: Date HTTP indisponivel (status %d).\n", status);
  }

  // Se o RTC manteve uma data plausivel durante deep sleep, nao bloquear
  // a atualizacao por falha temporaria dos endpoints HTTP.
  if (hasReliableClock())
  {
    Serial.println("CLOCK: usando relogio existente; HTTP indisponivel.");
    return true;
  }
  Serial.println("CLOCK: falha no bootstrap de horario HTTP.");
  return false;
}

String getCurrentTimestamp()
{
  if (!hasReliableClock())
    return "";
  time_t now = time(nullptr);

  struct tm timeInfo;

  gmtime_r(
      &now,
      &timeInfo);

  char timestamp[25];

  strftime(
      timestamp,
      sizeof(timestamp),
      "%Y-%m-%dT%H:%M:%SZ",
      &timeInfo);

  return String(timestamp);
}

time_t parseTimestamp(const String &timestamp)
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
          &second) != 6)
  {
    return 0;
  }

  int days = 0;

  for (int y = 1970; y < year; y++)
  {
    days += 365;

    if (
        (y % 4 == 0 && y % 100 != 0) ||
        (y % 400 == 0))
    {
      days++;
    }
  }

  const int daysInMonth[] =
      {
          31, 28, 31, 30, 31, 30,
          31, 31, 30, 31, 30, 31};

  for (int m = 1; m < month; m++)
  {
    days += daysInMonth[m - 1];

    if (
        m == 2 &&
        ((year % 4 == 0 && year % 100 != 0) ||
         (year % 400 == 0)))
    {
      days++;
    }
  }

  days += day - 1;

  return (time_t)days * 86400 +
         hour * 3600 +
         minute * 60 +
         second;
}

// ============================================================
// DISPLAY
// ============================================================

bool displayTextScreen(const String &text)
{
  if (!canUpdateDisplay())
  {
    Serial.println(
        "INFO: atualizacao bloqueada. Menos de 2 minutos desde a ultima atualizacao.");

    return false;
  }

  const int width = 800;
  const int height = 480;

  uint8_t *imageData =
      (uint8_t *)malloc(IMAGE_SIZE);

  if (imageData == nullptr)
  {
    Serial.println(
        "INFO: nao foi possivel reservar memoria.");

    return false;
  }

  if (!textRenderer.render(
          imageData,
          width,
          height,
          text,
          black,
          white))
  {
    Serial.println(
        "INFO: erro ao renderizar texto.");

    free(imageData);

    return false;
  }

  SPI.end();

  SPI.begin(
      EPD_SCK,
      -1,
      EPD_MOSI,
      EPD_CS);

  SPI.beginTransaction(
      SPISettings(
          10000000,
          MSBFIRST,
          SPI_MODE0));

  EPD_init_fast();

  EPD_W21_WriteCMD(0x10);

  for (int i = 0; i < IMAGE_SIZE; i++)
  {
    EPD_W21_WriteDATA(
        imageData[i]);
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
        "INFO: erro ao reinicializar SD.");

    return false;
  }

  recordDisplayUpdate();

  Serial.println(
      "INFO: tela exibida.");

  return true;
}

bool displayImageFromSD(
    const char *filename)
{
  if (!canUpdateDisplay())
  {
    Serial.println(
        "UPDATE: atualizacao nao disponivel - periodo de refresh respeitado");

    return false;
  }

  Serial.println("Abrindo arquivo...");

  File file = SD.open(
      filename,
      FILE_READ);

  if (!file)
  {
    Serial.println(
        "ERRO: nao foi possivel abrir o arquivo.");

    return false;
  }

  Serial.print("Arquivo aberto. Tamanho: ");
  Serial.print(file.size());
  Serial.println(" bytes");

  if (file.size() != IMAGE_SIZE)
  {
    Serial.println(
        "ERRO: tamanho do arquivo diferente de 192000 bytes.");

    file.close();

    return false;
  }

  uint8_t *imageData =
      (uint8_t *)malloc(IMAGE_SIZE);

  if (imageData == nullptr)
  {
    Serial.println(
        "ERRO: nao foi possivel reservar memoria.");

    file.close();

    return false;
  }

  Serial.println("Memoria reservada.");

  size_t bytesRead =
      file.read(
          imageData,
          IMAGE_SIZE);

  file.close();

  Serial.println("Arquivo fechado.");

  Serial.print("Bytes lidos: ");
  Serial.println(bytesRead);

  if (bytesRead != IMAGE_SIZE)
  {
    Serial.println(
        "ERRO: leitura incompleta.");

    free(imageData);

    return false;
  }

  Serial.println(
      "Arquivo lido completamente.");

  // ============================================================
  // SPI DO SD → EPD
  // ============================================================

  SPI.end();

  Serial.println(
      "SPI do SD encerrado.");

  SPI.begin(
      EPD_SCK,
      -1,
      EPD_MOSI,
      EPD_CS);

  SPI.beginTransaction(
      SPISettings(
          10000000,
          MSBFIRST,
          SPI_MODE0));

  Serial.println(
      "SPI do EPD configurado.");

  // ============================================================
  // INICIALIZA EPD
  // ============================================================

  Serial.println(
      "Inicializando EPD...");

  EPD_init_fast();

  Serial.println(
      "EPD inicializado.");

  // ============================================================
  // ENVIA IMAGEM
  // ============================================================

  Serial.println(
      "Enviando imagem...");

  EPD_W21_WriteCMD(0x10);

  for (int i = 0; i < IMAGE_SIZE; i++)
  {
    EPD_W21_WriteDATA(
        imageData[i]);
  }

  // ============================================================
  // ATUALIZA TELA
  // ============================================================

  EPD_W21_WriteCMD(0x12);

  EPD_W21_WriteDATA(0x00);

  delay(1);

  Serial.println(
      "Aguardando refresh...");

  lcd_chkstatus();

  Serial.println(
      "Imagem exibida.");

  // ============================================================
  // EPD SLEEP - SD SPI Begin
  // ============================================================

  EPD_sleep();

  Serial.println(
      "EPD em sleep.");

  SPI.endTransaction();

  SPI.end();

  if (!sd.begin(Serial))
  {
    Serial.println(
        "ERRO: nao foi possivel inicializar o SD.");

    free(imageData);

    return false;
  }

  recordDisplayUpdate();

  free(imageData);

  Serial.println(
      "Memoria liberada.");

  return true;
}

bool showPhoto(
    const String &imageId,
    const String &epaperFilePath)
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
        "Imagem ja existe no SD. Tamanho: ");

    Serial.print(localSize);

    Serial.println(
        " bytes");

    if (localSize == IMAGE_SIZE)
    {
      needsDownload = false;

      Serial.println(
          "Imagem local valida.");
    }
    else
    {
      Serial.println(
          "Imagem local incompleta ou corrompida.");

      Serial.println(
          "Removendo arquivo para baixar novamente...");

      if (!sd.remove(localPath.c_str()))
      {
        Serial.println(
            "ERRO: nao foi possivel remover arquivo invalido.");

        return false;
      }
    }
  }
  else
  {
    Serial.println(
        "Imagem nao encontrada no SD.");
  }

  // ============================================================
  // DOWNLOAD
  // ============================================================

  if (needsDownload)
  {
    Serial.println(
        "Baixando imagem do Firebase Storage...");

    if (!firebase.downloadImage(
            epaperFilePath.c_str(),
            localPath.c_str()))
    {
      Serial.println(
          "ERRO: nao foi possivel baixar a imagem.");

      return false;
    }

    Serial.println(
        "Download concluido.");

    // ==========================================================
    // VALIDAR DOWNLOAD
    // ==========================================================

    if (!sd.exists(localPath.c_str()))
    {
      Serial.println(
          "ERRO: arquivo nao apareceu no SD apos download.");

      return false;
    }

    uint64_t downloadedSize =
        sd.size(localPath.c_str());

    Serial.print(
        "Tamanho apos download: ");

    Serial.print(
        downloadedSize);

    Serial.println(
        " bytes");

    if (downloadedSize != IMAGE_SIZE)
    {
      Serial.println(
          "ERRO: download incompleto ou invalido.");

      Serial.println(
          "Removendo arquivo invalido.");

      sd.remove(localPath.c_str());

      return false;
    }

    Serial.println(
        "Download validado.");
  }

  // ============================================================
  // MOSTRAR IMAGEM NO DISPLAY
  // ============================================================

  Serial.println(
      "Exibindo imagem no E-Paper...");

  if (!displayImageFromSD(
          localPath.c_str()))
  {
    Serial.println(
        "ERRO: nao foi possivel exibir a imagem.");

    return false;
  }

  Serial.println(
      "Imagem exibida com sucesso.");

  return true;
}

// ============================================================
// INFO - OBTER DESCRICAO DA IMAGEM ATUAL
// ============================================================

bool getCurrentImageDescription(
    String &description,
    const String &photosJsonString)
{
  description = "";

  FirebaseJsonData currentImageData;

  if (!stateJson.get(
          currentImageData,
          "currentImageId"))
  {
    Serial.println(
        "INFO: currentImageId nao encontrado.");

    return false;
  }

  String currentImageId =
      currentImageData.to<String>();

  if (currentImageId.length() == 0)
  {
    Serial.println(
        "INFO: nenhuma imagem atual.");

    return false;
  }

  Serial.print(
      "INFO: imagem atual: ");

  Serial.println(
      currentImageId);

  // ============================================================
  // PHOTOS
  // ============================================================

  FirebaseJson photosJson;

  if (!photosJson.setJsonData(
          photosJsonString))
  {
    Serial.println(
        "INFO: dados de photos invalidos.");

    return false;
  }

  // ============================================================
  // COLLECTIONS
  // ============================================================

  FirebaseJsonData collectionsData;

  if (!photosJson.get(
          collectionsData,
          "collections"))
  {
    Serial.println(
        "INFO: collections nao encontrado.");

    return false;
  }

  FirebaseJsonArray collections;

  if (!collectionsData.getArray(
          collections))
  {
    Serial.println(
        "INFO: erro ao ler collections.");

    return false;
  }

  // ============================================================
  // PROCURAR IMAGEM
  // ============================================================

  for (
      size_t i = 0;
      i < collections.size();
      i++)
  {
    FirebaseJsonData collectionData;

    if (!collections.get(
            collectionData,
            i))
    {
      continue;
    }

    FirebaseJson collection;

    if (!collectionData.getJSON(
            collection))
    {
      continue;
    }

    FirebaseJsonData imagesData;

    if (!collection.get(
            imagesData,
            "images"))
    {
      continue;
    }

    FirebaseJsonArray images;

    if (!imagesData.getArray(
            images))
    {
      continue;
    }

    // ==========================================================
    // PROCURAR IMAGEM DENTRO DA COLECAO
    // ==========================================================

    for (
        size_t j = 0;
        j < images.size();
        j++)
    {
      FirebaseJsonData imageData;

      if (!images.get(
              imageData,
              j))
      {
        continue;
      }

      FirebaseJson image;

      if (!imageData.getJSON(
              image))
      {
        continue;
      }

      FirebaseJsonData imageIdData;

      if (!image.get(
              imageIdData,
              "id"))
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
              "description"))
      {
        Serial.println(
            "INFO: imagem nao possui campo description.");

        return false;
      }

      description =
          descriptionData.to<String>();

      if (description.length() == 0)
      {
        Serial.println(
            "INFO: campo description esta vazio.");

        return false;
      }

      Serial.println(
          "INFO: descricao encontrada:");

      Serial.println(
          description);

      return true;
    }
  }

  Serial.println(
      "INFO: imagem atual nao encontrada em photos.");

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
        "STATE: arquivo nao existe. Criando estado inicial.");

    stateJson.clear();

    stateJson.setJsonData(
        "{\"lastCollectionId\":\"\",\"currentImageId\":\"\",\"displayHistory\":[]}");

    return true;
  }

  uint64_t fileSize = sd.size("/state.json");

  if (fileSize == 0)
  {
    Serial.println(
        "STATE: arquivo vazio. Criando estado inicial.");

    stateJson.clear();

    stateJson.setJsonData(
        "{\"lastCollectionId\":\"\",\"currentImageId\":\"\",\"displayHistory\":[]}");

    return true;
  }

  uint8_t *buffer =
      new uint8_t[fileSize + 1];

  if (!buffer)
  {
    Serial.println(
        "STATE: erro ao alocar memoria.");

    return false;
  }

  size_t bytesRead = sd.read(
      "/state.json",
      buffer,
      fileSize);

  buffer[bytesRead] = '\0';

  stateJson.clear();

  if (!stateJson.setJsonData(
          (char *)buffer))
  {
    Serial.println(
        "STATE: JSON invalido.");

    delete[] buffer;

    return false;
  }

  delete[] buffer;

  Serial.println(
      "STATE: carregado.");

  String stateOutput;

  stateJson.toString(
      stateOutput,
      false);

  Serial.println(
      "=== STATE JSON ===");

  Serial.println(
      stateOutput);

  return true;
}

bool saveState()
{
  Serial.println("SAVE: 1 - iniciando");

  String output;

  stateJson.toString(
      output,
      false);

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
          (const uint8_t *)output.c_str(),
          output.length()))
  {
    Serial.println(
        "STATE: erro ao salvar /state.json.");

    return false;
  }

  Serial.println("SAVE: 6 - sd.write OK");

  Serial.println(
      "STATE: /state.json salvo.");

  return true;
}

// ============================================================
// REGISTRAR FOTO EXIBIDA
// ============================================================

bool recordDisplayedPhoto(
    const String &imageId)
{
  Serial.println("HISTORY: - Start recordDisplayedPhoto()");

  FirebaseJsonData historyData;

  if (!stateJson.get(
          historyData,
          "displayHistory"))
  {
    Serial.println(
        "STATE: displayHistory nao encontrado.");

    return false;
  }

  Serial.println("HISTORY: - displayHistory encontrado");

  FirebaseJsonArray history;

  if (!historyData.getArray(history))
  {
    Serial.println(
        "STATE: erro ao ler displayHistory.");

    return false;
  }

  Serial.println("HISTORY: - array OK");

  FirebaseJson newItem;

  String timestamp =
      getCurrentTimestamp();

  Serial.println("HISTORY: - timestamp OK");

  newItem.set(
      "imageId",
      imageId);

  newItem.set(
      "lastDisplayedAt",
      timestamp);

  Serial.println("HISTORY: - novo item OK");

  FirebaseJsonArray newHistory;

  newHistory.add(
      newItem);

  Serial.println("HISTORY: - novo historico iniciado");

  for (size_t i = 0; i < history.size(); i++)
  {
    Serial.print("HISTORY: processando item ");
    Serial.println(i);

    FirebaseJsonData historyItemData;

    if (!history.get(
            historyItemData,
            i))
    {
      continue;
    }

    FirebaseJson historyItem;

    if (!historyItemData.getJSON(
            historyItem))
    {
      continue;
    }

    FirebaseJsonData historyImageIdData;

    if (!historyItem.get(
            historyImageIdData,
            "imageId"))
    {
      continue;
    }

    String historyImageId =
        historyImageIdData.to<String>();

    if (historyImageId == imageId)
      continue;

    newHistory.add(
        historyItem);
  }

  Serial.println("HISTORY: - loop terminado");

  stateJson.set(
      "currentImageId",
      imageId);

  Serial.println("HISTORY: - currentImageId OK");

  stateJson.set(
      "displayHistory",
      newHistory);

  Serial.println("HISTORY: - displayHistory OK");

  Serial.println(
      "=== DISPLAY HISTORY ATUALIZADO ===");

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
    String &outputImageId,
    String &outputEpaperFilePath,
    const String &priorityCollectionId,
    const String &priorityImageId,
    bool hasPriority,
    const String &photosJsonString)
{
  outputImageId = "";
  outputEpaperFilePath = "";

  if (!hasPriority)
  {
    return false;
  }

  Serial.println(
      "=== CHOOSE PRIORITY PHOTO ===");

  // ============================================================
  // CONFIG
  // ============================================================

  uint64_t configFileSize =
      sd.size("/config.json");

  if (configFileSize == 0)
  {
    Serial.println(
        "PRIORITY: /config.json nao existe ou esta vazio.");

    return false;
  }

  uint8_t *configBuffer =
      new uint8_t[configFileSize + 1];

  if (!configBuffer)
  {
    Serial.println(
        "PRIORITY: erro ao alocar memoria.");

    return false;
  }

  size_t configBytesRead =
      sd.read(
          "/config.json",
          configBuffer,
          configFileSize);

  configBuffer[configBytesRead] = '\0';

  FirebaseJson configJson;

  if (!configJson.setJsonData(
          (char *)configBuffer))
  {
    Serial.println(
        "PRIORITY: config JSON invalido.");

    delete[] configBuffer;

    return false;
  }

  delete[] configBuffer;

  FirebaseJsonData orientationData;

  if (!configJson.get(
          orientationData,
          "orientation"))
  {
    Serial.println(
        "PRIORITY: orientation nao encontrado.");

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
        "PRIORITY: orientation invalida.");

    return false;
  }

  // ============================================================
  // PHOTOS
  // ============================================================

  FirebaseJson photosJson;

  if (!photosJson.setJsonData(
          photosJsonString))
  {
    Serial.println(
        "PRIORITY: dados de photos invalidos.");

    return false;
  }

  FirebaseJsonData collectionsData;

  if (!photosJson.get(
          collectionsData,
          "collections"))
  {
    Serial.println(
        "PRIORITY: collections nao encontrado.");

    return false;
  }

  FirebaseJsonArray collections;

  if (!collectionsData.getArray(
          collections))
  {
    Serial.println(
        "PRIORITY: erro ao ler collections.");

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
            i))
    {
      continue;
    }

    FirebaseJson collection;

    if (!collectionData.getJSON(
            collection))
    {
      continue;
    }

    FirebaseJsonData collectionIdData;
    FirebaseJsonData collectionActiveData;
    FirebaseJsonData imagesData;

    if (!collection.get(
            collectionIdData,
            "id"))
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
            "active"))
    {
      Serial.println(
          "PRIORITY: colecao sem campo active.");

      return false;
    }

    if (!collectionActiveData.to<bool>())
    {
      Serial.println(
          "PRIORITY: colecao inativa.");

      return false;
    }

    if (!collection.get(
            imagesData,
            "images"))
    {
      Serial.println(
          "PRIORITY: images nao encontrado.");

      return false;
    }

    FirebaseJsonArray images;

    if (!imagesData.getArray(images))
    {
      Serial.println(
          "PRIORITY: erro ao ler images.");

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
              j))
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
              "id"))
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
              "active"))
      {
        Serial.println(
            "PRIORITY: imagem sem campo active.");

        return false;
      }

      if (!activeData.to<bool>())
      {
        Serial.println(
            "PRIORITY: imagem inativa.");

        return false;
      }

      if (!image.get(
              widthData,
              "width"))
      {
        Serial.println(
            "PRIORITY: imagem sem width.");

        return false;
      }

      if (!image.get(
              heightData,
              "height"))
      {
        Serial.println(
            "PRIORITY: imagem sem height.");

        return false;
      }

      if (widthData.to<int>() !=
              requiredWidth ||
          heightData.to<int>() !=
              requiredHeight)
      {
        Serial.println(
            "PRIORITY: dimensao incompativel.");

        return false;
      }

      if (!image.get(
              epaperFilePathData,
              "epaperFilePath"))
      {
        Serial.println(
            "PRIORITY: imagem sem epaperFilePath.");

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
          collectionId);

      Serial.println(
          "=== FOTO PRIORITARIA ESCOLHIDA ===");

      Serial.print(
          "Collection ID: ");

      Serial.println(
          collectionId);

      Serial.print(
          "Image ID: ");

      Serial.println(
          outputImageId);

      Serial.print(
          "Epaper file path: ");

      Serial.println(
          outputEpaperFilePath);

      return true;
    }

    Serial.println(
        "PRIORITY: imagem nao encontrada na colecao.");

    return false;
  }

  // ============================================================
  // COLECAO NAO ENCONTRADA
  // ============================================================

  Serial.println(
      "PRIORITY: colecao nao encontrada.");

  return false;
}

// ============================================================
// CHOOSE TEMPORARY PHOTO
// ============================================================

bool chooseTemporaryPhoto(
    String &outputImageId,
    String &outputEpaperFilePath,
    const String &temporaryPhotosJsonString)
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
        "TEMPORARY: /config.json não existe.");

    return false;
  }

  uint64_t configSize = sd.size(
      "/config.json");

  if (configSize == 0)
  {
    Serial.println(
        "TEMPORARY: /config.json está vazio.");

    return false;
  }

  uint8_t *configBuffer =
      new uint8_t[configSize + 1];

  if (!configBuffer)
  {
    Serial.println(
        "TEMPORARY: erro de memória.");

    return false;
  }

  size_t configRead = sd.read(
      "/config.json",
      configBuffer,
      configSize);

  if (configRead != configSize)
  {
    delete[] configBuffer;

    Serial.println(
        "TEMPORARY: erro ao ler /config.json.");

    return false;
  }

  configBuffer[configRead] = '\0';

  String configJson =
      String((char *)configBuffer);

  delete[] configBuffer;

  FirebaseJson config;
  config.setJsonData(configJson);

  FirebaseJsonData configData;

  if (!config.get(
          configData,
          "orientation"))
  {
    Serial.println(
        "TEMPORARY: orientation não encontrada.");

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
        "TEMPORARY: orientation invalida.");

    return false;
  }

  // =========================================================
  // TEMPORARY PHOTOS
  // =========================================================

  FirebaseJson json;

  if (!json.setJsonData(
          temporaryPhotosJsonString))
  {
    Serial.println(
        "TEMPORARY: dados de temporaryPhotos invalidos.");

    return false;
  }

  FirebaseJsonData photosData;

  if (!json.get(
          photosData,
          "temporaryPhotos"))
  {
    Serial.println(
        "TEMPORARY: lista temporaryPhotos não encontrada.");

    return false;
  }

  FirebaseJsonArray photos;

  if (!photosData.getArray(photos))
  {
    Serial.println(
        "TEMPORARY: erro ao ler temporaryPhotos.");

    return false;
  }

  // =========================================================
  // DATA ATUAL
  // =========================================================

  time_t now = time(nullptr);

  struct tm *currentTime =
      localtime(&now);

  if (currentTime == nullptr)
  {
    Serial.println(
        "TEMPORARY: não foi possível obter data atual.");

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
        itemData.to<String>());

    FirebaseJsonData data;

    if (!item.get(
            data,
            "recurrence"))
      continue;

    String recurrence =
        data.to<String>();

    if (recurrence != "once")
      continue;

    if (!item.get(
            data,
            "id"))
      continue;

    String imageId =
        data.to<String>();

    if (item.get(
            data,
            "consumedAt"))
    {
      Serial.print(
          "TEMPORARY: ONCE ja consumida: ");

      Serial.println(
          imageId);

      continue;
    }

    if (!item.get(
            data,
            "durationMinutes"))
      continue;

    uint32_t durationMinutes =
        data.to<uint32_t>();

    if (!item.get(
            data,
            "epaperFilePath"))
      continue;

    String epaperFilePath =
        data.to<String>();

    if (!item.get(
            data,
            "width"))
      continue;

    int width =
        data.to<int>();

    if (!item.get(
            data,
            "height"))
      continue;

    int height =
        data.to<int>();

    if (
        width != requiredWidth ||
        height != requiredHeight)
    {
      continue;
    }

    if (!item.get(
            data,
            "createdAt"))
      continue;

    String createdAt =
        data.to<String>();

    time_t createdTimestamp =
        parseTimestamp(createdAt);

    if (createdTimestamp <= 0)
      continue;

    if (
        !foundOnce ||
        createdTimestamp < oldestOnceCreatedAt)
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
        "TEMPORARY: encontrada ONCE válida.");

    Serial.print(
        "TEMPORARY: imageId = ");

    Serial.println(
        outputImageId);

    Serial.print(
        "TEMPORARY: durationMinutes = ");

    Serial.println(
        selectedOnceDurationMinutes);

    Serial.println(
        "TEMPORARY: escolhendo ONCE mais antiga.");

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
        itemData.to<String>());

    FirebaseJsonData data;

    if (!item.get(
            data,
            "recurrence"))
      continue;

    String recurrence =
        data.to<String>();

    if (recurrence != "yearly")
      continue;

    if (!item.get(
            data,
            "id"))
      continue;

    String imageId =
        data.to<String>();

    if (item.get(
            data,
            "consumedAt"))
    {
      String consumedAt =
          data.to<String>();

      time_t consumedTimestamp =
          parseTimestamp(consumedAt);

      if (consumedTimestamp > 0)
      {
        struct tm *consumedTime =
            gmtime(&consumedTimestamp);

        if (
            consumedTime != nullptr &&
            (consumedTime->tm_year + 1900) ==
                currentYear)
        {
          Serial.print(
              "TEMPORARY: YEARLY ja consumida neste ano: ");

          Serial.println(
              imageId);

          continue;
        }
      }
    }

    if (!item.get(
            data,
            "epaperFilePath"))
      continue;

    String epaperFilePath =
        data.to<String>();

    if (!item.get(
            data,
            "width"))
      continue;

    int width =
        data.to<int>();

    if (!item.get(
            data,
            "height"))
      continue;

    int height =
        data.to<int>();

    if (
        width != requiredWidth ||
        height != requiredHeight)
    {
      continue;
    }

    if (!item.get(
            data,
            "yearlyDate/month"))
      continue;

    int month =
        data.to<int>();

    if (!item.get(
            data,
            "yearlyDate/day"))
      continue;

    int day =
        data.to<int>();

    if (
        month != currentMonth ||
        day != currentDay)
    {
      continue;
    }

    if (!item.get(
            data,
            "createdAt"))
      continue;

    String createdAt =
        data.to<String>();

    time_t createdTimestamp =
        parseTimestamp(createdAt);

    if (createdTimestamp <= 0)
      continue;

    if (
        !foundYearly ||
        createdTimestamp > newestYearlyCreatedAt)
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
        "TEMPORARY: encontrada YEARLY válida para hoje.");

    Serial.print(
        "TEMPORARY: imageId = ");

    Serial.println(
        outputImageId);

    Serial.println(
        "TEMPORARY: escolhendo YEARLY mais recente.");

    nextSleepMinutes =
        minutesUntilNextDay();

    Serial.print(
        "TEMPORARY: YEARLY selecionada. Dormindo por ");

    Serial.print(
        nextSleepMinutes);

    Serial.println(
        " minutos.");

    return true;
  }

  // =========================================================
  // NENHUMA TEMPORARIA
  // =========================================================

  Serial.println(
      "TEMPORARY: nenhuma foto temporária válida.");

  return false;
}

// ============================================================
// ESCOLHER PROXIMA FOTO
// ============================================================

bool chooseNextPhoto(
    String &outputImageId,
    String &outputEpaperFilePath,
    const String &photosJsonString)
{
  outputImageId = "";
  outputEpaperFilePath = "";

  Serial.println(
      "=== CHOOSE NEXT PHOTO ===");

  // ============================================================
  // CONFIG
  // ============================================================

  uint64_t configFileSize =
      sd.size("/config.json");

  if (configFileSize == 0)
  {
    Serial.println(
        "CONFIG: /config.json nao existe ou esta vazio.");

    return false;
  }

  uint8_t *configBuffer =
      new uint8_t[configFileSize + 1];

  if (!configBuffer)
  {
    Serial.println(
        "CONFIG: erro ao alocar memoria.");

    return false;
  }

  size_t configBytesRead =
      sd.read(
          "/config.json",
          configBuffer,
          configFileSize);

  configBuffer[configBytesRead] = '\0';

  FirebaseJson configJson;

  if (!configJson.setJsonData(
          (char *)configBuffer))
  {
    Serial.println(
        "CONFIG: JSON invalido.");

    delete[] configBuffer;

    return false;
  }

  delete[] configBuffer;

  FirebaseJsonData orientationData;

  if (!configJson.get(
          orientationData,
          "orientation"))
  {
    Serial.println(
        "CONFIG: orientation nao encontrado.");

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
        "CONFIG: orientation invalida.");

    return false;
  }

  Serial.print(
      "Orientacao: ");

  Serial.println(
      orientation);

  Serial.print(
      "Dimensao exigida: ");

  Serial.print(
      requiredWidth);

  Serial.print(
      "x");

  Serial.println(
      requiredHeight);

  // ============================================================
  // PHOTOS
  // ============================================================

  FirebaseJson photosJson;

  if (!photosJson.setJsonData(
          photosJsonString))
  {
    Serial.println(
        "PHOTOS: dados de photos invalidos.");

    return false;
  }

  FirebaseJsonData collectionsData;

  if (!photosJson.get(
          collectionsData,
          "collections"))
  {
    Serial.println(
        "PHOTOS: collections nao encontrado.");

    return false;
  }

  FirebaseJsonArray collections;

  if (!collectionsData.getArray(
          collections))
  {
    Serial.println(
        "PHOTOS: erro ao ler collections.");

    return false;
  }

  Serial.print(
      "Colecoes encontradas: ");

  Serial.println(
      collections.size());

  // ============================================================
  // ESTADO ATUAL
  // ============================================================

  FirebaseJsonData lastCollectionData;

  stateJson.get(
      lastCollectionData,
      "lastCollectionId");

  String lastCollectionId =
      lastCollectionData.to<String>();

  Serial.print(
      "Ultima colecao: ");

  Serial.println(
      lastCollectionId);

  // ============================================================
  // ENCONTRAR PROXIMA COLECAO
  // ============================================================

  int selectedCollectionIndex = -1;

  size_t collectionCount =
      collections.size();

  if (collectionCount == 0)
  {
    Serial.println(
        "PHOTOS: nenhuma colecao encontrada.");

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
            i))
    {
      continue;
    }

    FirebaseJson collection;

    if (!collectionData.getJSON(
            collection))
    {
      continue;
    }

    FirebaseJsonData idData;

    if (!collection.get(
            idData,
            "id"))
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
          (lastCollectionIndex + offset) % collectionCount;
    }
    else
    {
      index =
          (offset - 1) % collectionCount;
    }

    FirebaseJsonData collectionData;

    if (!collections.get(
            collectionData,
            index))
    {
      continue;
    }

    FirebaseJson collection;

    if (!collectionData.getJSON(
            collection))
    {
      continue;
    }

    FirebaseJsonData collectionIdData;
    FirebaseJsonData collectionActiveData;
    FirebaseJsonData imagesData;

    if (!collection.get(
            collectionIdData,
            "id"))
    {
      continue;
    }

    if (!collection.get(
            collectionActiveData,
            "active"))
    {
      continue;
    }

    if (!collection.get(
            imagesData,
            "images"))
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
              j))
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
              "active"))
      {
        continue;
      }

      if (!image.get(
              widthData,
              "width"))
      {
        continue;
      }

      if (!image.get(
              heightData,
              "height"))
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
          "Colecao escolhida: ");

      Serial.println(
          collectionIdData.to<String>());

      break;
    }
  }

  if (selectedCollectionIndex < 0)
  {
    Serial.println(
        "PHOTOS: nenhuma colecao possui imagem compativel.");

    return false;
  }

  // ============================================================
  // IMAGEM MENOS RECENTEMENTE EXIBIDA
  // ============================================================

  FirebaseJsonData selectedCollectionData;

  if (!collections.get(
          selectedCollectionData,
          selectedCollectionIndex))
  {
    Serial.println(
        "PHOTOS: erro ao ler colecao escolhida.");

    return false;
  }

  FirebaseJson selectedCollection;

  if (!selectedCollectionData.getJSON(
          selectedCollection))
  {
    Serial.println(
        "PHOTOS: erro ao interpretar colecao.");

    return false;
  }

  FirebaseJsonData selectedImagesData;

  if (!selectedCollection.get(
          selectedImagesData,
          "images"))
  {
    Serial.println(
        "PHOTOS: images nao encontrado.");

    return false;
  }

  FirebaseJsonArray selectedImages;

  if (!selectedImagesData.getArray(
          selectedImages))
  {
    Serial.println(
        "PHOTOS: erro ao ler images.");

    return false;
  }

  // ============================================================
  // HISTORICO
  // ============================================================

  FirebaseJsonData historyData;

  stateJson.get(
      historyData,
      "displayHistory");

  FirebaseJsonArray history;

  if (!historyData.getArray(history))
  {
    Serial.println(
        "STATE: erro ao ler displayHistory.");

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
            i))
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
            "id"))
    {
      continue;
    }

    if (!image.get(
            activeData,
            "active"))
    {
      continue;
    }

    if (!image.get(
            widthData,
            "width"))
    {
      continue;
    }

    if (!image.get(
            heightData,
            "height"))
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
              h))
      {
        continue;
      }

      FirebaseJson historyItem;

      if (!historyItemData.getJSON(
              historyItem))
      {
        continue;
      }

      FirebaseJsonData historyImageIdData;

      if (!historyItem.get(
              historyImageIdData,
              "imageId"))
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
        "PHOTOS: nenhuma imagem compativel encontrada.");

    return false;
  }

  // ============================================================
  // OBTER IMAGEM ESCOLHIDA
  // ============================================================

  FirebaseJsonData selectedImageData;

  if (!selectedImages.get(
          selectedImageData,
          selectedImageIndex))
  {
    Serial.println(
        "STATE: erro ao obter imagem selecionada.");

    return false;
  }

  FirebaseJson selectedImage;

  if (!selectedImageData.getJSON(
          selectedImage))
  {
    Serial.println(
        "STATE: erro ao converter imagem selecionada.");

    return false;
  }

  FirebaseJsonData imageIdData;
  FirebaseJsonData epaperFilePathData;

  if (!selectedImage.get(
          imageIdData,
          "id"))
  {
    Serial.println(
        "STATE: imagem selecionada sem id.");

    return false;
  }

  if (!selectedImage.get(
          epaperFilePathData,
          "epaperFilePath"))
  {
    Serial.println(
        "STATE: imagem selecionada sem epaperFilePath.");

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
          "id"))
  {
    Serial.println(
        "PHOTOS: colecao escolhida sem id.");

    return false;
  }

  String selectedCollectionId =
      selectedCollectionIdData.to<String>();

  stateJson.set(
      "lastCollectionId",
      selectedCollectionId);

  // ============================================================
  // RESULTADO
  // ============================================================

  Serial.println(
      "=== FOTO ESCOLHIDA ===");

  Serial.print(
      "Image ID: ");

  Serial.println(
      outputImageId);

  Serial.print(
      "Epaper file path: ");

  Serial.println(
      outputEpaperFilePath);

  Serial.print(
      "Imagem: ");

  Serial.println(
      selectedImageId);

  Serial.print(
      "Posicao no historico: ");

  Serial.println(
      selectedImageHistoryPosition);

  return true;
}

// ============================================================
// v4: ESCOLHA A PARTIR DE CATALOGOS PAGINADOS NO MICROSD
// O parser recebe somente uma linha JSON por vez.
// ============================================================
static const char *kPhotoCatalog = "/PHOTOS.ND";
static const char *kTempCatalog = "/TEMP.ND";

static bool catalogGetString(FirebaseJson &json, const char *key, String &out) {
  FirebaseJsonData data;
  if (!json.get(data, key)) return false;
  out = data.to<String>();
  return true;
}

static bool catalogGetBool(FirebaseJson &json, const char *key) {
  FirebaseJsonData data;
  return json.get(data, key) && data.to<bool>();
}

static int catalogGetInt(FirebaseJson &json, const char *key) {
  FirebaseJsonData data;
  return json.get(data, key) ? data.to<int>() : 0;
}

static bool catalogDimensions(int &width, int &height) {
  File configFile = SD.open("/config.json", FILE_READ);
  if (!configFile) return false;
  FirebaseJson config;
  bool parsed = config.setJsonData(configFile.readString());
  configFile.close();
  if (!parsed) return false;
  String orientation;
  if (!catalogGetString(config, "orientation", orientation)) return false;
  if (orientation == "landscape") { width = 800; height = 480; return true; }
  if (orientation == "portrait")  { width = 480; height = 800; return true; }
  return false;
}

// Limite por linha: uma descricao gigantesca nao deve esgotar a RAM do ESP32.
static bool catalogReadLine(File &file, FirebaseJson &row) {
  if (!file.available()) return false;
  String line;
  if (!line.reserve(512)) return false;
  // Evita readStringUntil() alocar uma linha de tamanho ilimitado.
  while (file.available()) {
    const int byteValue = file.read();
    if (byteValue < 0 || byteValue == '\n') break;
    if (line.length() >= 8192) {
      Serial.println("CATALOGO: registro grande demais ou corrompido");
      return false;
    }
    line += (char)byteValue;
  }
  line.trim();
  return line.length() > 0 && row.setJsonData(line);
}

static bool catalogValidImage(FirebaseJson &row, int width, int height) {
  return catalogGetBool(row, "active") &&
         catalogGetInt(row, "width") == width &&
         catalogGetInt(row, "height") == height;
}

static bool choosePriorityFromSD(String &imageId, String &filePath,
                                 const String &collectionId, const String &priorityImage,
                                 bool hasPriority) {
  imageId = ""; filePath = "";
  if (!hasPriority) return false;
  int width, height;
  if (!catalogDimensions(width, height)) return false;
  File file = SD.open(kPhotoCatalog, FILE_READ);
  if (!file) return false;
  bool inCollection = false;
  bool found = false;
  while (file.available()) {
    FirebaseJson row;
    if (!catalogReadLine(file, row)) break;
    String type, id;
    if (!catalogGetString(row, "type", type) || !catalogGetString(row, "id", id)) continue;
    if (type == "collection") {
      inCollection = id == collectionId && catalogGetBool(row, "active");
    } else if (type == "image" && inCollection && id == priorityImage &&
               catalogValidImage(row, width, height)) {
      if (!catalogGetString(row, "epaperFilePath", filePath) || !filePath.length()) break;
      imageId = id;
      stateJson.set("lastCollectionId", collectionId);
      found = true;
      break;
    }
  }
  file.close();
  return found;
}

static bool chooseTemporaryFromSD(String &imageId, String &filePath) {
  imageId = ""; filePath = "";
  int width, height;
  if (!catalogDimensions(width, height)) return false;
  time_t now = time(nullptr);
  struct tm localNow;
  if (localtime_r(&now, &localNow) == nullptr) return false;
  const int year = localNow.tm_year + 1900;
  const int month = localNow.tm_mon + 1;
  const int day = localNow.tm_mday;
  File file = SD.open(kTempCatalog, FILE_READ);
  if (!file) return false;
  bool onceFound = false, yearlyFound = false;
  time_t oldestOnce = 0, newestYearly = 0;
  String onceId, oncePath, yearlyId, yearlyPath;
  uint32_t onceDuration = 0;
  while (file.available()) {
    FirebaseJson row;
    if (!catalogReadLine(file, row)) break;
    if (catalogGetInt(row, "width") != width || catalogGetInt(row, "height") != height) continue;
    String recurrence, id, path, createdAt, consumedAt;
    if (!catalogGetString(row, "recurrence", recurrence) ||
        !catalogGetString(row, "id", id) ||
        !catalogGetString(row, "epaperFilePath", path) ||
        !catalogGetString(row, "createdAt", createdAt)) continue;
    if (!path.length()) continue;
    time_t created = parseTimestamp(createdAt);
    if (created <= 0) continue;
    const bool consumed = catalogGetString(row, "consumedAt", consumedAt) && consumedAt.length() > 0;
    if (recurrence == "once") {
      if (consumed) continue;
      FirebaseJsonData durationValue;
      if (!row.get(durationValue, "durationMinutes")) continue;
      if (!onceFound || created < oldestOnce) {
        onceFound = true; oldestOnce = created;
        onceId = id; oncePath = path; onceDuration = durationValue.to<uint32_t>();
      }
    } else if (recurrence == "yearly") {
      if (catalogGetInt(row, "yearlyDate/month") != month ||
          catalogGetInt(row, "yearlyDate/day") != day) continue;
      if (consumed) {
        time_t timestamp = parseTimestamp(consumedAt);
        struct tm utcConsumed;
        if (timestamp > 0 && gmtime_r(&timestamp, &utcConsumed) != nullptr &&
            utcConsumed.tm_year + 1900 == year) continue;
      }
      if (!yearlyFound || created > newestYearly) {
        yearlyFound = true; newestYearly = created;
        yearlyId = id; yearlyPath = path;
      }
    }
  }
  file.close();
  if (onceFound) {
    imageId = onceId; filePath = oncePath; nextSleepMinutes = onceDuration;
    Serial.printf("TEMPORARY: ONCE mais antiga %s, pausa %u min\n", imageId.c_str(), (unsigned)onceDuration);
    return true;
  }
  if (yearlyFound) {
    imageId = yearlyId; filePath = yearlyPath;
    nextSleepMinutes = minutesUntilNextDay();
    Serial.printf("TEMPORARY: YEARLY mais recente %s\n", imageId.c_str());
    return true;
  }
  return false;
}

// Mantem: colecoes na ordem do Firestore, rotacao apos lastCollectionId,
// imagens ineditas primeiro; depois a mais antiga do displayHistory.
static bool chooseNormalFromSD(String &imageId, String &filePath) {
  imageId = ""; filePath = "";
  int width, height;
  if (!catalogDimensions(width, height)) return false;
  FirebaseJsonData last;
  stateJson.get(last, "lastCollectionId");
  const String lastCollectionId = last.to<String>();
  int lastIndex = -1, collectionCount = 0;
  {
    File file = SD.open(kPhotoCatalog, FILE_READ);
    if (!file) return false;
    while (file.available()) {
      FirebaseJson row;
      if (!catalogReadLine(file, row)) break;
      String type, id;
      if (catalogGetString(row, "type", type) && type == "collection") {
        if (catalogGetString(row, "id", id) && id == lastCollectionId) lastIndex = collectionCount;
        ++collectionCount;
      }
    }
    file.close();
  }
  if (!collectionCount) return false;
  int selectedRank = collectionCount + 1;
  String chosenCollection;
  {
    File file = SD.open(kPhotoCatalog, FILE_READ);
    if (!file) return false;
    int index = -1;
    bool collectionActive = false;
    while (file.available()) {
      FirebaseJson row;
      if (!catalogReadLine(file, row)) break;
      String type, id;
      if (!catalogGetString(row, "type", type)) continue;
      if (type == "collection") {
        ++index;
        catalogGetString(row, "id", id);
        collectionActive = catalogGetBool(row, "active");
        // A associacao da imagem usa o campo collectionId do proprio registro.
      } else if (type == "image" && collectionActive && catalogValidImage(row, width, height)) {
        String candidateId;
        if (!catalogGetString(row, "collectionId", candidateId)) continue;
        const int rank = (lastIndex >= 0)
          ? ((index - lastIndex + collectionCount - 1) % collectionCount) + 1
          : index + 1;
        if (rank < selectedRank) { selectedRank = rank; chosenCollection = candidateId; }
      }
    }
    file.close();
  }
  if (!chosenCollection.length()) return false;
  FirebaseJsonData historyData;
  if (!stateJson.get(historyData, "displayHistory")) return false;
  FirebaseJsonArray history;
  if (!historyData.getArray(history)) return false;
  int bestHistoryPosition = -2;
  bool found = false;
  {
    File file = SD.open(kPhotoCatalog, FILE_READ);
    if (!file) return false;
    while (file.available()) {
      FirebaseJson row;
      if (!catalogReadLine(file, row)) break;
      String type, collectionId, id;
      if (!catalogGetString(row, "type", type) || type != "image" ||
          !catalogGetString(row, "collectionId", collectionId) ||
          collectionId != chosenCollection || !catalogValidImage(row, width, height) ||
          !catalogGetString(row, "id", id)) continue;
      int historyPosition = -1;
      for (size_t h = 0; h < history.size(); ++h) {
        FirebaseJsonData item;
        if (!history.get(item, h)) continue;
        FirebaseJson historyItem;
        if (!item.getJSON(historyItem)) continue;
        String historicId;
        if (catalogGetString(historyItem, "imageId", historicId) && historicId == id) {
          historyPosition = (int)h;
          break;
        }
      }
      // Fotos nunca exibidas sempre vencem qualquer posicao do historico.
      if (!found || historyPosition == -1 || historyPosition > bestHistoryPosition) {
        String path;
        if (!catalogGetString(row, "epaperFilePath", path) || !path.length()) continue;
        imageId = id; filePath = path;
        bestHistoryPosition = historyPosition; found = true;
        if (historyPosition == -1) break;
      }
    }
    file.close();
  }
  if (found) {
    stateJson.set("lastCollectionId", chosenCollection);
    Serial.printf("PHOTOS: colecao %s, imagem %s, historico %d\n",
                  chosenCollection.c_str(), imageId.c_str(), bestHistoryPosition);
  }
  return found;
}

static bool getCurrentDescriptionFromSD(String &description) {
  description = "";
  FirebaseJsonData current;
  if (!stateJson.get(current, "currentImageId")) return false;
  const String currentId = current.to<String>();
  if (!currentId.length()) return false;
  File file = SD.open(kPhotoCatalog, FILE_READ);
  if (!file) return false;
  bool found = false;
  while (file.available()) {
    FirebaseJson row;
    if (!catalogReadLine(file, row)) break;
    String type, id;
    if (catalogGetString(row, "type", type) && type == "image" &&
        catalogGetString(row, "id", id) && id == currentId) {
      found = catalogGetString(row, "description", description) && description.length() > 0;
      break;
    }
  }
  file.close();
  return found;
}

// ============================================================
// CHOOSE DISPLAY PHOTO - choice logic
// ============================================================

bool chooseDisplayPhoto(
    String &outputImageId,
    String &outputEpaperFilePath,
    const String &priorityCollectionId,
    const String &priorityImageId,
    bool hasPriority,
    bool &outputIsTemporary)
{
  outputImageId = "";
  outputEpaperFilePath = "";
  outputIsTemporary = false;

  Serial.println(
      "=== CHOOSE DISPLAY PHOTO ===");

  // PRIORIDADE
  if (choosePriorityFromSD(
          outputImageId,
          outputEpaperFilePath,
          priorityCollectionId,
          priorityImageId,
          hasPriority))
  {
    Serial.println(
        "DISPLAY: usando foto PRIORITARIA.");

    return true;
  }

  // TEMPORARIA
  if (chooseTemporaryFromSD(
          outputImageId,
          outputEpaperFilePath))
  {
    outputIsTemporary = true;

    Serial.println(
        "DISPLAY: usando foto TEMPORARIA.");

    return true;
  }

  // NORMAL
  Serial.println(
      "DISPLAY: nenhuma prioridade ou temporaria valida.");

  if (chooseNormalFromSD(
          outputImageId,
          outputEpaperFilePath))
  {
    Serial.println(
        "DISPLAY: usando foto NORMAL.");

    return true;
  }

  Serial.println(
      "DISPLAY: nenhuma foto disponivel.");

  return false;
}

// ============================================================
// ROTINAS PRINCIPAIS SYNC, 3, INFO, WIFI
// ============================================================

bool syncDevice()
{
  firebaseAuthenticatedForErrors = false;
  Serial.println(
      "=== SYNC ===");

  // ============================================================
  // WI-FI
  // ============================================================

  Serial.println(
      "Conectando ao Wi-Fi salvo...");

  if (!wifiManager.connectToSavedWiFi())
  {
    Serial.println(
        "ERRO: nao foi possivel conectar ao Wi-Fi salvo.");

    return failSync("WIFI_CONNECTION", "Nao conectou ao Wi-Fi salvo");
  }

  Serial.println(
      "Wi-Fi conectado.");

  Serial.print(
      "IP: ");

  Serial.println(
      WiFi.localIP());

  deviceId = WiFi.macAddress();

  Serial.print(
      "Device ID: ");

  Serial.println(
      deviceId);

  // ============================================================
  // HORARIO
  // ============================================================

  if (!syncClock())
    return failSync("CLOCK_SYNC", "Falha obtendo horario HTTP");

  // ============================================================
  // SD
  // ============================================================

  Serial.println();

  Serial.println(
      "=== INICIALIZANDO SD ===");

  if (!sd.begin(Serial))
  {
    Serial.println(
        "ERRO: nao foi possivel inicializar o SD.");

    return failSync("SD_INIT", "Nao inicializou cartao SD");
  }

  // ============================================================
  // LOAD STATE
  // ============================================================

  if (!loadState())
  {
    Serial.println(
        "ERRO: nao foi possivel carregar state.");

    return failSync("STATE_LOAD", "Nao carregou state do SD");
  }

  // ============================================================
  // FIREBASE
  // ============================================================

  firebase.begin(
      API_KEY,
      STORAGE_BUCKET_ID,
      Serial);

  if (!firebase.authenticate())
  {
    Serial.println(
        "Autenticacao Firebase falhou.");

    return failSync("FIREBASE_AUTH", "Falha autenticando Firebase");
  }

  firebaseAuthenticatedForErrors = true;
  flushLastErrorToFirebase(); // Pendencia de boot anterior, se houver.

  if (!setProcessingStatus(
          deviceId,
          "thinking"))
  {
    Serial.println(
        "PROCESSING: nao foi possivel registrar thinking.");
    registerLastError("STATUS_THINKING", "Falha registrando estado thinking", firebase.lastHttpCode());
  }

  // ============================================================
  // FIRESTORE - CONFIG
  // ============================================================

  String configJson;

  if (!firebase.readDeviceConfig(
          deviceId.c_str(),
          configJson))
  {
    Serial.println(
        "ERRO: não foi possível sincronizar config.");

    return failSync("CONFIG_FETCH", "Falha lendo config do Firestore", firebase.lastHttpCode());
  }

  if (sd.exists("/config.json"))
    sd.remove("/config.json");

  if (!sd.write(
          "/config.json",
          (const uint8_t *)configJson.c_str(),
          configJson.length()))
  {
    Serial.println(
        "ERRO: não foi possível salvar /config.json.");

    return failSync("CONFIG_SAVE", "Falha salvando config no SD");
  }

  Serial.println(
      "config.json salvo no SD.");

  // ============================================================
  // FIRESTORE - PHOTOS
  // ============================================================

  Serial.println();

  Serial.println(
      "=== SINCRONIZANDO PHOTOS ===");

  printMemory("antes PHOTOS");
  if (!firebase.syncPhotosToSD(deviceId.c_str())) {
    return failSync("PHOTOS_FETCH", "Falha na paginacao de fotos para microSD", firebase.lastHttpCode());
  }
  printMemory("depois PHOTOS");

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
          hasPriority))
  {
    Serial.println(
        "ERRO: nao foi possivel ler prioridade.");

    return failSync("PRIORITY_FETCH", "Falha lendo prioridade do Firestore", firebase.lastHttpCode());
  }

  printMemory("depois PRIORITY");

  // ============================================================
  // FIRESTORE - TEMP PHOTOS
  // ============================================================

  Serial.println();

  Serial.println(
      "=== SINCRONIZANDO TEMP PHOTOS ===");

  printMemory("antes TEMP PHOTOS");
  if (!firebase.syncTemporaryPhotosToSD(deviceId.c_str())) {
    return failSync("TEMP_PHOTOS_FETCH", "Falha na paginacao de temporarias para microSD", firebase.lastHttpCode());
  }
  printMemory("depois TEMP PHOTOS");

  // Arquivos JSON monoliticos de versoes antigas nao sao mais utilizados.
  if (sd.exists("/photos.json")) sd.remove("/photos.json");
  if (sd.exists("/temporaryPhotos.json")) sd.remove("/temporaryPhotos.json");

  // ============================================================
  // ESCOLHER FOTO
  // ============================================================

  String imageId;
  String epaperFilePath;
  bool isTemporary = false;

  printMemory("antes ESCOLHA");
  if (!chooseDisplayPhoto(
          imageId,
          epaperFilePath,
          priorityCollectionId,
          priorityImageId,
          hasPriority,
          isTemporary))
  {
    Serial.println(
        "SYNC: nenhuma foto disponivel.");

    return true;
  }

  // ============================================================
  // MOSTRAR FOTO
  // ============================================================

  if (!showPhoto(
          imageId,
          epaperFilePath))
  {
    Serial.println(
        "ERRO: nao foi possivel mostrar a foto.");

    return failSync("PHOTO_SHOW", "Falha exibindo imagem ou baixando do Storage");
  }

  // ============================================================
  // CONSUMIR FOTO TEMPORARIA
  // ============================================================

  if (isTemporary)
  {
    Serial.println(
        "TEMPORARY: foto temporaria exibida.");

    Serial.println(
        "TEMPORARY: marcando como consumida.");

    String consumedAt = getCurrentTimestamp();

    if (!firebase.markTemporaryPhotoConsumed(
            deviceId.c_str(),
            imageId.c_str(),
            consumedAt.c_str()))
    {
      Serial.println("SYNC: erro ao marcar temporary como consumida.");
      return failSync("TEMP_CONSUME", "Falha marcando foto temporaria como consumida", firebase.lastHttpCode());
    }

    Serial.println(
        "TEMPORARY: foto marcada como consumida.");
  }

  // ============================================================
  // CONSUMIR PRIORIDADE
  // ============================================================

  if (
      hasPriority &&
      imageId == priorityImageId)
  {
    Serial.println(
        "PRIORITY: foto prioritaria exibida.");

    Serial.println(
        "PRIORITY: removendo prioridade.");

    if (!firebase.clearDevicePriority(
            deviceId.c_str()))
    {
      Serial.println(
          "ERRO: nao foi possivel remover prioridade.");

      return failSync("PRIORITY_CLEAR", "Falha removendo prioridade do Firestore", firebase.lastHttpCode());
    }

    Serial.println(
        "PRIORITY: prioridade removida.");
  }

  // ============================================================
  // REGISTRAR FOTO EXIBIDA
  // ============================================================

  if (!recordDisplayedPhoto(
          imageId))
  {
    Serial.println(
        "ERRO: nao foi possivel registrar historico.");

    return failSync("HISTORY_SAVE", "Falha salvando historico de imagens");
  }

  // ============================================================
  // REGISTRAR STATE FIREBASE
  // ============================================================

  if (!writeStateFirebase())
  {
    Serial.println(
        "ERRO: nao foi possivel registrar state Firebase.");

    return failSync("STATE_UPLOAD", "Falha publicando estado no Firebase", firebase.lastHttpCode());
  }

  // ============================================================
  // FINAL
  // ============================================================

  if (!setProcessingStatus(
          deviceId,
          "idle"))
  {
    Serial.println(
        "PROCESSING: nao foi possivel registrar idle.");
    registerLastError("STATUS_IDLE", "Falha registrando estado idle", firebase.lastHttpCode());
  }

  Serial.println(
      "END Sync");

  return true;
}

void button_3()
{
  Serial.println(
      "=== Button 3 ===");
}

void info()
{
  firebaseAuthenticatedForErrors = false;
  Serial.println(
      "=== INFO ===");

  // ============================================================
  // WI-FI
  // ============================================================

  Serial.println(
      "INFO: conectando ao Wi-Fi salvo...");

  if (!wifiManager.connectToSavedWiFi())
  {
    Serial.println(
        "INFO: nao foi possivel conectar ao Wi-Fi.");

    registerLastError("INFO_WIFI", "Nao conectou ao Wi-Fi");
    return;
  }

  Serial.println(
      "INFO: Wi-Fi conectado.");

  // ============================================================
  // HORARIO
  // ============================================================

  if (!syncClock())
  {
    registerLastError("INFO_CLOCK", "Falha obtendo horario HTTP");
    return;
  }

  // ============================================================
  // INICIALIZAR SD
  // ============================================================

  if (!sd.begin(Serial))
  {
    Serial.println(
        "INFO: nao foi possivel inicializar o SD.");

    registerLastError("INFO_SD", "Nao inicializou cartao SD");
    return;
  }

  // ============================================================
  // CARREGAR STATE
  // ============================================================

  if (!loadState())
  {
    Serial.println(
        "INFO: nao foi possivel carregar state.");

    registerLastError("INFO_STATE", "Nao carregou state do SD");
    return;
  }

  // ============================================================
  // FIREBASE
  // ============================================================

  firebase.begin(
      API_KEY,
      STORAGE_BUCKET_ID,
      Serial);

  if (!firebase.authenticate())
  {
    Serial.println(
        "Autenticacao Firebase falhou.");

    registerLastError("INFO_AUTH", "Falha autenticando Firebase");
    return;
  }

  firebaseAuthenticatedForErrors = true;
  flushLastErrorToFirebase();

  deviceId = WiFi.macAddress();

  if (!setProcessingStatus(
          deviceId,
          "thinking"))
  {
    Serial.println(
        "PROCESSING: nao foi possivel registrar thinking.");
    registerLastError("STATUS_THINKING", "Falha registrando estado thinking", firebase.lastHttpCode());
  }

  // ============================================================
  // PHOTOS
  // ============================================================

  Serial.println("INFO: sincronizando catalogo paginado no SD...");
  if (!firebase.syncPhotosToSD(deviceId.c_str())) {
    registerLastError("INFO_PHOTOS", "Falha lendo imagens paginadas do Firestore", firebase.lastHttpCode());
    return;
  }

  // ============================================================
  // OBTER DESCRICAO
  // ============================================================

  String description;

  if (!getCurrentDescriptionFromSD(description))
  {
    description =
        "Esta imagem nao tem descricao.";
  }

  // ============================================================
  // MOSTRAR DESCRICAO
  // ============================================================

  if (!displayTextScreen(
          description))
  {
    Serial.println(
        "INFO: nao foi possivel mostrar descricao.");

    registerLastError("INFO_DISPLAY", "Falha renderizando descricao");
    return;
  }

  // ============================================================
  // AGUARDAR 2 MINUTOS
  // ============================================================

  Serial.println(
      "INFO: descricao exibida.");

  Serial.println(
      "INFO: aguardando 2 minutos antes de restaurar a imagem.");

  if (!setProcessingStatus(
          deviceId,
          "idle"))
  {
    Serial.println(
        "PROCESSING: nao foi possivel registrar idle.");
    registerLastError("STATUS_IDLE", "Falha registrando estado idle", firebase.lastHttpCode());
  }

  delay(displayRatePeriod * 1000);

  if (!setProcessingStatus(
          deviceId,
          "thinking"))
  {
    Serial.println(
        "PROCESSING: nao foi possivel registrar thinking.");
    registerLastError("STATUS_THINKING", "Falha registrando estado thinking", firebase.lastHttpCode());
  }

  // ============================================================
  // OBTER NOVAMENTE A IMAGEM ATUAL
  // ============================================================

  FirebaseJsonData currentImageData;

  if (!stateJson.get(
          currentImageData,
          "currentImageId"))
  {
    Serial.println(
        "INFO: currentImageId nao encontrado.");

    registerLastError("INFO_NO_IMAGE", "Estado nao possui currentImageId");
    return;
  }

  String currentImageId =
      currentImageData.to<String>();

  if (currentImageId.length() == 0)
  {
    Serial.println(
        "INFO: nenhuma imagem atual.");

    registerLastError("INFO_NO_CURRENT_IMAGE", "Nenhuma imagem atual registrada");
    return;
  }

  // ============================================================
  // RESTAURAR IMAGEM
  // ============================================================

  String imagePath =
      "/" + currentImageId + ".bin";

  Serial.println(
      "INFO: restaurando imagem original.");

  if (!displayImageFromSD(
          imagePath.c_str()))
  {
    Serial.println(
        "INFO: nao foi possivel restaurar a imagem.");

    registerLastError("INFO_RESTORE", "Falha restaurando imagem do SD");
    return;
  }

  if (!setProcessingStatus(
          deviceId,
          "idle"))
  {
    Serial.println(
        "PROCESSING: nao foi possivel registrar idle.");
    registerLastError("STATUS_IDLE", "Falha registrando estado idle", firebase.lastHttpCode());
  }

  Serial.println(
      "INFO: imagem original restaurada.");
}

void wifi()
{
  Serial.println(
      "=== WIFI ===");

  firebase.begin(
      API_KEY,
      STORAGE_BUCKET_ID,
      Serial);

  if (wifiManager.startConfiguration())
  {
    syncDevice();
  }
  else
  {
    registerLastError("WIFI_PROVISION", "Falha no provisionamento Wi-Fi ou Firebase");
  }

  Serial.println(
      "END Info");
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
      INPUT_PULLUP);

  pinMode(
      BUTTON_3,
      INPUT_PULLUP);

  pinMode(
      BUTTON_INFO,
      INPUT_PULLUP);

  pinMode(
      BUTTON_WIFI,
      INPUT_PULLUP);

  pinMode(
      EPD_BUSY,
      INPUT);

  pinMode(
      EPD_RST,
      OUTPUT);

  pinMode(
      EPD_DC,
      OUTPUT);

  pinMode(
      EPD_CS,
      OUTPUT);

  digitalWrite(
      EPD_CS,
      HIGH);

  Serial.println();

  Serial.println(
      "=== QUADRO E-INK ===");

  esp_sleep_wakeup_cause_t reason =
      esp_sleep_get_wakeup_cause();

  // ============================================================
  // MOTIVO DO WAKE
  // ============================================================

  switch (reason)
  {
  case ESP_SLEEP_WAKEUP_EXT1:

    Serial.println(
        "Acordou pelo botao 3 / GPIO9.");

    break;

  case ESP_SLEEP_WAKEUP_TIMER:

    Serial.println(
        "Acordou pelo TIMER.");

    break;

  case ESP_SLEEP_WAKEUP_UNDEFINED:

    Serial.println(
        "Boot normal.");

    break;

  default:

    Serial.print(
        "Outro motivo de wake: ");

    Serial.println(
        reason);

    break;
  }

  // ============================================================
  // ACORDOU PELO TIMER
  // ============================================================

  if (reason == ESP_SLEEP_WAKEUP_TIMER)
  {
    for (int attempt = 1; attempt <= 3; attempt++)
    {
      if (syncDevice())
        break;

      if (attempt < 3)
      {
        Serial.printf(
            "SYNC falhou. Tentativa %d/3 concluida.\n",
            attempt);

        delay(1000);
      }
      else
      {
        Serial.println(
            "SYNC falhou apos 3 tentativas.");
      }
    }
  }

  // ============================================================
  // ACORDOU PELO BOTAO 3 OU BOOT NORMAL
  // ============================================================

  else if (
      reason == ESP_SLEEP_WAKEUP_EXT1 || reason == ESP_SLEEP_WAKEUP_UNDEFINED)
  {
    Serial.println();

    Serial.println(
        "Solte o botao 3...");

    waitButtonRelease(
        BUTTON_3);

    Serial.println(
        "Botao 3 solto.");

    Serial.println(
        "Agora aperte o segundo botao:");

    bool actionDetected = false;

    unsigned long startTime =
        millis();

    while (!actionDetected)
    {
      if (
          digitalRead(BUTTON_SYNC) ==
          LOW)
      {
        Serial.println(
            "SYNC");

        actionDetected = true;

        syncDevice();
      }

      else if (
          digitalRead(BUTTON_3) ==
          LOW)
      {
        Serial.println(
            "BUTTON_3");

        actionDetected = true;

        button_3();
      }

      else if (
          digitalRead(BUTTON_INFO) ==
          LOW)
      {
        Serial.println(
            "INFO");

        actionDetected = true;

        info();
      }

      else if (
          digitalRead(BUTTON_WIFI) ==
          LOW)
      {
        Serial.println(
            "WIFI");

        actionDetected = true;

        wifi();
      }

      if (
          !actionDetected &&
          millis() - startTime >= 10000)
      {
        Serial.println(
            "Timeout aguardando segundo botao.");

        break;
      }

      delay(20);
    }
  }

  Serial.println(
      "END Setup");

  // ============================================================
  // DEEP SLEEP
  // ============================================================

  esp_sleep_enable_ext1_wakeup_io(
      (1ULL << BUTTON_3),
      ESP_EXT1_WAKEUP_ANY_LOW);

  delay(2000); // IMPORTANTE!!! NÃO RETIRAR

  Serial.flush();

  uint64_t sleepSeconds = 0;

  // Fotos temporarias podem definir uma duracao propria.
  if (nextSleepMinutes > 0)
  {
    sleepSeconds = (uint64_t)nextSleepMinutes * 60ULL;

    Serial.println("SLEEP: usando duracao da foto temporaria.");
  }
  else
  {
    // Comportamento normal: dormir ate o proximo horario.
    if (!secondsUntilNextScheduledUpdate(sleepSeconds))
    {
      // Fallback para configuracao ausente ou horario invalido.
      sleepSeconds = 120ULL * 60ULL;

      Serial.println(
          "SCHEDULE: usando fallback de 120 minutos.");
    }
  }

  Serial.println();
  Serial.print("Entrando em deep sleep por ");
  Serial.print(sleepSeconds / 60ULL);
  Serial.println(" minutos...");

  esp_sleep_enable_timer_wakeup(
      (uint64_t)(sleepSeconds * 1000000.0 * 1.011257)); // Ajuste para compensar o erro do timer do ESP32

  delay(500);

  esp_deep_sleep_start();
}

void loop()
{
}