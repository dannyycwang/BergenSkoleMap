# BergenSkoleMap

Bergen 小學互動地圖專案：
- 清洗 `educationBergen_with_address.xlsx`（若存在）或 `educationBergen.xlsx` 學校資料
- 優先使用原始資料表的 `address` 欄位進行地理定位
- 用 Leaflet 建立互動式地圖（搜尋、篩選、縮放、側欄詳情）

## 快速開始（重新 clone 後建議照這個跑）

### A. 先直接看目前版本地圖（最穩定）
> 這個模式會直接使用 repo 內已提交的 `data/*` 檔案。

```bash
python -m http.server 4173
```
開啟：
- `http://localhost:4173/`

### B. 需要重建資料時（會覆寫 data 檔）
```bash
./scripts/rebuild_map_data.sh
```
這會依序執行：
1. `python scripts/prepare_data.py`
2. `python scripts/geocode_schools.py`

---

## 重點說明（避免「拉下來後跟截圖不一樣」）

- `prepare_data.py` 會重建清洗檔，並保留所有來源欄位（`src__*`）供前端顯示。
- `geocode_schools.py` 需要可連外網路呼叫 geocoding 服務；若環境擋網路，可能得到大量 `not_found` / 空座標。
- 若你只想看 UI 效果（分組欄位、點大小、同色 marker），**可先不要重跑 geocode**，直接 `python -m http.server 4173` 即可。

---

## 常用指令

### 1) 只重建清洗資料（不 geocode）
```bash
python scripts/prepare_data.py
```
輸出：
- `data/bergen_primary_schools_cleaned.csv`
- `data/bergen_primary_schools.json`
- `data/bergen_primary_schools.geojson`
- `data/benchmarks.json`（Bergen / Vestland 整體比較基準）

### 2) 只做 geocode
```bash
python scripts/geocode_schools.py
```
可選參數：
- `--allow-name-fallback`：地址查不到時才補用校名查詢
- `--dry-run`：只測試，不寫輸出檔

---

## 目前前端效果
- Marker 同色呈現，大小依學生數縮放
- 可搜尋學校名稱、依學生數滑桿篩選
- 右側詳情面板分組顯示（包含霸凌相關區塊）
- 顯示原始欄位（`src__*`）且翻譯成中文（逐步擴充）
