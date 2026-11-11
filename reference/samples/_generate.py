# -*- coding: utf-8 -*-
"""生成 4 份虚构成绩表样例，供子衿的结构探测器做测试靶子。
全部为虚构数据：姓名为常见假名，电话为 138000000xx 明显虚构号段。
"""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
from openpyxl.utils import get_column_letter
import random
import re

random.seed(20261111)
OUT = r"C:\Work\repos\zijin\reference\samples"

NAMES = ["张伟", "王芳", "李娜", "刘洋", "陈静", "杨帆", "赵磊", "黄敏", "周涛", "吴倩", "徐鹏",
         "孙丽", "马超", "朱琳", "胡军", "郭燕", "何伟", "高翔", "林雪", "罗强", "郑爽", "梁静",
         "宋佳", "谢峰", "韩雪", "唐磊", "冯娜", "曹阳", "邓超", "许静", "彭飞", "蒋敏", "蔡明"]
TIERS = ["3区1A", "3区1B", "3区2A", "3区2B"]
TEACHERS = ["王子柔", "李迎莉"]


def make_rows():
    """生成 33 条自洽的虚构数据。"""
    students = []
    for i, name in enumerate(NAMES):
        math_tier = TIERS[i % 4]
        eng_tier = TIERS[(i + 1) % 4]
        chn = round(random.uniform(62, 96) * 2) / 2
        math = round(random.uniform(40, 100) * 2) / 2
        eng = round(random.uniform(45, 99) * 2) / 2
        phy = round(random.uniform(55, 98) * 2) / 2
        total = chn + math + eng + phy
        prev_total = round(total + random.uniform(-28, 28), 1)
        students.append({
            "name": name, "class": 10,
            "prev_total": prev_total, "total": total,
            "chn": chn, "math": math, "eng": eng, "phy": phy,
            "math_tier": math_tier, "eng_tier": eng_tier,
            "advisor": TEACHERS[i % 2],
        })

    # 排名：总分整体；数学/英语按层合并；语文/物理整体
    def assign_rank(items, key_fn, rank_key, pool_fn=None):
        pools = {}
        for s in items:
            pools.setdefault(pool_fn(s) if pool_fn else "_all", []).append(s)
        for arr in pools.values():
            arr.sort(key=key_fn, reverse=True)
            for i, s in enumerate(arr, 1):
                s[rank_key] = i

    assign_rank(students, lambda s: s["total"], "rank")
    assign_rank(students, lambda s: s["prev_total"], "prev_rank")
    for sub, tier_key, score_key, rank_key in (
        ("chn", None, "chn", "chn_rank"),
        ("phy", None, "phy", "phy_rank"),
    ):
        assign_rank(students, lambda s, k=score_key: s[k], rank_key)
        for s in students:
            s[rank_key + "_prev"] = max(1, s[rank_key] + random.randint(-12, 12))
    for sub, tier_key, score_key, rank_key in (
        ("math", "math_tier", "math", "math_rank"),
        ("eng", "eng_tier", "eng", "eng_rank"),
    ):
        assign_rank(students, lambda s, k=score_key: s[k], rank_key,
                    pool_fn=lambda s, t=tier_key: re.search(r"区([12])", s[t]).group(1))
        for s in students:
            s[rank_key + "_prev"] = max(1, s[rank_key] + random.randint(-15, 15))
    return students


STUDENTS = make_rows()


def build_standard(path):
    """本学期期中表格式：两次次别 + 分层 + 导师，单行表头。"""
    wb = Workbook(); ws = wb.active; ws.title = "Sheet1"
    headers = ["姓名", "班级", "总分1", "级名1", "期中总分", "级名", "浮动",
               "语文级名1", "语文分数2", "级名2",
               "数学分层", "数学级名1", "数学分数2", "级名2",
               "英语分层", "英语级名1", "英语分数2", "级名2",
               "物理级名1", "物理分数2", "级名2", "负责导师"]
    ws.append(headers)
    for s in STUDENTS:
        ws.append([s["name"], s["class"], s["prev_total"], s["prev_rank"], s["total"], s["rank"],
                   s["prev_rank"] - s["rank"],
                   s["chn_rank_prev"], s["chn"], s["chn_rank"],
                   s["math_tier"], s["math_rank_prev"], s["math"], s["math_rank"],
                   s["eng_tier"], s["eng_rank_prev"], s["eng"], s["eng_rank"],
                   s["phy_rank_prev"], s["phy"], s["phy_rank"], s["advisor"]])
    for c in range(1, len(headers) + 1):
        ws.column_dimensions[get_column_letter(c)].width = 12
    wb.save(path)


def build_flat(path):
    """最简格式：单次考试、无分层、三科。"""
    wb = Workbook(); ws = wb.active; ws.title = "成绩"
    ws.append(["姓名", "语文", "数学", "英语", "总分", "班名"])
    rows = sorted(STUDENTS, key=lambda s: s["total"], reverse=True)
    for i, s in enumerate(rows, 1):
        ws.append([s["name"], s["chn"], s["math"], s["eng"], s["total"], i])
    wb.save(path)


def build_messy(path):
    """压力测试：三行合并表头、列名带空格、末尾多一行合计。"""
    wb = Workbook(); ws = wb.active; ws.title = "八年级10班"
    ws["A1"] = "八年级(10)班  2026学年第一学期  期中考试成绩表"
    ws.merge_cells("A1:F1")
    ws["A1"].font = Font(bold=True, size=14)
    ws["A1"].alignment = Alignment(horizontal="center")

    # 第 2、3 行做多行表头
    ws["A2"] = " 姓名 "; ws.merge_cells("A2:A3")
    ws["B2"] = "语文"; ws.merge_cells("B2:C2")
    ws["D2"] = "数学"; ws.merge_cells("D2:E2")
    ws["F2"] = "总分"; ws.merge_cells("F2:F3")
    for col in ("B3", "C3", "D3", "E3"):
        ws[col] = "  分数  " if col in ("B3", "D3") else " 班名 "
    ws.merge_cells("A1:F1")

    r = 4
    rows = sorted(STUDENTS, key=lambda s: s["total"], reverse=True)
    for i, s in enumerate(rows, 1):
        ws.cell(row=r, column=1, value=s["name"])
        ws.cell(row=r, column=2, value=s["chn"])
        ws.cell(row=r, column=3, value=i)
        ws.cell(row=r, column=4, value=s["math"])
        ws.cell(row=r, column=5, value=i)
        ws.cell(row=r, column=6, value=s["total"])
        r += 1
    ws.cell(row=r, column=1, value="班级平均")
    for c in (2, 4, 6):
        col = get_column_letter(c)
        ws.cell(row=r, column=c, value=f'=ROUND(AVERAGE({col}4:{col}{r-1}),1)')
    wb.save(path)


def build_broken(path):
    """错误路径：姓名列表头缺失、分数有文本、有重复行、有空行。"""
    wb = Workbook(); ws = wb.active; ws.title = "Sheet1"
    ws.append([None, "语文", "数学", "英语"])          # 姓名列表头空
    rows = sorted(STUDENTS, key=lambda s: s["total"], reverse=True)[:10]
    for s in rows:
        ws.append([s["name"], s["chn"], s["math"], s["eng"]])
    ws.append([rows[0]["name"], rows[0]["chn"], rows[0]["math"], rows[0]["eng"]])  # 重复行
    ws.append([None, None, None, None])                                             # 空行
    ws.append(["缺考生的同学", "缺考", 88, 90])                                      # 文本分数
    wb.save(path)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    build_standard(os.path.join(OUT, "sample-standard.xlsx"))
    build_flat(os.path.join(OUT, "sample-flat.xlsx"))
    build_messy(os.path.join(OUT, "sample-messy.xlsx"))
    build_broken(os.path.join(OUT, "sample-broken.xlsx"))
    for f in sorted(os.listdir(OUT)):
        if f.endswith(".xlsx"):
            print(f"  {f}  {os.path.getsize(os.path.join(OUT, f))} B")

