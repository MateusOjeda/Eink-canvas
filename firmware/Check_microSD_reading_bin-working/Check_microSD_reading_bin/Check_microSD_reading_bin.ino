#include <Arduino.h>
#include "SDManager.h"

SDManager sd;

void setup()
{
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=== TESTE MICRO SD ===");

  if (!sd.begin(Serial))
    return;

  sd.test(Serial);

  Serial.println("=== FIM ===");
}

void loop()
{
}