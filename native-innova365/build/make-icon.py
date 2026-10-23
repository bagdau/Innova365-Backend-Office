"""Рисует иконку приложения: build/icon.png (512x512). Запуск: python build/make-icon.py"""
import os
from PIL import Image, ImageDraw, ImageFont

S = 512
here = os.path.dirname(os.path.abspath(__file__))

# диагональный градиент индиго
img = Image.new('RGBA', (S, S))
px = img.load()
c1, c2 = (129, 140, 248), (67, 56, 202)
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * S - 2)
        px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)

# скруглённые углы
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=112, fill=255)
img.putalpha(mask)

d = ImageDraw.Draw(img)
def font(size, bold=True):
    for name in (('arialbd.ttf', 'segoeuib.ttf') if bold else ('arial.ttf', 'segoeui.ttf')):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()

f1, f2 = font(300), font(84)
w = d.textlength('I', font=f1)
d.text(((S - w) / 2, 50), 'I', font=f1, fill=(255, 255, 255, 255))
w2 = d.textlength('365', font=f2)
d.text(((S - w2) / 2, 372), '365', font=f2, fill=(255, 255, 255, 235))

img.save(os.path.join(here, 'icon.png'))
print('icon.png', img.size)
