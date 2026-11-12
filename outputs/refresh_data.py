#!/usr/bin/env python3
"""Download ERPsim OData and write it to data.js for dashboard.html.

Usage:
    python3 refresh_data.py            # once
    python3 refresh_data.py --loop 60  # every 60 s (during the game)

Login: SAP user and password are read from the ERPSIM_USER / ERPSIM_PASS
environment variables, or the script prompts for them (password is hidden).
The password is never stored.
"""
import argparse
import base64
import getpass
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

BASE = os.environ.get("ERPSIM_ODATA", "https://erpsim-b1.hec.ca:8001/odata/418")
OUT = Path(__file__).with_name("data.js")

SETS = [
    "Company_Valuation",
    "Financial_Postings",
    "Independent_Requirements",
    "Purchase_Orders",
    "Production_Orders",
    "Inventory",
    "Current_Inventory_KPI",
    "Current_Pricing_Conditions",
    "Market",
    "Marketing_Expenses",
    "Production",
    "Sales",
    "Stock_Transfers",
    "Current_Inventory",
    "Current_Suppliers_Prices",
    "Current_Game_Rules",
]


def fetch_set(name: str, auth: str) -> list:
    rows, url = [], f"{BASE}/{name}?$format=json"
    while url:
        req = urllib.request.Request(url, headers={"Authorization": auth, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.load(r)["d"]
        for x in d.get("results", []):
            x.pop("__metadata", None)
            rows.append(x)
        url = d.get("__next")
    return rows


def refresh(auth: str) -> None:
    data: dict = {"_fetched":datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
    for s in SETS:
        data[s] = fetch_set(s, auth)
    comp = next((r.get("COMPANY_CODE") for r in data["Company_Valuation"]), "")
    data["_company"] = comp
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text("window.ERPSIM_DATA = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
    tmp.replace(OUT)
    n = {k: len(v) for k, v in data.items() if isinstance(v, list) and v}
    print(f"[{data['_fetched']}] data.js updated: {n}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--loop", type=int, default=0, help="interval in seconds (0 = run once)")
    a = ap.parse_args()
    user = os.environ.get("ERPSIM_USER") or input("SAP user: ")
    pw = os.environ.get("ERPSIM_PASS") or getpass.getpass("SAP password: ")
    auth = "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()
    while True:
        try:
            refresh(auth)
        except urllib.error.HTTPError as e:
            print(f"HTTP error {e.code}: {e.reason}", file=sys.stderr)
            if e.code in (401, 403):
                sys.exit("Login failed – check user/password.")
        except Exception as e:  # network, timeout...
            print(f"Error: {e}", file=sys.stderr)
        if not a.loop:
            break
        time.sleep(a.loop)


if __name__ == "__main__":
    main()
