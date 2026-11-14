#ifndef FIREBASE_MANAGER_H
#define FIREBASE_MANAGER_H

#include <Arduino.h>
#include <Preferences.h>
#include <Firebase_ESP_Client.h>

class FirebaseManager
{
public:
  void begin(
    const char* apiKey,
    const char* bucket,
    Stream& serial
  );

  bool createAnonymousSession(
    String& uid
  );

  bool authenticate();

  bool readDeviceConfig(
    const char* deviceId,
    String& output
  );

  bool writeState(
    const char* deviceId,
    const String& state
  );

  bool writeProcessingStatus(
    const char* deviceId,
    const String& status,
    const char* updatedAt
  );

  // Reescreve um UNICO documento por dispositivo (sem colecao de eventos).
  bool writeLastError(
    const char* deviceId,
    const String& code,
    const String& message,
    const String& occurredAtUtc,
    int httpCode
  );

  int lastHttpCode();

  bool downloadImage(
    const char* remotePath,
    const char* localPath
  );

  bool listCollections(
    const char* deviceId
  );

  bool listImages(
    const char* deviceId,
    const char* collectionId
  );

  // v4: paginas do Firestore diretamente em catálogos JSONL no microSD.
  bool syncPhotosToSD(const char* deviceId);
  bool syncTemporaryPhotosToSD(const char* deviceId);

  bool syncPhotos(
    const char* deviceId,
    String& output
  );

  bool syncTemporaryPhotos(
    const char* deviceId,
    String& output
  );

  bool readDevicePriority(
    const char* deviceId,
    String& collectionId,
    String& imageId,
    bool& hasPriority
  );

  bool clearDevicePriority(
    const char* deviceId
  );

  bool markTemporaryPhotoConsumed(
    const char* deviceId,
    const char* photoId,
    const char* consumedAt
  );

private:
  FirebaseConfig _config;
  FirebaseAuth _auth;
  FirebaseData _fbdo;

  Preferences _preferences;

  const char* _bucket;
  Stream* _serial;
};

#endif