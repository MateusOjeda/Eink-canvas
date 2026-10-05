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

  bool syncPhotos(
    const char* deviceId,
    String& output
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