#include <SPI.h>
#include <SD.h>

#include "Display_EPD_W21.h"
#include "Display_EPD_W21_spi.h"

// =========================
// microSD
// =========================

#define SD_CS   48
#define SD_MOSI 47
#define SD_MISO 13
#define SD_SCK  21

// =========================
// EPD Spectra 6
// =========================

#define EPD_CS   2
#define EPD_DC   3
#define EPD_RST  4
#define EPD_BUSY 5

#define EPD_SCK  12
#define EPD_MOSI 11

// 800 × 480 pixels
// 2 pixels por byte
#define IMAGE_SIZE 192000

// Arquivo que será exibido
#define IMAGE_FILE "/teste.bin"


void displayImageFromSD(const char *filename)
{
  Serial.println("Abrindo arquivo...");

  File file = SD.open(filename, FILE_READ);

  if (!file) {
    Serial.println("ERRO: nao foi possivel abrir o arquivo.");
    return;
  }

  Serial.print("Arquivo aberto. Tamanho: ");
  Serial.print(file.size());
  Serial.println(" bytes");

  if (file.size() != IMAGE_SIZE) {
    Serial.println("ERRO: tamanho do arquivo diferente de 192000 bytes.");
    file.close();
    return;
  }

  // Reserva memoria para a imagem inteira
  uint8_t *imageData = (uint8_t *)malloc(IMAGE_SIZE);

  if (imageData == nullptr) {
    Serial.println("ERRO: nao foi possivel reservar memoria.");
    file.close();
    return;
  }

  Serial.println("Memoria reservada.");

  // Le a imagem inteira para a RAM
  size_t bytesRead = file.read(imageData, IMAGE_SIZE);

  file.close();

  Serial.println("Arquivo fechado.");

  Serial.print("Bytes lidos: ");
  Serial.println(bytesRead);

  if (bytesRead != IMAGE_SIZE) {
    Serial.println("ERRO: leitura incompleta.");
    free(imageData);
    return;
  }

  Serial.println("Arquivo lido completamente.");

  // =========================
  // Troca SPI do SD pelo EPD
  // =========================

  SPI.end();

  Serial.println("SPI do SD encerrado.");

  SPI.begin(
    EPD_SCK,
    -1,
    EPD_MOSI,
    EPD_CS
  );

  SPI.beginTransaction(
    SPISettings(10000000, MSBFIRST, SPI_MODE0)
  );

  Serial.println("SPI do EPD configurado.");

  // =========================
  // Inicializa EPD
  // =========================

  Serial.println("Inicializando EPD...");

  EPD_init_fast();

  Serial.println("EPD inicializado.");

  // =========================
  // Envia imagem
  // =========================

  Serial.println("Enviando imagem...");

  EPD_W21_WriteCMD(0x10);

  for (int i = 0; i < IMAGE_SIZE; i++) {
    EPD_W21_WriteDATA(imageData[i]);
  }

  // Atualiza tela
  EPD_W21_WriteCMD(0x12);
  EPD_W21_WriteDATA(0x00);

  delay(1);

  Serial.println("Aguardando refresh...");

  lcd_chkstatus();

  Serial.println("Imagem exibida.");

  // =========================
  // Coloca EPD em sleep
  // =========================

  EPD_sleep();

  Serial.println("EPD em sleep.");

  // Libera RAM
  free(imageData);

  Serial.println("Memoria liberada.");
}


void setup()
{
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=== QUADRO E-INK ===");
  Serial.println("Display de imagem via microSD");
  Serial.println();

  // =========================
  // Pinos do EPD
  // =========================

  pinMode(EPD_BUSY, INPUT);
  pinMode(EPD_RST, OUTPUT);
  pinMode(EPD_DC, OUTPUT);
  pinMode(EPD_CS, OUTPUT);

  digitalWrite(EPD_CS, HIGH);

  // =========================
  // SPI do microSD
  // =========================

  Serial.println("Inicializando SD...");

  SPI.begin(
    SD_SCK,
    SD_MISO,
    SD_MOSI,
    SD_CS
  );

  if (!SD.begin(SD_CS, SPI, 1000000)) {
    Serial.println("ERRO: SD nao inicializou.");
    return;
  }

  Serial.println("SD inicializado.");

  // =========================
  // Exibe imagem
  // =========================

  displayImageFromSD(IMAGE_FILE);

  Serial.println();
  Serial.println("=== FIM ===");
}


void loop()
{
}