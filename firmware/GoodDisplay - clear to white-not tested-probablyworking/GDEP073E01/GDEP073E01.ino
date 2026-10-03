// Not tested

#include <SPI.h>

#include "Display_EPD_W21.h"
#include "Display_EPD_W21_spi.h"

#define EPD_BUSY 5
#define EPD_RST  4
#define EPD_DC   3
#define EPD_CS   2

#define EPD_SCK  12
#define EPD_MOSI 11

#define IMAGE_SIZE 192000

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("=== EPD WHITE ===");

  pinMode(EPD_BUSY, INPUT);
  pinMode(EPD_RST, OUTPUT);
  pinMode(EPD_DC, OUTPUT);
  pinMode(EPD_CS, OUTPUT);

  digitalWrite(EPD_CS, HIGH);

  SPI.begin(EPD_SCK, -1, EPD_MOSI, EPD_CS);

  SPI.beginTransaction(
    SPISettings(10000000, MSBFIRST, SPI_MODE0)
  );

  Serial.println("Inicializando EPD...");

  EPD_init_fast();

  Serial.println("Enviando tela branca...");

  EPD_W21_WriteCMD(0x10);

  for (int i = 0; i < IMAGE_SIZE; i++) {
    EPD_W21_WriteDATA(0x11);
  }

  EPD_W21_WriteCMD(0x12);
  EPD_W21_WriteDATA(0x00);

  delay(1);

  Serial.println("Aguardando refresh...");
  lcd_chkstatus();

  Serial.println("Tela branca.");

  EPD_sleep();

  Serial.println("EPD em sleep.");
  Serial.println("=== FIM ===");
}

void loop() {
}