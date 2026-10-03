#include <Arduino.h>
#include <SPI.h>
#include <SD.h>

#define SD_CS   48
#define SD_MOSI 47
#define SD_MISO 13
#define SD_SCK  21

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=== TESTE MICRO SD ===");

  // SPI do microSD
  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);

  if (!SD.begin(SD_CS, SPI, 1000000)) {
    Serial.println("ERRO: falha ao inicializar o SD.");
    return;
  }

  Serial.println("SD inicializado.");

  uint8_t cardType = SD.cardType();

  Serial.print("Tipo: ");

  if (cardType == CARD_MMC) {
    Serial.println("MMC");
  } else if (cardType == CARD_SD) {
    Serial.println("SDSC");
  } else if (cardType == CARD_SDHC) {
    Serial.println("SDHC");
  } else {
    Serial.println("DESCONHECIDO");
  }

  Serial.print("Tamanho: ");
  Serial.print(SD.cardSize() / (1024 * 1024));
  Serial.println(" MB");

  // Abre o arquivo
  File file = SD.open("/teste.bin", FILE_READ);

  if (!file) {
    Serial.println("ERRO: nao consegui abrir /teste.bin");
    return;
  }

  Serial.println("Arquivo aberto.");

  Serial.print("Tamanho do arquivo: ");
  Serial.print(file.size());
  Serial.println(" bytes");

  // Lê os primeiros 32 bytes
  Serial.println("Primeiros 32 bytes:");

  for (int i = 0; i < 32 && file.available(); i++) {
    uint8_t value = file.read();

    if (value < 0x10) {
      Serial.print("0");
    }

    Serial.print(value, HEX);
    Serial.print(" ");
  }

  Serial.println();

  file.close();

  Serial.println("Arquivo fechado.");
  Serial.println("=== FIM ===");
}

void loop() {
}