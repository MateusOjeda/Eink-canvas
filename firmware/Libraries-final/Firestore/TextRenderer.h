#ifndef TEXT_RENDERER_H
#define TEXT_RENDERER_H

#include <Arduino.h>

class TextRenderer
{
public:
  bool render(
    uint8_t* buffer,
    int width,
    int height,
    const String& text,
    uint8_t textColor,
    uint8_t backgroundColor
  );
};

#endif