#include "SDManager.h"

#define SD_CS   48
#define SD_MOSI 47
#define SD_MISO 13
#define SD_SCK  21

bool SDManager::begin(Stream& serial)
{
  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);

  if (!SD.begin(SD_CS, SPI, 1000000))
  {
    serial.println("ERRO: falha ao inicializar o SD.");
    return false;
  }

  serial.println("SD inicializado.");

  uint8_t cardType = SD.cardType();

  serial.print("Tipo: ");

  if (cardType == CARD_MMC)
    serial.println("MMC");
  else if (cardType == CARD_SD)
    serial.println("SDSC");
  else if (cardType == CARD_SDHC)
    serial.println("SDHC");
  else
    serial.println("DESCONHECIDO");

  serial.print("Tamanho: ");
  serial.print(SD.cardSize() / (1024 * 1024));
  serial.println(" MB");

  return true;
}

bool SDManager::exists(const char* path)
{
  return SD.exists(path);
}

uint64_t SDManager::size(const char* path)
{
  File file = SD.open(path, FILE_READ);

  if (!file)
    return 0;

  uint64_t fileSize = file.size();

  file.close();

  return fileSize;
}

bool SDManager::write(
  const char* path,
  const uint8_t* data,
  size_t size
)
{
  File file = SD.open(path, FILE_WRITE);

  if (!file)
    return false;

  size_t written = file.write(data, size);

  file.close();

  return written == size;
}

bool SDManager::append(
  const char* path,
  const uint8_t* data,
  size_t size
)
{
  File file = SD.open(path, FILE_APPEND);

  if (!file)
    return false;

  size_t written = file.write(data, size);

  file.close();

  return written == size;
}

size_t SDManager::read(
  const char* path,
  uint8_t* buffer,
  size_t size
)
{
  File file = SD.open(path, FILE_READ);

  if (!file)
    return 0;

  size_t bytesRead = file.read(buffer, size);

  file.close();

  return bytesRead;
}

bool SDManager::remove(const char* path)
{
  return SD.remove(path);
}

bool SDManager::test(Stream& serial)
{
  File file = SD.open("/teste.bin", FILE_READ);

  if (!file)
  {
    serial.println("ERRO: nao consegui abrir /teste.bin");
    return false;
  }

  serial.println("Arquivo aberto.");

  serial.print("Tamanho do arquivo: ");
  serial.print(file.size());
  serial.println(" bytes");

  serial.println("Primeiros 32 bytes:");

  for (int i = 0; i < 32 && file.available(); i++)
  {
    uint8_t value = file.read();

    if (value < 0x10)
      serial.print("0");

    serial.print(value, HEX);
    serial.print(" ");
  }

  serial.println();

  file.close();

  serial.println("Arquivo fechado.");

  return true;
}