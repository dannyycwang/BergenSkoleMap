# BergenSkoleMap

Bergen 小學互動地圖專案：
- 清洗 `educationBergen.xlsx` 學校資料
- 用 Python 抓地址/座標（若表內有 address 會優先使用）
- 用 Leaflet 建立互動式地圖（搜尋、篩選、縮放、側欄詳情）

## 1) 資料清洗
```bash
python scripts/prepare_data.py
```
輸出：
- `data/bergen_primary_schools_cleaned.csv`
- `data/bergen_primary_schools.json`
- `data/bergen_primary_schools.geojson`（近似 fallback）

## 2) 抓真實地址與座標（重要）
```bash
python scripts/geocode_schools.py
```
輸出：
- `data/bergen_primary_schools_geocoded.csv`
- `data/bergen_primary_schools_geocoded.json`
- `data/bergen_primary_schools_geocoded.geojson`
- `data/geocode_cache.json`

> `geocode_schools.py` 會先用 address 欄位（若存在）查詢，再退回學校名稱查詢。

## 3) 啟動網頁
```bash
python -m http.server 4173
```
開啟：
- `http://localhost:4173/`
- `http://localhost:4173/web/`

## 4) 互動功能
- 搜尋學校名稱
- 學生數滑桿篩選
- 精準/近似定位狀態篩選
- 一鍵縮放到目前篩選結果
- Marker hover 動畫、點擊 fly-to
- 右側詳情面板
