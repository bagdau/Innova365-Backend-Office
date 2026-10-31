"""Create Windows icon from the supplied Innova365 POS brand image."""
from pathlib import Path
from PIL import Image

here = Path(__file__).resolve().parent
logo = Image.open(here / "logo.png").convert("RGB")
canvas = Image.new("RGBA", (512, 512), "white")
mark = logo.crop((16, 8, 114, 108)).resize((448, 448), Image.Resampling.LANCZOS)
canvas.paste(mark, ((512 - mark.width) // 2, (512 - mark.height) // 2))
canvas.save(here / "icon.png")
canvas.save(here / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icon.png, icon.ico")
