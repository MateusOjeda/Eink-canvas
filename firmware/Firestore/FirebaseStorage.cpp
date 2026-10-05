#include "FirebaseStorage.h"

FirebaseStorage* FirebaseStorage::_instance = nullptr;

void FirebaseStorage::begin(
  FirebaseConfig* config,
  FirebaseData* fbdo,
  const char* bucket,
  Stream& serial
)
{
  _config = config;
  _fbdo = fbdo;
  _bucket = bucket;
  _serial = &serial;

  _instance = this;

  _config->fcs.download_buffer_size = 2048;
}

void FirebaseStorage::downloadCallback(
  FCS_DownloadStatusInfo info
)
{
  if (_instance == nullptr)
    return;

  Stream& serial = *_instance->_serial;

  if (info.status == firebase_fcs_download_status_init)
  {
    serial.printf(
      "Baixando: %s (%d bytes)\n",
      info.remoteFileName.c_str(),
      info.fileSize
    );
  }
  else if (info.status == firebase_fcs_download_status_download)
  {
    serial.printf(
      "Progresso: %d%%\n",
      (int)info.progress
    );
  }
  else if (info.status == firebase_fcs_download_status_complete)
  {
    serial.println("Download concluído!");
  }
  else if (info.status == firebase_fcs_download_status_error)
  {
    serial.printf(
      "Erro no download: %s\n",
      info.errorMsg.c_str()
    );
  }
}

bool FirebaseStorage::download(
  const char* remotePath,
  const char* localPath
)
{
  if (Firebase.Storage.download(
        _fbdo,
        _bucket,
        remotePath,
        localPath,
        mem_storage_type_sd,
        downloadCallback
      ))
  {
    _serial->println("STORAGE: DOWNLOAD OK!");
    return true;
  }

  _serial->println("STORAGE: ERRO NO DOWNLOAD:");
  _serial->println(_fbdo->errorReason());

  return false;
}