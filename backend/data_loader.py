import json
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), "../data")

def load_aptitude(company, level):
    path = os.path.join(DATA_PATH, "aptitude", f"{company.lower()}.json")
    print(f"[Aptitude] Loading: {path} for level: {level.lower()}")
    if not os.path.exists(path):
        print("[Aptitude] File not found:", path)
        return []
    with open(path) as f:
        data = json.load(f)
    print("[Aptitude] File loaded. Available keys:", list(data.keys()))
    if level.lower() not in data:
        print(f"[Aptitude] Level '{level.lower()}' not found in {path}. Available: {list(data.keys())}")
        return []
    print("[Aptitude] Returning questions:", data[level.lower()])
    return data[level.lower()]

def load_coding(company, level):
    path = os.path.join(DATA_PATH, "coding", f"{company.lower()}.json")
    print(f"[Coding] Loading: {path} for level: {level.lower()}")
    if not os.path.exists(path):
        print("[Coding] File not found:", path)
        return []
    with open(path) as f:
        data = json.load(f)
    print("[Coding] File loaded. Available keys:", list(data.keys()))
    if level.lower() not in data:
        print(f"[Coding] Level '{level.lower()}' not found in {path}. Available: {list(data.keys())}")
        return []
    print("[Coding] Returning questions:", data[level.lower()])
    return data[level.lower()]