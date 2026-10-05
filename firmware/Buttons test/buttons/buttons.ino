#include <Arduino.h>
#include "esp_sleep.h"

#define BUTTON_SYNC  46  // Botao 2
#define BUTTON_NEXT   9  // Botao 3 - acorda o ESP
#define BUTTON_INFO  41  // Botao 12
#define BUTTON_WIFI  42  // Botao 11

void waitButtonRelease(int pin)
{
  while (digitalRead(pin) == LOW)
  {
    delay(20);
  }

  delay(50);
}

void setup()
{
  Serial.begin(115200);
  delay(2000);

  pinMode(BUTTON_SYNC, INPUT_PULLUP);
  pinMode(BUTTON_NEXT, INPUT_PULLUP);
  pinMode(BUTTON_INFO, INPUT_PULLUP);
  pinMode(BUTTON_WIFI, INPUT_PULLUP);

  Serial.println();
  Serial.println("=== TESTE DE SEQUENCIA DOS BOTOES ===");

  esp_sleep_wakeup_cause_t reason =
    esp_sleep_get_wakeup_cause();

  // ============================================================
  // MOTIVO DO WAKE
  // ============================================================

  switch (reason)
  {
    case ESP_SLEEP_WAKEUP_EXT1:
      Serial.println("Acordou pelo botao 3 / GPIO9.");
      break;

    case ESP_SLEEP_WAKEUP_TIMER:
      Serial.println("Acordou pelo TIMER.");
      break;

    case ESP_SLEEP_WAKEUP_UNDEFINED:
      Serial.println("Boot normal.");
      break;

    default:
      Serial.print("Outro motivo de wake: ");
      Serial.println(reason);
      break;
  }

  // ============================================================
  // SE ACORDOU PELO BOTAO 3
  // ============================================================

  if (reason == ESP_SLEEP_WAKEUP_EXT1)
  {
    Serial.println();
    Serial.println("Solte o botao 3...");

    waitButtonRelease(BUTTON_NEXT);

    Serial.println("Botao 3 solto.");
    Serial.println("Agora aperte o segundo botao:");

    bool actionDetected = false;

    while (!actionDetected)
    {
      if (digitalRead(BUTTON_SYNC) == LOW)
      {
        Serial.println("SYNC");
        actionDetected = true;
      }
      else if (digitalRead(BUTTON_NEXT) == LOW)
      {
        Serial.println("NEXT");
        actionDetected = true;
      }
      else if (digitalRead(BUTTON_INFO) == LOW)
      {
        Serial.println("INFO");
        actionDetected = true;
      }
      else if (digitalRead(BUTTON_WIFI) == LOW)
      {
        Serial.println("WIFI");
        actionDetected = true;
      }

      delay(20);
    }
  }

  // ============================================================
  // CONFIGURA APENAS O GPIO9 COMO WAKE
  // ============================================================

  esp_sleep_enable_ext1_wakeup_io(
    (1ULL << BUTTON_NEXT),
    ESP_EXT1_WAKEUP_ANY_LOW
  );

  // ============================================================
  // TEMPO DE SEGURANCA
  // ============================================================

  Serial.println();
  Serial.println("Deep sleep sera iniciado em 30 segundos.");
  Serial.println("Solte todos os botoes antes de dormir.");

  for (int i = 30; i > 0; i--)
  {
    Serial.print(i);
    Serial.println(" s");

    delay(1000);
  }

  // ============================================================
  // DEEP SLEEP POR 5 MINUTOS
  // ============================================================

  Serial.println();
  Serial.println("Entrando em deep sleep por 5 minutos...");
  Serial.flush();

  esp_sleep_enable_timer_wakeup(
    5ULL * 60ULL * 1000000ULL
  );

  delay(500);

  esp_deep_sleep_start();
}

void loop()
{
}