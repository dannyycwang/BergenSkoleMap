# BergenSkoleMap

Bergen 小學互動地圖專案：
- 清洗 `educationBergen_with_address.xlsx`（若存在）或 `educationBergen.xlsx` 學校資料
- 直接使用原始資料表的 address 欄位進行地理定位（不需要再人工補地址）
- 用 Leaflet 建立互動式地圖（搜尋、篩選、縮放、側欄詳情）

## 一鍵重建（推薦）
```bash
./scripts/rebuild_map_data.sh
```
這會依序執行：
1. `prepare_data.py`（清洗並保留原始 `address`）
2. `geocode_schools.py`（用 address 精準定位）

## 1) 資料清洗
```bash
python scripts/prepare_data.py
```
輸出：
- `data/bergen_primary_schools_cleaned.csv`
- `data/bergen_primary_schools.json`
- `data/bergen_primary_schools.geojson`（近似 fallback）

## 2) 用地址做地理定位
```bash
python scripts/geocode_schools.py
```
預設行為：
- 優先使用 `main` 工作表中的 address 欄位查詢座標（若存在）
- 若查不到，保留空座標（不再使用雜湊近似座標）

可選參數：
- `--allow-name-fallback`：地址查不到時才補用校名查詢
- `--dry-run`：只測試，不寫輸出檔

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
