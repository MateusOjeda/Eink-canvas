#ifndef SD_MANAGER_H
#define SD_MANAGER_H

#include <Arduino.h>
#include <SPI.h>
#include <SD.h>

class SDManager
{
public:
  bool begin(Stream& serial);

  bool exists(const char* path);

  uint64_t size(const char* path);

  bool write(
    const char* path,
    const uint8_t* data,
    size_t size
  );

  bool append(
    const char* path,
    const uint8_t* data,
    size_t size
  );

  size_t read(
    const char* path,
    uint8_t* buffer,
    size_t size
  );

  bool getUpdateIntervalMinutes(uint32_t& minutes);

  bool remove(const char* path);

  bool test(Stream& serial);
};

#endif