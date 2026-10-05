#include "FirebaseManager.h"

void FirebaseManager::begin(
  const char* apiKey,
  const char* bucket,
  Stream& serial
)
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
      "ERRO: nenhum refresh token encontrado."
    );

    return false;
  }

  _serial->println("Refresh token encontrado.");
  _serial->println("Restaurando sessao...");

  Firebase.reconnectNetwork(true);

  Firebase.setIdToken(
    &_config,
    "",
    3600,
    refreshToken.c_str()
  );

  _serial->println("setIdToken() retornou.");

  _serial->println("Chamando Firebase.begin()...");

  Firebase.begin(
    &_config,
    &_auth
  );

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

bool FirebaseManager::listCollections(
  const char* deviceId
)
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
        false
      ))
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
  const char* deviceId,
  String& output
)
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
        false
      ))
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
        "documents"
      ))
  {
    _serial->println("PHOTOS: COLLECTIONS SEM DOCUMENTOS.");

    return false;
  }

  FirebaseJsonArray collectionsArray;

  if (!data.getArray(collectionsArray))
  {
    _serial->println(
      "PHOTOS: ERRO AO CONVERTER COLLECTIONS."
    );

    return false;
  }

  FirebaseJson photosJson;
  FirebaseJsonArray photosCollections;

  for (
    size_t i = 0;
    i < collectionsArray.size();
    i++
  )
  {
    FirebaseJsonData collectionData;

    if (!collectionsArray.get(
          collectionData,
          i
        ))
    {
      continue;
    }

    FirebaseJson collectionDocument;

    if (!collectionData.getJSON(
          collectionDocument
        ))
    {
      continue;
    }

    FirebaseJsonData nameData;
    FirebaseJsonData fieldsData;

    collectionDocument.get(
      nameData,
      "name"
    );

    collectionDocument.get(
      fieldsData,
      "fields"
    );

    String documentName =
      nameData.to<String>();

    int slash =
      documentName.lastIndexOf('/');

    if (slash < 0)
      continue;

    String collectionId =
      documentName.substring(
        slash + 1
      );

    FirebaseJson fieldsJson;

    if (!fieldsData.getJSON(
          fieldsJson
        ))
    {
      continue;
    }

    FirebaseJsonData collectionName;
    FirebaseJsonData collectionActive;
    FirebaseJsonData collectionCreatedAt;

    fieldsJson.get(
      collectionName,
      "name/stringValue"
    );

    fieldsJson.get(
      collectionActive,
      "active/booleanValue"
    );

    fieldsJson.get(
      collectionCreatedAt,
      "createdAt/timestampValue"
    );

    FirebaseJson collectionJson;

    collectionJson.set(
      "id",
      collectionId
    );

    collectionJson.set(
      "active",
      collectionActive.to<bool>()
    );

    collectionJson.set(
      "createdAt",
      collectionCreatedAt.to<String>()
    );

    collectionJson.set(
      "name",
      collectionName.to<String>()
    );

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
          false
        ))
    {
      _serial->println(
        "PHOTOS: ERRO AO LER IMAGES:"
      );

      _serial->println(
        _fbdo.errorReason()
      );

      return false;
    }

    FirebaseJson imagesResponse;

    imagesResponse.setJsonData(
      _fbdo.payload()
    );

    FirebaseJsonArray imagesArray;

    FirebaseJsonData documentsData;

    if (
      imagesResponse.get(
        documentsData,
        "documents"
      )
    )
    {
      documentsData.getArray(
        imagesArray
      );
    }

    FirebaseJsonArray outputImages;

    for (
      size_t j = 0;
      j < imagesArray.size();
      j++
    )
    {
      FirebaseJsonData imageData;

      if (!imagesArray.get(
            imageData,
            j
          ))
      {
        continue;
      }

      FirebaseJson imageDocument;

      if (!imageData.getJSON(
            imageDocument
          ))
      {
        continue;
      }

      FirebaseJsonData imageNameData;
      FirebaseJsonData imageFieldsData;

      imageDocument.get(
        imageNameData,
        "name"
      );

      imageDocument.get(
        imageFieldsData,
        "fields"
      );

      String imageDocumentName =
        imageNameData.to<String>();

      int imageSlash =
        imageDocumentName.lastIndexOf('/');

      if (imageSlash < 0)
        continue;

      String imageId =
        imageDocumentName.substring(
          imageSlash + 1
        );

      FirebaseJson imageFields;

      if (!imageFieldsData.getJSON(
            imageFields
          ))
      {
        continue;
      }

      FirebaseJsonData active;
      FirebaseJsonData previewPath;
      FirebaseJsonData thumbnailPath;
      FirebaseJsonData epaperFilePath;
      FirebaseJsonData width;
      FirebaseJsonData height;
      FirebaseJsonData createdAt;
      FirebaseJsonData description;

      imageFields.get(
        active,
        "active/booleanValue"
      );

      imageFields.get(
        previewPath,
        "previewPath/stringValue"
      );

      imageFields.get(
        thumbnailPath,
        "thumbnailPath/stringValue"
      );

      imageFields.get(
        epaperFilePath,
        "epaperFilePath/stringValue"
      );

      imageFields.get(
        width,
        "width/integerValue"
      );

      imageFields.get(
        height,
        "height/integerValue"
      );

      imageFields.get(
        createdAt,
        "createdAt/timestampValue"
      );

      FirebaseJson imageJson;

      imageJson.set(
        "id",
        imageId
      );

      imageJson.set(
        "active",
        active.to<bool>()
      );

      imageJson.set(
        "previewPath",
        previewPath.to<String>()
      );

      imageJson.set(
        "thumbnailPath",
        thumbnailPath.to<String>()
      );

      imageJson.set(
        "epaperFilePath",
        epaperFilePath.to<String>()
      );

      imageJson.set(
        "width",
        width.to<int>()
      );

      imageJson.set(
        "height",
        height.to<int>()
      );

      imageJson.set(
        "createdAt",
        createdAt.to<String>()
      );

      if (
        imageFields.get(
          description,
          "description/stringValue"
        )
      )
      {
        imageJson.set(
          "description",
          description.to<String>()
        );
      }

      outputImages.add(
        imageJson
      );
    }

    collectionJson.set(
      "images",
      outputImages
    );

    photosCollections.add(
      collectionJson
    );
  }

  photosJson.set(
    "collections",
    photosCollections
  );

  photosJson.toString(output, false);

  _serial->println();
  _serial->println("=== PHOTOS JSON ===");
  _serial->println(output);
  _serial->println("PHOTOS: JSON MONTADO!");

  return true;
}

bool FirebaseManager::listImages(
  const char* deviceId,
  const char* collectionId
)
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
        false
      ))
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
  const char* deviceId,
  String& output
)
{
  String devicePath =
    "devices/" + String(deviceId);

  if (!Firebase.Firestore.getDocument(
        &_fbdo,
        "einkcanvas",
        "",
        devicePath.c_str(),
        ""
      ))
  {
    _serial->println("DEVICE: ERRO NA LEITURA:");
    _serial->println(_fbdo.errorReason());

    return false;
  }

  _serial->println("DEVICE: LEITURA OK!");

  FirebaseJson deviceJson;
  deviceJson.setJsonData(_fbdo.payload());

  FirebaseJsonData fieldsData;

  if (!deviceJson.get(
        fieldsData,
        "fields"
      ))
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
  FirebaseJsonData intervalData;

  fields.get(
    deviceAuthUidData,
    "deviceAuthUid/stringValue"
  );

  fields.get(
    nameData,
    "name/stringValue"
  );

  fields.get(
    ownerUidData,
    "ownerUid/stringValue"
  );

  fields.get(
    intervalData,
    "updateIntervalMinutes/integerValue"
  );

  String displayPath =
    devicePath + "/config/display";

  if (!Firebase.Firestore.getDocument(
        &_fbdo,
        "einkcanvas",
        "",
        displayPath.c_str(),
        ""
      ))
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
        "fields"
      ))
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
    "orientation/stringValue"
  );

  FirebaseJson configJson;

  configJson.set(
    "deviceAuthUid",
    deviceAuthUidData.to<String>()
  );

  configJson.set(
    "name",
    nameData.to<String>()
  );

  configJson.set(
    "ownerUid",
    ownerUidData.to<String>()
  );

  configJson.set(
    "updateIntervalMinutes",
    intervalData.to<int>()
  );

  configJson.set(
    "orientation",
    orientationData.to<String>()
  );

  configJson.toString(
    output,
    false
  );

  _serial->println();
  _serial->println("=== CONFIG JSON ===");
  _serial->println(output);
  _serial->println("CONFIG: JSON MONTADO!");

  return true;
}

bool FirebaseManager::createAnonymousSession(
  String& uid
)
{
  _serial->println();
  _serial->println(
    "Criando nova sessao Anonymous..."
  );

  Firebase.reconnectNetwork(true);

  if (!Firebase.signUp(
        &_config,
        &_auth,
        "",
        ""
      ))
  {
    _serial->println();
    _serial->println(
      "ERRO AO CRIAR SESSAO:"
    );

    _serial->println(
      _config.signer.signupError.message.c_str()
    );

    return false;
  }

  uid = _auth.token.uid.c_str();

  _serial->println();
  _serial->println(
    "=== SESSAO CRIADA ==="
  );

  _serial->print(
    "UID: "
  );

  _serial->println(
    uid
  );

  Firebase.begin(
    &_config,
    &_auth
  );

  _serial->println(
    "Firebase iniciado."
  );

  unsigned long start =
    millis();

  while (!Firebase.ready())
  {
    delay(100);

    if (millis() - start > 15000)
    {
      _serial->println(
        "Timeout aguardando Firebase."
      );

      return false;
    }
  }

  _serial->println(
    "Firebase autenticado."
  );

  const char* refreshToken =
    Firebase.getRefreshToken();

  if (
    refreshToken == nullptr ||
    strlen(refreshToken) == 0
  )
  {
    _serial->println(
      "ERRO: refresh token vazio."
    );

    return false;
  }

  _preferences.begin(
    "firebase",
    false
  );

  size_t saved =
    _preferences.putString(
      "refreshToken",
      refreshToken
    );

  _preferences.end();

  if (saved == 0)
  {
    _serial->println(
      "ERRO: nao foi possivel salvar o refresh token."
    );

    return false;
  }

  _serial->println(
    "Refresh token salvo no NVS."
  );

  return true;
}

bool FirebaseManager::writeState(
  const char* deviceId,
  const String& state
)
{
  String path =
    "devices/" + String(deviceId) +
    "/state/current";

  FirebaseJson document;

  document.set(
    "fields/state/stringValue",
    state
  );

  if (Firebase.Firestore.patchDocument(
        &_fbdo,
        "einkcanvas",
        "",
        path.c_str(),
        document.raw(),
        "state"
      ))
  {
    _serial->println("STATE: ATUALIZADO!");
    return true;
  }

  _serial->println("STATE: ERRO AO ATUALIZAR:");
  _serial->println(_fbdo.errorReason());

  return false;
}

static void firebaseDownloadCallback(
  FCS_DownloadStatusInfo info
)
{
  if (info.status == firebase_fcs_download_status_init)
  {
    Serial.printf(
      "Baixando: %s (%d bytes)\n",
      info.remoteFileName.c_str(),
      info.fileSize
    );
  }
  else if (info.status == firebase_fcs_download_status_download)
  {
    Serial.printf(
      "Progresso: %d%%\n",
      (int)info.progress
    );
  }
  else if (info.status == firebase_fcs_download_status_complete)
  {
    Serial.println("Download concluído!");
  }
  else if (info.status == firebase_fcs_download_status_error)
  {
    Serial.printf(
      "Erro no download: %s\n",
      info.errorMsg.c_str()
    );
  }
}

bool FirebaseManager::readDevicePriority(
  const char* deviceId,
  String& collectionId,
  String& imageId,
  bool& hasPriority
)
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
        ""
      ))
  {
    String error = _fbdo.errorReason();

    _serial->println(
      "PRIORITY: erro na leitura:"
    );

    _serial->println(error);

    // O documento pode simplesmente ainda não existir.
    // Nesse caso, não há prioridade.
    if (
      error.indexOf("NOT_FOUND") >= 0 ||
      error.indexOf("not found") >= 0
    )
    {
      _serial->println(
        "PRIORITY: documento nao existe. Nenhuma prioridade."
      );

      return true;
    }

    return false;
  }

  _serial->println(
    "PRIORITY: documento lido."
  );

  FirebaseJson priorityJson;

  if (!priorityJson.setJsonData(
        _fbdo.payload()
      ))
  {
    _serial->println(
      "PRIORITY: JSON invalido."
    );

    return false;
  }

  FirebaseJsonData fieldsData;

  if (!priorityJson.get(
        fieldsData,
        "fields"
      ))
  {
    _serial->println(
      "PRIORITY: fields nao encontrado."
    );

    return false;
  }

  FirebaseJson fields;

  if (!fieldsData.getJSON(fields))
  {
    _serial->println(
      "PRIORITY: erro ao ler fields."
    );

    return false;
  }

  FirebaseJsonData collectionIdData;
  FirebaseJsonData imageIdData;

  fields.get(
    collectionIdData,
    "collectionId/stringValue"
  );

  fields.get(
    imageIdData,
    "imageId/stringValue"
  );

  collectionId =
    collectionIdData.to<String>();

  imageId =
    imageIdData.to<String>();

  if (
    collectionId.length() == 0 ||
    imageId.length() == 0
  )
  {
    _serial->println(
      "PRIORITY: prioridade vazia."
    );

    return true;
  }

  hasPriority = true;

  _serial->println(
    "=== PRIORIDADE ==="
  );

  _serial->print(
    "Collection ID: "
  );

  _serial->println(
    collectionId
  );

  _serial->print(
    "Image ID: "
  );

  _serial->println(
    imageId
  );

  return true;
}

bool FirebaseManager::clearDevicePriority(
  const char* deviceId
)
{
  String priorityPath =
    "devices/" + String(deviceId) +
    "/config/priority";

  _serial->println(
    "PRIORITY: removendo documento..."
  );

  if (Firebase.Firestore.deleteDocument(
        &_fbdo,
        "einkcanvas",
        "",
        priorityPath.c_str(),
        ""
      ))
  {
    _serial->println(
      "PRIORITY: documento removido."
    );

    return true;
  }

  _serial->println(
    "PRIORITY: erro ao remover:"
  );

  _serial->println(
    _fbdo.errorReason()
  );

  return false;
}

bool FirebaseManager::downloadImage(
  const char* remotePath,
  const char* localPath
)
{
  if (Firebase.Storage.download(
        &_fbdo,
        _bucket,
        remotePath,
        localPath,
        mem_storage_type_sd,
        firebaseDownloadCallback
      ))
  {
    _serial->println("IMAGE: DOWNLOAD OK!");
    return true;
  }

  _serial->println("IMAGE: ERRO NO DOWNLOAD:");
  _serial->println(_fbdo.errorReason());

  return false;
}