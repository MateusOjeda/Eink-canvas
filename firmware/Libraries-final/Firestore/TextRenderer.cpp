#include "TextRenderer.h"

static const uint16_t FONT_16X24[][24] =
{
  // espaço
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // A
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x01C0, 0x01C0, 0x0140,
    0x0360, 0x0360, 0x0220, 0x0630,
    0x0630, 0x07F0, 0x0FF8, 0x0C18,
    0x0808, 0x180C, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // B
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1FF0, 0x1FF0, 0x180C,
    0x180C, 0x180C, 0x1FF0, 0x1FF0,
    0x180C, 0x180C, 0x180C, 0x180C,
    0x1FF0, 0x1FF0, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // C
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x03F8, 0x07FC, 0x0E0C,
    0x0C00, 0x0C00, 0x0C00, 0x0C00,
    0x0C00, 0x0C00, 0x0C00, 0x0E0C,
    0x07FC, 0x03F8, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // D
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1FF0, 0x1FF8, 0x180C,
    0x1806, 0x1806, 0x1806, 0x1806,
    0x1806, 0x1806, 0x1806, 0x180C,
    0x1FF8, 0x1FF0, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // E
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1FFC, 0x1FFC, 0x1800,
    0x1800, 0x1800, 0x1FF0, 0x1FF0,
    0x1800, 0x1800, 0x1800, 0x1800,
    0x1FFC, 0x1FFC, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // F
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1FFC, 0x1FFC, 0x1800,
    0x1800, 0x1800, 0x1FF0, 0x1FF0,
    0x1800, 0x1800, 0x1800, 0x1800,
    0x1800, 0x1800, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // G
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x03F8, 0x07FC, 0x0E0C,
    0x0C00, 0x0C00, 0x0C00, 0x0CF8,
    0x0CFC, 0x0C0C, 0x0E0C, 0x060C,
    0x07FC, 0x03F8, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // H
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1806, 0x1806, 0x1806,
    0x1806, 0x1806, 0x1FFE, 0x1FFE,
    0x1806, 0x1806, 0x1806, 0x1806,
    0x1806, 0x1806, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // I
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x07F0, 0x07F0, 0x0180,
    0x0180, 0x0180, 0x0180, 0x0180,
    0x0180, 0x0180, 0x0180, 0x0180,
    0x07F0, 0x07F0, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // J
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0018, 0x0018, 0x0018,
    0x0018, 0x0018, 0x0018, 0x0018,
    0x0018, 0x1818, 0x1818, 0x1818,
    0x0FF0, 0x07E0, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // K
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1806, 0x180C, 0x1818,
    0x1830, 0x1F00, 0x1F00, 0x1830,
    0x1818, 0x180C, 0x1806, 0x1806,
    0x1806, 0x1806, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // L
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1800, 0x1800, 0x1800,
    0x1800, 0x1800, 0x1800, 0x1800,
    0x1800, 0x1800, 0x1800, 0x1800,
    0x1FFC, 0x1FFC, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // M
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1C1C, 0x1C1C, 0x1E3C,
    0x1E3C, 0x1B6C, 0x1B6C, 0x198C,
    0x198C, 0x180C, 0x180C, 0x180C,
    0x180C, 0x180C, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // N
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1806, 0x1C06, 0x1E06,
    0x1B06, 0x1B86, 0x19C6, 0x18E6,
    0x1866, 0x1836, 0x181E, 0x180E,
    0x1806, 0x1806, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // O
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x03F8, 0x07FC, 0x0E0E,
    0x0C06, 0x0C06, 0x0C06, 0x0C06,
    0x0C06, 0x0C06, 0x0E0E, 0x07FC,
    0x03F8, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // P
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1FF0, 0x1FF8, 0x180C,
    0x180C, 0x180C, 0x1FF8, 0x1FF0,
    0x1800, 0x1800, 0x1800, 0x1800,
    0x1800, 0x1800, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // Q
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x03F8, 0x07FC, 0x0E0E,
    0x0C06, 0x0C06, 0x0C06, 0x0C06,
    0x0C66, 0x0E66, 0x07FC, 0x03F8,
    0x0018, 0x000C, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // R
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1FF0, 0x1FF8, 0x180C,
    0x180C, 0x180C, 0x1FF8, 0x1FF0,
    0x1830, 0x1818, 0x180C, 0x1806,
    0x1806, 0x1806, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // S
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x07F8, 0x0FFC, 0x0C0C,
    0x0C00, 0x0C00, 0x07F0, 0x03F8,
    0x000C, 0x000C, 0x0C0C, 0x0FFC,
    0x07F8, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // T
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1FFE, 0x1FFE, 0x0180,
    0x0180, 0x0180, 0x0180, 0x0180,
    0x0180, 0x0180, 0x0180, 0x0180,
    0x0180, 0x0180, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // U
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1806, 0x1806, 0x1806,
    0x1806, 0x1806, 0x1806, 0x1806,
    0x1806, 0x1806, 0x1806, 0x0C0C,
    0x07F8, 0x03F0, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // V
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1806, 0x1806, 0x0C0C,
    0x0C0C, 0x060C, 0x060C, 0x0318,
    0x0318, 0x0198, 0x0198, 0x00F0,
    0x00F0, 0x0060, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // W
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1806, 0x1806, 0x1806,
    0x1986, 0x1986, 0x1986, 0x1B66,
    0x1B66, 0x1B66, 0x1E3C, 0x1E3C,
    0x1C1C, 0x1C1C, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // X
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1806, 0x0C0C, 0x060C,
    0x0318, 0x0198, 0x00F0, 0x00F0,
    0x0198, 0x0318, 0x060C, 0x0C0C,
    0x1806, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // Y
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1806, 0x0C0C, 0x060C,
    0x0318, 0x0198, 0x00F0, 0x00F0,
    0x00F0, 0x00F0, 0x00F0, 0x00F0,
    0x00F0, 0x00F0, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // Z
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1FFE, 0x1FFE, 0x000C,
    0x0018, 0x0030, 0x0060, 0x00C0,
    0x0180, 0x0300, 0x0600, 0x0C00,
    0x1FFE, 0x1FFE, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // 0
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x07F0, 0x0FF8, 0x0C18,
    0x0C18, 0x0C18, 0x0C18, 0x0C18,
    0x0C18, 0x0C18, 0x0C18, 0x0C18,
    0x0FF8, 0x07F0, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // 1
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x01C0, 0x03C0, 0x07C0,
    0x01C0, 0x01C0, 0x01C0, 0x01C0,
    0x01C0, 0x01C0, 0x01C0, 0x01C0,
    0x07F0, 0x07F0, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // 2
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x07F0, 0x0FF8, 0x0C18,
    0x0018, 0x0030, 0x00E0, 0x0380,
    0x0E00, 0x1800, 0x1800, 0x1800,
    0x1FF8, 0x1FF8, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // 3
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x07F0, 0x0FF8, 0x0C18,
    0x0018, 0x0030, 0x01F0, 0x01F0,
    0x0018, 0x0018, 0x0C18, 0x0FF8,
    0x07F0, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // 4
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x00C0, 0x01C0, 0x03C0,
    0x06C0, 0x0CC0, 0x18C0, 0x18C0,
    0x1FFC, 0x1FFC, 0x00C0, 0x00C0,
    0x00C0, 0x00C0, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // 5
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1FF8, 0x1FF8, 0x1800,
    0x1800, 0x1800, 0x1FF0, 0x1FF8,
    0x0018, 0x0018, 0x0C18, 0x0FF8,
    0x07F0, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // 6
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x03F0, 0x07F8, 0x0E00,
    0x0C00, 0x0C00, 0x0FF0, 0x0FF8,
    0x0C18, 0x0C18, 0x0C18, 0x0FF8,
    0x07F0, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // 7
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x1FF8, 0x1FF8, 0x0018,
    0x0030, 0x0060, 0x00C0, 0x0180,
    0x0300, 0x0600, 0x0C00, 0x0C00,
    0x0C00, 0x0C00, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // 8
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x07F0, 0x0FF8, 0x0C18,
    0x0C18, 0x0FF8, 0x07F0, 0x0FF8,
    0x0C18, 0x0C18, 0x0C18, 0x0FF8,
    0x07F0, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  },

  // 9
  {
    0x0000, 0x0000, 0x0000, 0x0000,
    0x0000, 0x07F0, 0x0FF8, 0x0C18,
    0x0C18, 0x0C18, 0x0FF8, 0x07F8,
    0x0018, 0x0018, 0x0018, 0x0FF0,
    0x07E0, 0x0000, 0x0000, 0x0000,
    0x0000, 0x0000, 0x0000, 0x0000
  }
};


static String normalizeText(const String& input)
{
  String output;
  output.reserve(input.length());

  for (int i = 0; i < input.length(); i++)
  {
    uint8_t c = (uint8_t)input[i];

    // ASCII
    if (c < 0x80)
    {
      // minúsculas -> maiúsculas
      if (c >= 'a' && c <= 'z')
        c -= 32;

      output += (char)c;
      continue;
    }

    // UTF-8 de caracteres latinos:
    // C3 80-BF
    if (c == 0xC3 && i + 1 < input.length())
    {
      uint8_t c2 = (uint8_t)input[++i];

      switch (c2)
      {
        // A
        case 0x80: // À
        case 0x81: // Á
        case 0x82: // Â
        case 0x83: // Ã
        case 0x84: // Ä
        case 0xA0: // à
        case 0xA1: // á
        case 0xA2: // â
        case 0xA3: // ã
        case 0xA4: // ä
          output += 'A';
          break;

        // C
        case 0x87: // Ç
        case 0xA7: // ç
          output += 'C';
          break;

        // E
        case 0x88: // È
        case 0x89: // É
        case 0x8A: // Ê
        case 0x8B: // Ë
        case 0xA8: // è
        case 0xA9: // é
        case 0xAA: // ê
        case 0xAB: // ë
          output += 'E';
          break;

        // I
        case 0x8C: // Ì
        case 0x8D: // Í
        case 0x8E: // Î
        case 0x8F: // Ï
        case 0xAC: // ì
        case 0xAD: // í
        case 0xAE: // î
        case 0xAF: // ï
          output += 'I';
          break;

        // O
        case 0x92: // Ò
        case 0x93: // Ó
        case 0x94: // Ô
        case 0x95: // Õ
        case 0x96: // Ö
        case 0xB2: // ò
        case 0xB3: // ó
        case 0xB4: // ô
        case 0xB5: // õ
        case 0xB6: // ö
          output += 'O';
          break;

        // U
        case 0x99: // Ú
        case 0x9A: // Ú? / Û
        case 0x9B: // Ü
        case 0x98: // Ù
        case 0xB9: // ù
        case 0xBA: // ú
        case 0xBB: // û
        case 0xBC: // ü
          output += 'U';
          break;

        default:
          // Caractere UTF-8 que não suportamos
          output += ' ';
          break;
      }

      continue;
    }

    // Qualquer outro UTF-8 não suportado
    output += ' ';
  }

  return output;
}

static int getFontIndex(char c)
{
  if (c == ' ')
    return 0;

  if (c >= 'A' && c <= 'Z')
    return 1 + (c - 'A');

  if (c >= '0' && c <= '9')
    return 27 + (c - '0');

  return 0;
}


static void setPixel(
  uint8_t* buffer,
  int width,
  int height,
  int x,
  int y,
  uint8_t color
)
{
  if (
    x < 0 ||
    y < 0 ||
    x >= width ||
    y >= height
  )
  {
    return;
  }

  const int pixelIndex =
    y * width + x;

  const int byteIndex =
    pixelIndex / 2;

  if ((pixelIndex & 1) == 0)
  {
    buffer[byteIndex] =
      (buffer[byteIndex] & 0x0F) |
      ((color & 0x0F) << 4);
  }
  else
  {
    buffer[byteIndex] =
      (buffer[byteIndex] & 0xF0) |
      (color & 0x0F);
  }
}

static void drawPunctuation(
  uint8_t* buffer,
  int width,
  int height,
  char character,
  int x,
  int y,
  uint8_t color
)
{
  switch (character)
  {
    case '.':
      for (int py = 20; py <= 23; py++)
      {
        for (int px = 6; px <= 9; px++)
        {
          setPixel(buffer, width, height, x + px, y + py, color);
        }
      }
      break;

    case ',':
      setPixel(buffer, width, height, x + 6, y + 20, color);
      setPixel(buffer, width, height, x + 7, y + 20, color);
      setPixel(buffer, width, height, x + 8, y + 20, color);
      setPixel(buffer, width, height, x + 7, y + 21, color);
      setPixel(buffer, width, height, x + 6, y + 23, color);
      break;

    case ':':
      setPixel(buffer, width, height, x + 7, y + 8, color);
      setPixel(buffer, width, height, x + 8, y + 8, color);
      setPixel(buffer, width, height, x + 7, y + 19, color);
      setPixel(buffer, width, height, x + 8, y + 19, color);
      break;

    case ';':
      setPixel(buffer, width, height, x + 7, y + 8, color);
      setPixel(buffer, width, height, x + 8, y + 8, color);
      setPixel(buffer, width, height, x + 7, y + 19, color);
      setPixel(buffer, width, height, x + 8, y + 19, color);
      setPixel(buffer, width, height, x + 7, y + 21, color);
      setPixel(buffer, width, height, x + 6, y + 23, color);
      break;

    case '!':
      for (int py = 5; py <= 18; py++)
        setPixel(buffer, width, height, x + 7, y + py, color);

      setPixel(buffer, width, height, x + 6, y + 21, color);
      setPixel(buffer, width, height, x + 7, y + 21, color);
      setPixel(buffer, width, height, x + 8, y + 21, color);
      break;

    case '?':
      for (int px = 5; px <= 10; px++)
        setPixel(buffer, width, height, x + px, y + 5, color);

      setPixel(buffer, width, height, x + 5, y + 6, color);
      setPixel(buffer, width, height, x + 10, y + 6, color);

      for (int py = 7; py <= 10; py++)
        setPixel(buffer, width, height, x + 10, y + py, color);

      for (int px = 7; px <= 9; px++)
        setPixel(buffer, width, height, x + px, y + 11, color);

      setPixel(buffer, width, height, x + 8, y + 12, color);
      setPixel(buffer, width, height, x + 8, y + 13, color);

      setPixel(buffer, width, height, x + 7, y + 21, color);
      setPixel(buffer, width, height, x + 8, y + 21, color);
      setPixel(buffer, width, height, x + 9, y + 21, color);
      break;

    case '-':
      for (int px = 3; px <= 12; px++)
        setPixel(buffer, width, height, x + px, y + 13, color);
      break;

    case '(':
      for (int py = 6; py <= 18; py++)
        setPixel(buffer, width, height, x + 8 - (py > 12 ? 1 : 0), y + py, color);

      setPixel(buffer, width, height, x + 9, y + 5, color);
      setPixel(buffer, width, height, x + 8, y + 19, color);
      break;

    case ')':
      for (int py = 6; py <= 18; py++)
        setPixel(buffer, width, height, x + 7 + (py > 12 ? 1 : 0), y + py, color);

      setPixel(buffer, width, height, x + 6, y + 5, color);
      setPixel(buffer, width, height, x + 8, y + 19, color);
      break;

    case '/':
      for (int py = 5; py <= 20; py++)
      {
        int px = 12 - ((py - 5) * 8 / 15);

        setPixel(buffer, width, height, x + px, y + py, color);
        setPixel(buffer, width, height, x + px + 1, y + py, color);
      }
      break;

    case '\'':
      setPixel(buffer, width, height, x + 7, y + 5, color);
      setPixel(buffer, width, height, x + 8, y + 5, color);
      setPixel(buffer, width, height, x + 7, y + 6, color);
      setPixel(buffer, width, height, x + 8, y + 7, color);
      break;

    case '"':
      setPixel(buffer, width, height, x + 5, y + 5, color);
      setPixel(buffer, width, height, x + 6, y + 5, color);
      setPixel(buffer, width, height, x + 5, y + 6, color);

      setPixel(buffer, width, height, x + 10, y + 5, color);
      setPixel(buffer, width, height, x + 11, y + 5, color);
      setPixel(buffer, width, height, x + 10, y + 6, color);
      break;
  }
}

static void drawCharacter(
  uint8_t* buffer,
  int width,
  int height,
  char character,
  int x,
  int y,
  uint8_t color
)
{
  // Pontuação
  if (
    character == '.' ||
    character == ',' ||
    character == '!' ||
    character == '?' ||
    character == ':' ||
    character == ';' ||
    character == '-' ||
    character == '(' ||
    character == ')' ||
    character == '/' ||
    character == '\'' ||
    character == '"'
  )
  {
    drawPunctuation(
      buffer,
      width,
      height,
      character,
      x,
      y,
      color
    );

    return;
  }

  const int fontIndex =
    getFontIndex(character);

  for (int row = 0; row < 24; row++)
  {
    const uint16_t rowData =
      FONT_16X24[fontIndex][row];

    for (int column = 0; column < 16; column++)
    {
      if (rowData & (1 << (15 - column)))
      {
        setPixel(
          buffer,
          width,
          height,
          x + column,
          y + row,
          color
        );
      }
    }
  }
}


// Desenha uma moldura retangular ao redor da área do display.
static void drawBorder(
  uint8_t* buffer,
  int width,
  int height,
  int margin,
  int thickness,
  uint8_t color
)
{
  for (int t = 0; t < thickness; t++)
  {
    const int left = margin + t;
    const int right = width - 1 - margin - t;
    const int top = margin + t;
    const int bottom = height - 1 - margin - t;

    // Linha superior e inferior
    for (int x = left; x <= right; x++)
    {
      setPixel(
        buffer,
        width,
        height,
        x,
        top,
        color
      );

      setPixel(
        buffer,
        width,
        height,
        x,
        bottom,
        color
      );
    }

    // Linha esquerda e direita
    for (int y = top; y <= bottom; y++)
    {
      setPixel(
        buffer,
        width,
        height,
        left,
        y,
        color
      );

      setPixel(
        buffer,
        width,
        height,
        right,
        y,
        color
      );
    }
  }
}


bool TextRenderer::render(
  uint8_t* buffer,
  int width,
  int height,
  const String& text,
  uint8_t textColor,
  uint8_t backgroundColor
)
{
  if (buffer == nullptr)
    return false;

  if (width <= 0 || height <= 0)
    return false;

  const String normalizedText =
    normalizeText(text);

  const int bufferSize =
    width * height / 2;

  // Fundo
  for (int i = 0; i < bufferSize; i++)
  {
    buffer[i] =
      ((backgroundColor & 0x0F) << 4) |
      (backgroundColor & 0x0F);
  }

  // Moldura
  const int borderMargin = 10;
  const int borderThickness = 2;

  drawBorder(
    buffer,
    width,
    height,
    borderMargin,
    borderThickness,
    textColor
  );

  const int characterWidth = 16;
  const int characterSpacing = 2;
  const int wordSpacing = 14;
  const int characterHeight = 24;

  const int lineHeight = 30;
  const int margin = 30;

  int x = margin;
  int y = margin;

  int i = 0;

  while (i < normalizedText.length())
  {
    // Quebra de linha explícita
    if (normalizedText[i] == '\n')
    {
      x = margin;
      y += lineHeight;
      i++;

      if (y + characterHeight > height - margin)
        break;

      continue;
    }

    // Ignora espaços no começo de uma linha
    if (normalizedText[i] == ' ')
    {
      i++;
      continue;
    }

    // Encontra o fim da próxima palavra
    int wordStart = i;
    int wordEnd = i;

    while (
      wordEnd < normalizedText.length() &&
      normalizedText[wordEnd] != ' ' &&
      normalizedText[wordEnd] != '\n'
    )
    {
      wordEnd++;
    }

    // Calcula a largura da palavra
    const int wordLength =
      wordEnd - wordStart;

    const int wordWidth =
      wordLength * characterWidth +
      (wordLength - 1) * characterSpacing;

    // Se a palavra não cabe na linha atual,
    // pula para a próxima linha antes de desenhá-la.
    if (
      x != margin &&
      x + wordWidth > width - margin
    )
    {
      x = margin;
      y += lineHeight;

      if (y + characterHeight > height - margin)
        break;
    }

    // Desenha a palavra inteira
    for (int j = wordStart; j < wordEnd; j++)
    {
      drawCharacter(
        buffer,
        width,
        height,
        normalizedText[j],
        x,
        y,
        textColor
      );

      x += characterWidth;

      // Espaçamento entre letras.
      // Não adiciona depois da última letra da palavra.
      if (j < wordEnd - 1)
        x += characterSpacing;
    }

    i = wordEnd;

    // Espaço visual entre palavras
    if (
      i < normalizedText.length() &&
      normalizedText[i] == ' '
    )
    {
      x += wordSpacing;
      i++;
    }
  }

  return true;
}