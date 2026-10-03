#include <SPI.h>
#include <SD.h>

const int SD_CS   = 48;
const int SD_MOSI = 47;
const int SD_MISO = 13;
const int SD_SCK  = 21;

void setup() {
  Serial.begin(115200);

  unsigned long start = millis();
  while (!Serial && millis() - start < 3000);

  delay(500);

  Serial.println("\n--- TESTE DE LEITURA E ESCRITA ---");

  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);

  if (!SD.begin(SD_CS, SPI, 1000000)) {
    Serial.println("ERRO: Não foi possível inicializar o cartão.");
    return;
  }

  Serial.println("Cartão inicializado!");

  // -------------------------
  // Escrever arquivo
  // -------------------------

  Serial.println("\nCriando /teste.txt...");

  File file = SD.open("/teste.txt", FILE_WRITE);

  if (!file) {
    Serial.println("ERRO: Não foi possível abrir o arquivo para escrita.");
    return;
  }

  file.println("Olá! Este arquivo foi criado pelo ESP32-S3.");
  file.println("Teste de MicroSD funcionando.");
  file.println("Quadro E-Ink!");

  file.close();

  Serial.println("Arquivo escrito com sucesso!");

  // -------------------------
  // Ler arquivo
  // -------------------------

  Serial.println("\nLendo /teste.txt...");

  file = SD.open("/teste.txt");

  if (!file) {
    Serial.println("ERRO: Não foi possível abrir o arquivo para leitura.");
    return;
  }

  Serial.println("Conteúdo:");

  while (file.available()) {
    Serial.write(file.read());
  }

  file.close();

  Serial.println("\n\nLeitura concluída!");

  // -------------------------
  // Informações do cartão
  // -------------------------

  Serial.println("\n--- INFORMAÇÕES ---");

  Serial.print("Tipo: ");

  uint8_t cardType = SD.cardType();

  if (cardType == CARD_MMC) {
    Serial.println("MMC");
  } else if (cardType == CARD_SD) {
    Serial.println("SDSC");
  } else if (cardType == CARD_SDHC) {
    Serial.println("SDHC");
  } else {
    Serial.println("Desconhecido");
  }

  Serial.print("Tamanho: ");
  Serial.print(SD.cardSize() / (1024 * 1024));
  Serial.println(" MB");

  Serial.print("Espaço usado: ");
  Serial.print(SD.usedBytes() / (1024 * 1024));
  Serial.println(" MB");

  Serial.print("Espaço total: ");
  Serial.print(SD.totalBytes() / (1024 * 1024));
  Serial.println(" MB");
}

void loop() {
}