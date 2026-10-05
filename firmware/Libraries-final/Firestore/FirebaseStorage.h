#ifndef FIREBASE_STORAGE_H
#define FIREBASE_STORAGE_H

#include <Arduino.h>
#include <Firebase_ESP_Client.h>

class FirebaseStorage
{
public:
  void begin(
    FirebaseConfig* config,
    FirebaseData* fbdo,
    const char* bucket,
    Stream& serial
  );

  bool download(
    const char* remotePath,
    const char* localPath
  );

private:
  FirebaseConfig* _config;
  FirebaseData* _fbdo;
  const char* _bucket;
  Stream* _serial;

  static FirebaseStorage* _instance;

  static void downloadCallback(FCS_DownloadStatusInfo info);
};

#endif