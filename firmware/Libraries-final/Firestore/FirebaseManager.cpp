#include "FirebaseManager.h"

void FirebaseManager::begin(
    const char *apiKey,
    const char *bucket,
    Stream &serial)
{
  _bucket = bucket;
  _serial = &serial;

  _config.api_key = apiKey;

  _config.fcs.download_buffer_size = 2048;
}

bool FirebaseManager::authenticate()
{
  _preferences.begin("firebase", false);

  String refreshToken =
      _preferences.getString("refreshToken", "");

  _preferences.end();

  _serial->println();
  _serial->println("Lendo refresh token da NVS...");

  _serial->print("Tamanho: ");
  _serial->println(refreshToken.length());

  if (refreshToken.length() == 0)
  {
    _serial->println(
        "ERRO: nenhum refresh token encontrado.");

    return false;
  }

  _serial->println("Refresh token encontrado.");
  _serial->println("Restaurando sessao...");

  Firebase.reconnectNetwork(true);

  Firebase.setIdToken(
      &_config,
      "",
      3600,
      refreshToken.c_str());

  _serial->println("setIdToken() retornou.");

  _serial->println("Chamando Firebase.begin()...");

  Firebase.begin(
      &_config,
      &_auth);

  _serial->println("Firebase.begin() retornou. - Chamando Firebase.ready()...");

  bool ready = Firebase.ready();

  _serial->println("Firebase.ready() retornou.");

  if (ready)
  {
    _serial->println("Firebase esta READY.");
  }
  else
  {
    _serial->println("Firebase NAO esta READY.");
  }

  return ready;
}

bool FirebaseManager::markTemporaryPhotoConsumed(
    const char *deviceId,
    const char *photoId,
    const char *consumedAt)
{
  String path =
      "devices/" + String(deviceId) +
      "/temporaryPhotos/" + String(photoId);

  FirebaseJson document;

  document.set(
      "fields/consumedAt/timestampValue",
      consumedAt);

  if (Firebase.Firestore.patchDocument(
          &_fbdo,
          "einkcanvas",
          "",
          path.c_str(),
          document.raw(),
          "consumedAt"))
  {
    _serial->println(
        "TEMPORARY: foto marcada como consumida.");

    return true;
  }

  _serial->println(
      "TEMPORARY: erro ao marcar como consumida:");

  _serial->println(
      _fbdo.errorReason());

  return false;
}

bool FirebaseManager::listCollections(
    const char *deviceId)
{
  String path =
      "devices/" + String(deviceId) +
      "/collections";

  Serial.println("LIST COLLECTIONS: ANTES DO FIREBASE");

  if (Firebase.Firestore.listDocuments(
          &_fbdo,
          "einkcanvas",
          "",
          path.c_str(),
          100,
          "",
          "",
          "",
          false))
  {
    Serial.println("LIST COLLECTIONS: FIREBASE RETORNOU");

    _serial->println("COLLECTIONS: LEITURA OK!");

    String payload = _fbdo.payload();

    _serial->println(payload);

    Serial.println("LIST COLLECTIONS: DEPOIS DO PAYLOAD");

    return true;
  }

  _serial->println("COLLECTIONS: ERRO:");
  _serial->println(_fbdo.errorReason());

  Serial.println("LIST COLLECTIONS: RETORNOU FALSE");

  return false;
}

bool FirebaseManager::syncPhotos(
    const char *deviceId,
    String &output)
{
  String collectionsPath =
      "devices/" + String(deviceId) +
      "/collections";

  if (!Firebase.Firestore.listDocuments(
          &_fbdo,
          "einkcanvas",
          "",
          collectionsPath.c_str(),
          100,
          "",
          "",
          "",
          false))
  {
    _serial->println("PHOTOS: ERRO AO LER COLLECTIONS:");
    _serial->println(_fbdo.errorReason());

    return false;
  }

  FirebaseJson collectionsJson;
  collectionsJson.setJsonData(_fbdo.payload());

  FirebaseJsonData data;

  if (!collectionsJson.get(
          data,
          "documents"))
  {
    _serial->println("PHOTOS: COLLECTIONS SEM DOCUMENTOS.");

    return false;
  }

  FirebaseJsonArray collectionsArray;

  if (!data.getArray(collectionsArray))
  {
    _serial->println(
        "PHOTOS: ERRO AO CONVERTER COLLECTIONS.");

    return false;
  }

  FirebaseJson photosJson;
  FirebaseJsonArray photosCollections;

  for (
      size_t i = 0;
      i < collectionsArray.size();
      i++)
  {
    FirebaseJsonData collectionData;

    if (!collectionsArray.get(
            collectionData,
            i))
    {
      continue;
    }

    FirebaseJson collectionDocument;

    if (!collectionData.getJSON(
            collectionDocument))
    {
      continue;
    }

    FirebaseJsonData nameData;
    FirebaseJsonData fieldsData;

    collectionDocument.get(
        nameData,
        "name");

    collectionDocument.get(
        fieldsData,
        "fields");

    String documentName =
        nameData.to<String>();

    int slash =
        documentName.lastIndexOf('/');

    if (slash < 0)
      continue;

    String collectionId =
        documentName.substring(
            slash + 1);

    FirebaseJson fieldsJson;

    if (!fieldsData.getJSON(
            fieldsJson))
    {
      continue;
    }

    FirebaseJsonData collectionActive;

    fieldsJson.get(
        collectionActive,
        "active/booleanValue");

    FirebaseJson collectionJson;

    collectionJson.set(
        "id",
        collectionId);

    collectionJson.set(
        "active",
        collectionActive.to<bool>());

    String imagesPath =
        collectionsPath +
        "/" + collectionId +
        "/images";

    if (!Firebase.Firestore.listDocuments(
            &_fbdo,
            "einkcanvas",
            "",
            imagesPath.c_str(),
            100,
            "",
            "",
            "",
            false))
    {
      _serial->println(
          "PHOTOS: ERRO AO LER IMAGES:");

      _serial->println(
          _fbdo.errorReason());

      return false;
    }

    FirebaseJson imagesResponse;

    imagesResponse.setJsonData(
        _fbdo.payload());

    FirebaseJsonArray imagesArray;

    FirebaseJsonData documentsData;

    if (
        imagesResponse.get(
            documentsData,
            "documents"))
    {
      documentsData.getArray(
          imagesArray);
    }

    FirebaseJsonArray outputImages;

    for (
        size_t j = 0;
        j < imagesArray.size();
        j++)
    {
      FirebaseJsonData imageData;

      if (!imagesArray.get(
              imageData,
              j))
      {
        continue;
      }

      FirebaseJson imageDocument;

      if (!imageData.getJSON(
              imageDocument))
      {
        continue;
      }

      FirebaseJsonData imageNameData;
      FirebaseJsonData imageFieldsData;

      imageDocument.get(
          imageNameData,
          "name");

      imageDocument.get(
          imageFieldsData,
          "fields");

      String imageDocumentName =
          imageNameData.to<String>();

      int imageSlash =
          imageDocumentName.lastIndexOf('/');

      if (imageSlash < 0)
        continue;

      String imageId =
          imageDocumentName.substring(
              imageSlash + 1);

      FirebaseJson imageFields;

      if (!imageFieldsData.getJSON(
              imageFields))
      {
        continue;
      }

      FirebaseJsonData active;
      FirebaseJsonData epaperFilePath;
      FirebaseJsonData width;
      FirebaseJsonData height;
      FirebaseJsonData createdAt;
      FirebaseJsonData description;

      imageFields.get(
          active,
          "active/booleanValue");

      imageFields.get(
          epaperFilePath,
          "epaperFilePath/stringValue");

      imageFields.get(
          width,
          "width/integerValue");

      imageFields.get(
          height,
          "height/integerValue");

      imageFields.get(
          createdAt,
          "createdAt/timestampValue");

      FirebaseJson imageJson;

      imageJson.set(
          "id",
          imageId);

      imageJson.set(
          "active",
          active.to<bool>());

      imageJson.set(
          "epaperFilePath",
          epaperFilePath.to<String>());

      imageJson.set(
          "width",
          width.to<int>());

      imageJson.set(
          "height",
          height.to<int>());

      imageJson.set(
          "createdAt",
          createdAt.to<String>());

      if (
          imageFields.get(
              description,
              "description/stringValue"))
      {
        imageJson.set(
            "description",
            description.to<String>());
      }

      outputImages.add(
          imageJson);
    }

    collectionJson.set(
        "images",
        outputImages);

    photosCollections.add(
        collectionJson);
  }

  photosJson.set(
      "collections",
      photosCollections);

  photosJson.toString(output, false);

  _serial->printf("PHOTOS: resumo montado (%u bytes).\n", (unsigned)output.length());

  return true;
}

bool FirebaseManager::syncTemporaryPhotos(
    const char *deviceId,
    String &output)
{
  String path =
      "devices/" +
      String(deviceId) +
      "/temporaryPhotos";

  if (!Firebase.Firestore.listDocuments(
          &_fbdo,
          "einkcanvas",
          "",
          path.c_str(),
          100,
          "",
          "",
          "",
          false))
  {
    _serial->println("TEMPORARY PHOTOS: ERRO AO LISTAR DOCUMENTOS:");
    _serial->println(_fbdo.errorReason());

    return false;
  }

  FirebaseJson response;
  response.setJsonData(_fbdo.payload());

  FirebaseJsonData documentsData;

  output = "{\"temporaryPhotos\":[";

  if (!response.get(
          documentsData,
          "documents"))
  {
    output += "]}";

    _serial->println();
    _serial->println("=== TEMPORARY PHOTOS JSON ===");
    _serial->println(output);
    _serial->println("TEMPORARY PHOTOS: NENHUMA FOTO.");

    return true;
  }

  FirebaseJsonArray documents;
  documents.setJsonArrayData(documentsData.to<String>());

  size_t count = documents.size();

  for (size_t i = 0; i < count; i++)
  {
    FirebaseJsonData documentData;

    if (!documents.get(
            documentData,
            i))
    {
      continue;
    }

    FirebaseJson document;
    document.setJsonData(documentData.to<String>());

    FirebaseJsonData nameData;
    FirebaseJsonData fieldsData;

    document.get(
        nameData,
        "name");

    document.get(
        fieldsData,
        "fields");

    String name = nameData.to<String>();
    String fieldsJson = fieldsData.to<String>();

    int lastSlash = name.lastIndexOf('/');

    String id;

    if (lastSlash >= 0)
    {
      id = name.substring(lastSlash + 1);
    }
    else
    {
      id = name;
    }

    FirebaseJson fields;
    fields.setJsonData(fieldsJson);

    FirebaseJsonData data;

    String createdByUid = "";
    String previewPath = "";
    String epaperFilePath = "";
    String recurrence = "";
    String createdAt = "";
    String consumedAt = "";

    int width = 0;
    int height = 0;
    int durationMinutes = 0;

    if (fields.get(
            data,
            "createdByUid/stringValue"))
    {
      createdByUid = data.to<String>();
    }

    if (fields.get(
            data,
            "previewPath/stringValue"))
    {
      previewPath = data.to<String>();
    }

    if (fields.get(
            data,
            "epaperFilePath/stringValue"))
    {
      epaperFilePath = data.to<String>();
    }

    if (fields.get(
            data,
            "width/integerValue"))
    {
      width = data.to<int>();
    }

    if (fields.get(
            data,
            "height/integerValue"))
    {
      height = data.to<int>();
    }

    if (fields.get(
            data,
            "recurrence/stringValue"))
    {
      recurrence = data.to<String>();
    }

    if (fields.get(
            data,
            "durationMinutes/integerValue"))
    {
      durationMinutes = data.to<int>();
    }

    if (fields.get(
            data,
            "createdAt/timestampValue"))
    {
      createdAt = data.to<String>();
    }

    if (fields.get(
            data,
            "consumedAt/timestampValue"))
    {
      consumedAt = data.to<String>();
    }

    if (i > 0)
    {
      output += ",";
    }

    output += "{";

    output += "\"id\":\"";
    output += id;
    output += "\",";

    output += "\"createdByUid\":\"";
    output += createdByUid;
    output += "\",";

    output += "\"previewPath\":\"";
    output += previewPath;
    output += "\",";

    output += "\"epaperFilePath\":\"";
    output += epaperFilePath;
    output += "\",";

    output += "\"width\":";
    output += String(width);
    output += ",";

    output += "\"height\":";
    output += String(height);
    output += ",";

    output += "\"recurrence\":\"";
    output += recurrence;
    output += "\"";

    if (recurrence == "once")
    {
      output += ",\"durationMinutes\":";
      output += String(durationMinutes);
    }

    if (recurrence == "yearly")
    {
      FirebaseJsonData yearlyDateData;

      if (fields.get(
              yearlyDateData,
              "yearlyDate/mapValue/fields"))
      {
        FirebaseJson yearlyFields;
        yearlyFields.setJsonData(
            yearlyDateData.to<String>());

        int month = 0;
        int day = 0;

        if (yearlyFields.get(
                data,
                "month/integerValue"))
        {
          month = data.to<int>();
        }

        if (yearlyFields.get(
                data,
                "day/integerValue"))
        {
          day = data.to<int>();
        }

        output += ",\"yearlyDate\":{";

        output += "\"month\":";
        output += String(month);
        output += ",";

        output += "\"day\":";
        output += String(day);

        output += "}";
      }
    }

    output += ",\"createdAt\":\"";
    output += createdAt;
    output += "\"";

    if (consumedAt.length() > 0)
    {
      output += ",\"consumedAt\":\"";
      output += consumedAt;
      output += "\"";
    }

    output += "}";
  }

  output += "]}";

  _serial->println();
  _serial->println("=== TEMPORARY PHOTOS JSON ===");
  _serial->println(output);
  _serial->println("TEMPORARY PHOTOS: JSON MONTADO!");

  return true;
}

bool FirebaseManager::listImages(
    const char *deviceId,
    const char *collectionId)
{
  String path =
      "devices/" + String(deviceId) +
      "/collections/" + String(collectionId) +
      "/images";

  if (Firebase.Firestore.listDocuments(
          &_fbdo,
          "einkcanvas",
          "",
          path.c_str(),
          100,
          "",
          "",
          "",
          false))
  {
    _serial->println("IMAGES: LEITURA OK!");
    _serial->println(_fbdo.payload());

    return true;
  }

  _serial->println("IMAGES: ERRO:");
  _serial->println(_fbdo.errorReason());

  return false;
}

bool FirebaseManager::readDeviceConfig(
    const char *deviceId,
    String &output)
{
  String devicePath =
      "devices/" + String(deviceId);

  if (!Firebase.Firestore.getDocument(
          &_fbdo,
          "einkcanvas",
          "",
          devicePath.c_str(),
          ""))
  {
    _serial->println("DEVICE: ERRO NA LEITURA:");
    _serial->println(_fbdo.errorReason());

    return false;
  }

  _serial->println("DEVICE: LEITURA OK!");

  FirebaseJson deviceJson;
  deviceJson.setJsonData(_fbdo.payload());

  FirebaseJsonData fieldsData;

  if (!deviceJson.get(fieldsData, "fields"))
  {
    _serial->println("DEVICE: fields nao encontrado.");
    return false;
  }

  FirebaseJson fields;

  if (!fieldsData.getJSON(fields))
  {
    _serial->println("DEVICE: erro ao ler fields.");
    return false;
  }

  FirebaseJsonData deviceAuthUidData;
  FirebaseJsonData nameData;
  FirebaseJsonData ownerUidData;
  FirebaseJsonData updateTimesData;

  fields.get(
      deviceAuthUidData,
      "deviceAuthUid/stringValue");

  fields.get(
      nameData,
      "name/stringValue");

  fields.get(
      ownerUidData,
      "ownerUid/stringValue");

  FirebaseJsonArray updateTimesArray;

  if (!fields.get(
          updateTimesData,
          "updateTimes/arrayValue/values"))
  {
    _serial->println(
        "DEVICE: updateTimes nao encontrado.");

    return false;
  }

  if (!updateTimesData.getArray(updateTimesArray))
  {
    _serial->println(
        "DEVICE: erro ao converter updateTimes.");

    return false;
  }

  FirebaseJsonArray outputUpdateTimes;

  for (
      size_t i = 0;
      i < updateTimesArray.size();
      i++)
  {
    FirebaseJsonData timeData;

    if (!updateTimesArray.get(timeData, i))
    {
      continue;
    }

    FirebaseJson timeJson;

    if (!timeData.getJSON(timeJson))
    {
      _serial->println(
          "DEVICE: erro ao ler horario em updateTimes.");

      return false;
    }

    FirebaseJsonData timeValueData;

    if (!timeJson.get(timeValueData, "stringValue"))
    {
      _serial->println(
          "DEVICE: stringValue nao encontrado em updateTimes.");

      return false;
    }

    String time = timeValueData.to<String>();

    if (
        time.length() != 5 ||
        time.charAt(2) != ':' ||
        !isDigit(time.charAt(0)) ||
        !isDigit(time.charAt(1)) ||
        !isDigit(time.charAt(3)) ||
        !isDigit(time.charAt(4)) ||
        time.substring(0, 2).toInt() > 23 ||
        time.substring(3, 5).toInt() > 59)
    {
      _serial->println(
          "DEVICE: horario invalido em updateTimes.");

      return false;
    }

    outputUpdateTimes.add(time);
  }

  if (outputUpdateTimes.size() == 0)
  {
    _serial->println(
        "DEVICE: nenhum horario configurado.");

    return false;
  }

  String displayPath =
      devicePath + "/config/display";

  if (!Firebase.Firestore.getDocument(
          &_fbdo,
          "einkcanvas",
          "",
          displayPath.c_str(),
          ""))
  {
    _serial->println("DISPLAY: ERRO NA LEITURA:");
    _serial->println(_fbdo.errorReason());

    return false;
  }

  _serial->println("DISPLAY: LEITURA OK!");

  FirebaseJson displayJson;
  displayJson.setJsonData(_fbdo.payload());

  FirebaseJsonData displayFieldsData;

  if (!displayJson.get(
          displayFieldsData,
          "fields"))
  {
    _serial->println("DISPLAY: fields nao encontrado.");
    return false;
  }

  FirebaseJson displayFields;

  if (!displayFieldsData.getJSON(displayFields))
  {
    _serial->println("DISPLAY: erro ao ler fields.");
    return false;
  }

  FirebaseJsonData orientationData;

  displayFields.get(
      orientationData,
      "orientation/stringValue");

  FirebaseJson configJson;

  configJson.set(
      "deviceAuthUid",
      deviceAuthUidData.to<String>());

  configJson.set(
      "name",
      nameData.to<String>());

  configJson.set(
      "ownerUid",
      ownerUidData.to<String>());

  configJson.set(
      "updateTimes",
      outputUpdateTimes);

  configJson.set(
      "orientation",
      orientationData.to<String>());

  configJson.toString(
      output,
      false);

  _serial->println();
  _serial->println("=== CONFIG JSON ===");
  _serial->println(output);
  _serial->println("CONFIG: JSON MONTADO!");

  return true;
}

bool FirebaseManager::createAnonymousSession(
    String &uid)
{
  _serial->println();
  _serial->println(
      "Criando nova sessao Anonymous...");

  Firebase.reconnectNetwork(true);

  if (!Firebase.signUp(
          &_config,
          &_auth,
          "",
          ""))
  {
    _serial->println();
    _serial->println(
        "ERRO AO CRIAR SESSAO:");

    _serial->println(
        _config.signer.signupError.message.c_str());

    return false;
  }

  uid = _auth.token.uid.c_str();

  _serial->println();
  _serial->println(
      "=== SESSAO CRIADA ===");

  _serial->print(
      "UID: ");

  _serial->println(
      uid);

  Firebase.begin(
      &_config,
      &_auth);

  _serial->println(
      "Firebase iniciado.");

  unsigned long start =
      millis();

  while (!Firebase.ready())
  {
    delay(100);

    if (millis() - start > 15000)
    {
      _serial->println(
          "Timeout aguardando Firebase.");

      return false;
    }
  }

  _serial->println(
      "Firebase autenticado.");

  const char *refreshToken =
      Firebase.getRefreshToken();

  if (
      refreshToken == nullptr ||
      strlen(refreshToken) == 0)
  {
    _serial->println(
        "ERRO: refresh token vazio.");

    return false;
  }

  _preferences.begin(
      "firebase",
      false);

  size_t saved =
      _preferences.putString(
          "refreshToken",
          refreshToken);

  _preferences.end();

  if (saved == 0)
  {
    _serial->println(
        "ERRO: nao foi possivel salvar o refresh token.");

    return false;
  }

  _serial->println(
      "Refresh token salvo no NVS.");

  return true;
}

bool FirebaseManager::writeState(
    const char *deviceId,
    const String &state)
{
  String path =
      "devices/" + String(deviceId) +
      "/state/current";

  FirebaseJson document;

  document.set(
      "fields/state/stringValue",
      state);

  if (Firebase.Firestore.patchDocument(
          &_fbdo,
          "einkcanvas",
          "",
          path.c_str(),
          document.raw(),
          "state"))
  {
    _serial->println("STATE: ATUALIZADO!");
    return true;
  }

  _serial->println("STATE: ERRO AO ATUALIZAR:");
  _serial->println(_fbdo.errorReason());

  return false;
}

bool FirebaseManager::writeProcessingStatus(
    const char *deviceId,
    const String &status,
    const char *updatedAt)
{
  String path =
      "devices/" + String(deviceId) +
      "/state/current";

  FirebaseJson document;

  document.set(
      "fields/processing/mapValue/fields/status/stringValue",
      status);

  document.set(
      "fields/processing/mapValue/fields/updatedAt/timestampValue",
      updatedAt);

  if (Firebase.Firestore.patchDocument(
          &_fbdo,
          "einkcanvas",
          "",
          path.c_str(),
          document.raw(),
          "processing"))
  {
    _serial->println(
        "PROCESSING: STATUS ATUALIZADO!");

    return true;
  }

  _serial->println(
      "PROCESSING: ERRO AO ATUALIZAR:");

  _serial->println(
      _fbdo.errorReason());

  return false;
}

bool FirebaseManager::writeLastError(
    const char *deviceId,
    const String &code,
    const String &message,
    const String &occurredAtUtc,
    int httpCode)
{
  if (!deviceId || !deviceId[0] || WiFi.status() != WL_CONNECTED ||
      !Firebase.ready())
    return false;

  // Documento com ID constante: patch substitui os campos do ultimo erro.
  const String path = String("devices/") + deviceId + "/diagnostics/lastError";
  FirebaseJson payload;
  payload.set("fields/code/stringValue", code);
  payload.set("fields/message/stringValue", message);
  payload.set("fields/occurredAtUtc/stringValue",
              occurredAtUtc.length() ? occurredAtUtc : String("unknown"));
  payload.set("fields/timeKnown/booleanValue", occurredAtUtc.length() > 0);
  payload.set("fields/httpCode/integerValue", String(httpCode));

  const bool ok = Firebase.Firestore.patchDocument(
      &_fbdo, "einkcanvas", "", path.c_str(), payload.raw(),
      "code,message,occurredAtUtc,timeKnown,httpCode");
  if (!ok && _serial)
  {
    _serial->print("DIAGNOSTICS: nao foi possivel enviar ultimo erro: ");
    _serial->println(_fbdo.errorReason());
  }
  return ok;
}

int FirebaseManager::lastHttpCode()
{
  return _fbdo.httpCode();
}

static void firebaseDownloadCallback(
    FCS_DownloadStatusInfo info)
{
  if (info.status == firebase_fcs_download_status_init)
  {
    Serial.printf(
        "Baixando: %s (%d bytes)\n",
        info.remoteFileName.c_str(),
        info.fileSize);
  }
  else if (info.status == firebase_fcs_download_status_download)
  {
    Serial.printf(
        "Progresso: %d%%\n",
        (int)info.progress);
  }
  else if (info.status == firebase_fcs_download_status_complete)
  {
    Serial.println("Download concluído!");
  }
  else if (info.status == firebase_fcs_download_status_error)
  {
    Serial.printf(
        "Erro no download: %s\n",
        info.errorMsg.c_str());
  }
}

bool FirebaseManager::readDevicePriority(
    const char *deviceId,
    String &collectionId,
    String &imageId,
    bool &hasPriority)
{
  collectionId = "";
  imageId = "";
  hasPriority = false;

  String priorityPath =
      "devices/" + String(deviceId) +
      "/config/priority";

  _serial->println();
  _serial->println("PRIORITY: lendo configuracao...");

  if (!Firebase.Firestore.getDocument(
          &_fbdo,
          "einkcanvas",
          "",
          priorityPath.c_str(),
          ""))
  {
    String error = _fbdo.errorReason();

    _serial->println(
        "PRIORITY: erro na leitura:");

    _serial->println(error);

    // O documento pode simplesmente ainda não existir.
    // Nesse caso, não há prioridade.
    if (
        error.indexOf("NOT_FOUND") >= 0 ||
        error.indexOf("not found") >= 0)
    {
      _serial->println(
          "PRIORITY: documento nao existe. Nenhuma prioridade.");

      return true;
    }

    return false;
  }

  _serial->println(
      "PRIORITY: documento lido.");

  FirebaseJson priorityJson;

  if (!priorityJson.setJsonData(
          _fbdo.payload()))
  {
    _serial->println(
        "PRIORITY: JSON invalido.");

    return false;
  }

  FirebaseJsonData fieldsData;

  if (!priorityJson.get(
          fieldsData,
          "fields"))
  {
    _serial->println(
        "PRIORITY: fields nao encontrado.");

    return false;
  }

  FirebaseJson fields;

  if (!fieldsData.getJSON(fields))
  {
    _serial->println(
        "PRIORITY: erro ao ler fields.");

    return false;
  }

  FirebaseJsonData collectionIdData;
  FirebaseJsonData imageIdData;

  fields.get(
      collectionIdData,
      "collectionId/stringValue");

  fields.get(
      imageIdData,
      "imageId/stringValue");

  collectionId =
      collectionIdData.to<String>();

  imageId =
      imageIdData.to<String>();

  if (
      collectionId.length() == 0 ||
      imageId.length() == 0)
  {
    _serial->println(
        "PRIORITY: prioridade vazia.");

    return true;
  }

  hasPriority = true;

  _serial->println(
      "=== PRIORIDADE ===");

  _serial->print(
      "Collection ID: ");

  _serial->println(
      collectionId);

  _serial->print(
      "Image ID: ");

  _serial->println(
      imageId);

  return true;
}

bool FirebaseManager::clearDevicePriority(
    const char *deviceId)
{
  String priorityPath =
      "devices/" + String(deviceId) +
      "/config/priority";

  _serial->println(
      "PRIORITY: removendo documento...");

  if (Firebase.Firestore.deleteDocument(
          &_fbdo,
          "einkcanvas",
          "",
          priorityPath.c_str(),
          ""))
  {
    _serial->println(
        "PRIORITY: documento removido.");

    return true;
  }

  _serial->println(
      "PRIORITY: erro ao remover:");

  _serial->println(
      _fbdo.errorReason());

  return false;
}

bool FirebaseManager::downloadImage(
    const char *remotePath,
    const char *localPath)
{
  if (Firebase.Storage.download(
          &_fbdo,
          _bucket,
          remotePath,
          localPath,
          mem_storage_type_sd,
          firebaseDownloadCallback))
  {
    _serial->println("IMAGE: DOWNLOAD OK!");
    return true;
  }

  _serial->println("IMAGE: ERRO NO DOWNLOAD:");
  _serial->println(_fbdo.errorReason());

  return false;
}
// INK CANVAS v4: catalogos paginados em SD, sem alterar schema Firestore.
// Cada resposta contem no maximo quatro documentos; nenhum catalogo e acumulado em RAM.
#include <SD.h>

namespace {
constexpr int kCatalogPageSize = 4;
constexpr int kMaxCatalogPages = 10000; // Falhar explicitamente, jamais produzir catalogo truncado.

String catalogDocumentId(const String &name) {
  const int slash = name.lastIndexOf('/');
  return slash >= 0 ? name.substring(slash + 1) : name;
}

String catalogFieldString(FirebaseJson &fields, const char *path) {
  FirebaseJsonData d;
  return fields.get(d, path) ? d.to<String>() : String("");
}

int catalogFieldInt(FirebaseJson &fields, const char *path) {
  FirebaseJsonData d;
  return fields.get(d, path) ? d.to<int>() : 0;
}

bool catalogFieldBool(FirebaseJson &fields, const char *path) {
  FirebaseJsonData d;
  return fields.get(d, path) && d.to<bool>();
}

bool catalogWriteRow(File &file, FirebaseJson &row) {
  String line;
  row.toString(line, false);
  // Limite tambem na geracao: o leitor jamais encontrara um registro maior.
  if (line.length() > 8192) return false;
  return file.println(line) == line.length() + 2; // println: CRLF no ESP32
}

typedef bool (*CatalogWriter)(FirebaseJson &fields, const String &id, File &file, void *ctx);

bool catalogWriteCollection(FirebaseJson &fields, const String &id, File &file, void *) {
  FirebaseJson row;
  row.set("type", "collection");
  row.set("id", id);
  row.set("active", catalogFieldBool(fields, "active/booleanValue"));
  return catalogWriteRow(file, row);
}

bool catalogWriteImage(FirebaseJson &fields, const String &id, File &file, void *context) {
  const String &collectionId = *static_cast<String *>(context);
  FirebaseJson row;
  row.set("type", "image");
  row.set("collectionId", collectionId);
  row.set("id", id);
  row.set("active", catalogFieldBool(fields, "active/booleanValue"));
  row.set("width", catalogFieldInt(fields, "width/integerValue"));
  row.set("height", catalogFieldInt(fields, "height/integerValue"));
  row.set("epaperFilePath", catalogFieldString(fields, "epaperFilePath/stringValue"));
  // O botao INFO consulta descricao da imagem atual.
  row.set("description", catalogFieldString(fields, "description/stringValue"));
  return catalogWriteRow(file, row);
}

bool catalogWriteTemporary(FirebaseJson &fields, const String &id, File &file, void *) {
  FirebaseJson row;
  row.set("id", id);
  const String recurrence = catalogFieldString(fields, "recurrence/stringValue");
  row.set("recurrence", recurrence);
  row.set("epaperFilePath", catalogFieldString(fields, "epaperFilePath/stringValue"));
  row.set("width", catalogFieldInt(fields, "width/integerValue"));
  row.set("height", catalogFieldInt(fields, "height/integerValue"));
  row.set("createdAt", catalogFieldString(fields, "createdAt/timestampValue"));
  if (recurrence == "once") {
    FirebaseJsonData duration;
    if (fields.get(duration, "durationMinutes/integerValue"))
      row.set("durationMinutes", duration.to<int>());
  } else if (recurrence == "yearly") {
    row.set("yearlyDate/month", catalogFieldInt(fields, "yearlyDate/mapValue/fields/month/integerValue"));
    row.set("yearlyDate/day", catalogFieldInt(fields, "yearlyDate/mapValue/fields/day/integerValue"));
  }
  const String consumedAt = catalogFieldString(fields, "consumedAt/timestampValue");
  if (consumedAt.length()) row.set("consumedAt", consumedAt);
  return catalogWriteRow(file, row);
}

// Retorna pagina completa e extrai o proximo token ANTES de outra chamada na mesma FirebaseData.
bool catalogReadPage(FirebaseData &fbdo, Stream &serial, const String &path,
                     const String &token, FirebaseJson &response) {
  if (!Firebase.Firestore.listDocuments(&fbdo, "einkcanvas", "", path.c_str(),
                                        kCatalogPageSize, token.c_str(), "", "", false)) {
    serial.print("CATALOGO: Falha ao consultar "); serial.println(path);
    serial.println(fbdo.errorReason());
    return false;
  }
  if (!response.setJsonData(fbdo.payload())) {
    serial.println("CATALOGO: JSON do Firestore invalido");
    return false;
  }
  return true;
}

// Callback por documento para escrita incremental, sem guardar arrays entre paginas.
bool catalogWalkPage(FirebaseJson &response, File &file, CatalogWriter writer,
                     void *context, String &nextToken, int &rows) {
  FirebaseJsonData d;
  nextToken = response.get(d, "nextPageToken") ? d.to<String>() : String("");
  if (!response.get(d, "documents")) return true; // zero documentos
  FirebaseJsonArray docs;
  if (!d.getArray(docs)) return false;
  for (size_t i = 0; i < docs.size(); ++i) {
    FirebaseJsonData item;
    if (!docs.get(item, i)) return false;
    FirebaseJson doc;
    if (!item.getJSON(doc)) return false;
    FirebaseJsonData nameData, fieldsData;
    if (!doc.get(nameData, "name") || !doc.get(fieldsData, "fields")) return false;
    FirebaseJson fields;
    if (!fieldsData.getJSON(fields)) return false;
    if (!writer(fields, catalogDocumentId(nameData.to<String>()), file, context)) return false;
    ++rows;
  }
  return true;
}

// Restaura um backup interrompido pela falta de energia durante a troca de arquivo.
void catalogRestoreBackup(const char *path, const char *backup) {
  if (!SD.exists(path) && SD.exists(backup)) SD.rename(backup, path);
}

bool catalogPromote(const char *temp, const char *path, const char *backup) {
  catalogRestoreBackup(path, backup);
  SD.remove(backup);
  const bool hadOld = SD.exists(path);
  if (hadOld && !SD.rename(path, backup)) return false;
  if (!SD.rename(temp, path)) {
    if (hadOld) SD.rename(backup, path);
    return false;
  }
  if (hadOld) SD.remove(backup);
  return true;
}
}

bool FirebaseManager::syncPhotosToSD(const char *deviceId) {
  const char *temp = "/PHOTOS.TMP";
  const char *path = "/PHOTOS.ND";
  const char *backup = "/PHOTOS.BAK";
  catalogRestoreBackup(path, backup);
  SD.remove(temp);
  File file = SD.open(temp, FILE_WRITE);
  if (!file) return false;

  const String collectionsPath = "devices/" + String(deviceId) + "/collections";
  String token;
  int rows = 0, totalImages = 0;
  bool ok = true;
  int pages = 0;
  do {
    if (++pages > kMaxCatalogPages) { ok = false; break; }
    FirebaseJson response;
    if (!catalogReadPage(_fbdo, *_serial, collectionsPath, token, response)) { ok = false; break; }
    FirebaseJsonData documentsData;
    String nextToken;
    nextToken = response.get(documentsData, "nextPageToken")
                  ? documentsData.to<String>() : String("");
    if (nextToken.length() && nextToken == token) { ok = false; break; }
    FirebaseJsonArray docs;
    if (response.get(documentsData, "documents") && !documentsData.getArray(docs)) { ok = false; break; }
    for (size_t i = 0; ok && i < docs.size(); ++i) {
      FirebaseJsonData item;
      FirebaseJson doc;
      FirebaseJsonData name, fieldsData;
      FirebaseJson fields;
      if (!docs.get(item,i) || !item.getJSON(doc) ||
          !doc.get(name,"name") || !doc.get(fieldsData,"fields") ||
          !fieldsData.getJSON(fields)) { ok = false; break; }
      String collectionId = catalogDocumentId(name.to<String>());
      if (!catalogWriteCollection(fields, collectionId, file, nullptr)) { ok = false; break; }
      ++rows;
      const String imagesPath = collectionsPath + "/" + collectionId + "/images";
      String imageToken;
      int imagePages = 0;
      do {
        if (++imagePages > kMaxCatalogPages) { ok = false; break; }
        FirebaseJson imageResponse;
        if (!catalogReadPage(_fbdo, *_serial, imagesPath, imageToken, imageResponse)) { ok = false; break; }
        String nextImageToken;
        int pageRows = 0;
        if (!catalogWalkPage(imageResponse, file, catalogWriteImage,
                             &collectionId, nextImageToken, pageRows)) { ok = false; break; }
        totalImages += pageRows;
        if (nextImageToken.length() && nextImageToken == imageToken) { ok = false; break; }
        imageToken = nextImageToken;
        delay(0);
      } while (ok && imageToken.length());
    }
    token = nextToken;
    delay(0);
  } while (ok && token.length());

  file.flush();
  file.close();
  if (!ok) {
    SD.remove(temp);
    _serial->println("PHOTOS: catalogo incompleto descartado");
    return false;
  }
  if (!catalogPromote(temp, path, backup)) {
    _serial->println("PHOTOS: falha ao publicar catalogo no SD");
    return false;
  }
  _serial->printf("PHOTOS: SD OK, %d colecoes, %d imagens, %d paginas de colecoes\n",
                  rows, totalImages, pages);
  return true;
}

bool FirebaseManager::syncTemporaryPhotosToSD(const char *deviceId) {
  const char *temp = "/TEMP.TMP";
  const char *path = "/TEMP.ND";
  const char *backup = "/TEMP.BAK";
  catalogRestoreBackup(path, backup);
  SD.remove(temp);
  File file = SD.open(temp, FILE_WRITE);
  if (!file) return false;
  const String source = "devices/" + String(deviceId) + "/temporaryPhotos";
  String token;
  int count = 0, pages = 0;
  bool ok = true;
  do {
    if (++pages > kMaxCatalogPages) { ok = false; break; }
    FirebaseJson response;
    if (!catalogReadPage(_fbdo, *_serial, source, token, response)) { ok = false; break; }
    String nextToken;
    if (!catalogWalkPage(response, file, catalogWriteTemporary, nullptr,
                         nextToken, count)) { ok = false; break; }
    if (nextToken.length() && nextToken == token) { ok = false; break; }
    token = nextToken;
    delay(0);
  } while (ok && token.length());
  file.flush();
  file.close();
  if (!ok) {
    SD.remove(temp);
    _serial->println("TEMPORARY: catalogo incompleto descartado");
    return false;
  }
  if (!catalogPromote(temp, path, backup)) {
    _serial->println("TEMPORARY: falha ao publicar catalogo no SD");
    return false;
  }
  _serial->printf("TEMPORARY: SD OK, %d documentos, %d paginas\n", count, pages);
  return true;
}
