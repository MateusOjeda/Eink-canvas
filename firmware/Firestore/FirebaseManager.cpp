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

  Firebase.reconnectNetwork(true);

  if (refreshToken.length() == 0)
  {
    _serial->println(
      "ERRO: nenhum refresh token encontrado."
    );

    return false;
  }

  _serial->println("Refresh token encontrado.");
  _serial->println("Restaurando sessão...");

  Firebase.setIdToken(
    &_config,
    "",
    3600,
    refreshToken.c_str()
  );

  Firebase.begin(&_config, &_auth);

  _serial->println("Firebase iniciado.");

  unsigned long start = millis();

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

  _serial->println("Firebase autenticado.");

  _serial->print("UID: ");
  _serial->println(_auth.token.uid.c_str());

  return true;
}

bool FirebaseManager::readDeviceConfig(
  const char* deviceId
)
{
  String path =
    "devices/" + String(deviceId);

  if (Firebase.Firestore.getDocument(
        &_fbdo,
        "einkcanvas",
        "",
        path.c_str(),
        ""
      ))
  {
    _serial->println("DEVICE: LEITURA OK!");
    _serial->println(_fbdo.payload());

    return true;
  }

  _serial->println("DEVICE: ERRO NA LEITURA:");
  _serial->println(_fbdo.errorReason());

  return false;
}

bool FirebaseManager::writeStatus(
  const char* deviceId,
  const char* firmwareVersion,
  int wifiRssi,
  bool test
)
{
  String path =
    "devices/" + String(deviceId) +
    "/status/current";

  FirebaseJson status;

  status.set(
    "fields/firmwareVersion/stringValue",
    firmwareVersion
  );

  status.set(
    "fields/wifiRssi/integerValue",
    String(wifiRssi)
  );

  status.set(
    "fields/test/booleanValue",
    test
  );

  if (Firebase.Firestore.createDocument(
        &_fbdo,
        "einkcanvas",
        "",
        path.c_str(),
        status.raw()
      ))
  {
    _serial->println("STATUS: CRIADO!");
    return true;
  }

  _serial->println("STATUS: ERRO AO CRIAR:");
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