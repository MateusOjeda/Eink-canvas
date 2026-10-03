#ifndef _DISPLAY_EPD_W21_SPI_
#define _DISPLAY_EPD_W21_SPI_

#include "Arduino.h"

#define isEPD_W21_BUSY digitalRead(5)

#define EPD_W21_RST_0 digitalWrite(4, LOW)
#define EPD_W21_RST_1 digitalWrite(4, HIGH)

#define EPD_W21_DC_0 digitalWrite(3, LOW)
#define EPD_W21_DC_1 digitalWrite(3, HIGH)

#define EPD_W21_CS_0 digitalWrite(2, LOW)
#define EPD_W21_CS_1 digitalWrite(2, HIGH)

void SPI_Write(unsigned char value);
void EPD_W21_WriteDATA(unsigned char datas);
void EPD_W21_WriteCMD(unsigned char command);

#endif