#!/usr/bin/env python3
"""
扫 public/assets/life，生成 src/data/lifeAssets.ts（Life 页两批预加载的素材清单）。
素材有增删时在项目根目录跑一次：python3 scripts/gen-life-assets.py
"""
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIFE = ROOT / "public/assets/life"
OUT = ROOT / "src/data/lifeAssets.ts"


def files(sub, skip=()):
    out = []
    for p in sorted((LIFE / sub).rglob("*")):
        if p.is_file() and p.suffix in (".webp", ".png") and not any(s in p.parts for s in skip):
            out.append("/" + str(p.relative_to(ROOT / "public")))
    return out


first = ["/assets/life/room-bg-tile.webp", "/assets/life/room-floor-tile.webp"] + files("seg01", skip=("dress-anim",)) + files("list")
rest = files("seg02", skip=("paint-anim",)) + files("seg03")


def block(name, doc, arr):
    body = ",\n".join(f'  "{u}"' for u in arr)
    return f"/** {doc} */\nexport const {name}: readonly string[] = [\n{body},\n];\n"


src = """/**
 * Life 页素材清单（自动生成，别手改）。分两批预加载：
 *   lifeFirstAssets  进门第一屏就要的：墙面、段01 衣帽区（含窗户/唱片帧）、清单抽屉
 *   lifeRestAssets   往右走才看到的：段02 起居区、段03 厨房 + LAB 门
 * 换装（seg01/dress-anim）和作画（seg02/paint-anim）两套帧序列不在这里，RoomStage 在触发前才预热。
 *
 * 素材有增删时重新生成（在项目根目录）：
 *   python3 scripts/gen-life-assets.py
 */

"""
src += block("lifeFirstAssets", f"第一屏：{len(first)} 个文件", first)
src += "\n" + block("lifeRestAssets", f"后面两段：{len(rest)} 个文件", rest)
OUT.write_text(src)


def mb(arr):
    return sum(os.path.getsize(ROOT / "public" / u.lstrip("/")) for u in arr) / 1e6


print(f"first {len(first)} files {mb(first):.1f}MB, rest {len(rest)} files {mb(rest):.1f}MB -> {OUT.relative_to(ROOT)}")
