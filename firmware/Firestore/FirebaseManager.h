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

  bool authenticate();

  bool readDeviceConfig(
    const char* deviceId
  );

  bool writeStatus(
    const char* deviceId,
    const char* firmwareVersion,
    int wifiRssi,
    bool test
  );

  bool downloadImage(
    const char* remotePath,
    const char* localPath
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