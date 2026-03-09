# BergenSkoleMap

Bergen 小學互動地圖專案：
- 清洗 `educationBergen.xlsx` 學校資料
- 用 Python 抓真實地址/座標（Nominatim）
- 用 Leaflet 建立可搜尋、可點擊查看資訊的地圖網頁

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

> 若要先測試少量：
```bash
python scripts/geocode_schools.py --limit 10
```

## 3) 啟動網頁
```bash
python -m http.server 4173
```
開啟：
- `http://localhost:4173/`
- `http://localhost:4173/web/`

## 4) 功能
- 搜尋學校名稱
- 點擊地圖標記後，右側詳情面板顯示完整學校資料
- 左側清單點擊可定位到學校
- 前端優先讀取 `*_geocoded.geojson`，若不存在再回退到 fallback 檔
