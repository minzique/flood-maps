# Data Comparison: API vs Official Report

**Official Report Date**: 29-Nov-2025, 3:30 PM Sri Lanka Time
**API Data Fetched**: 29-Nov-2025, ~12:30-12:35 PM UTC (~6:00-6:05 PM SLT)

## Comparison Table

| River Basin | Station | Official Level | API Level | Official Status | API Status | Match |
|-------------|---------|----------------|-----------|-----------------|------------|-------|
| **Kelani Ganga** |
| | Nagalagam Street | 6.20 ft | 6.40 m | Minor Flood | MINOR_FLOOD | ⚠️ Units differ |
| | Hanwella | 10.81 m | 10.85 m | Major Flood | MAJOR_FLOOD | ✅ |
| | Glencourse | 20.75 m | 20.35 m | Major Flood | MAJOR_FLOOD | ✅ |
| | Kithulgala | 2.85 m | 4.05 m | Normal | MINOR_FLOOD | ❌ |
| | Holombuwa | 2.81 m | 2.64 m | Normal | NORMAL | ✅ |
| | Deraniyagala | 2.38 m | 2.27 m | Normal | NORMAL | ✅ |
| | Norwood | 1.70 m | 1.65 m | Alert | ALERT | ✅ |
| **Kalu Ganga** |
| | Putupaula | 3.87 m | 3.93 m | Alert | ALERT | ✅ |
| | Ellagawa | NA | 11.90 m | - | MINOR_FLOOD | ⚠️ Official NA |
| | Rathnapura | 8.55 m | 8.35 m | Minor Flood | MINOR_FLOOD | ✅ |
| | Kalawellawa (Millakanda) | 8.13 m | 8.14 m | Major Flood | MAJOR_FLOOD | ✅ |
| | Magura | 4.53 m | 4.39 m | Alert | ALERT | ✅ |
| **Gin Ganga** |
| | Baddegama | 3.20 m | 3.13 m | Normal | NORMAL | ✅ |
| | Thawalama | 2.54 m | 2.47 m | Normal | NORMAL | ✅ |
| **Nilwala Ganga** |
| | Thalgahagoda | 1.61 m | 1.60 m | Alert | ALERT | ✅ |
| | Panadugama | 4.46 m | 4.30 m | Normal | NORMAL | ✅ |
| | Pitabeddara | 1.49 m | 1.47 m | Normal | NORMAL | ✅ |
| | Urawa | 0.97 m | 0.97 m | Normal | NORMAL | ✅ |
| **Walawe Ganga** |
| | Moraketiya | 2.25 m | 2.20 m | Normal | NORMAL | ✅ |
| **Kirindi Oya** |
| | Thanamalwila | 2.10 m | 2.10 m | Normal | NORMAL | ✅ |
| | Wellawaya | 1.37 m | 1.34 m | Normal | NORMAL | ✅ |
| | Kuda Oya | 2.39 m | 2.35 m | Normal | NORMAL | ✅ |
| **Menik Ganga** |
| | Katharagama | 2.90 m | 2.11 m | Normal | NORMAL | ⚠️ Level differs |
| **Kumbukkan Oya** |
| | Nakkala | 2.00 m | 2.05 m | Normal | NORMAL | ✅ |
| **Heda Oya** |
| | Siyambalanduwa | 1.62 m | 1.61 m | Normal | NORMAL | ✅ |
| **Maduru Oya** |
| | Padiyathalawa | NA | 1.75 m | - | NORMAL | ⚠️ Official NA |
| **Mahaweli Ganga** |
| | Manampitiya | NA | - | - | NO_DATA | ✅ |
| | Weraganthota | NA | - | - | NO_DATA | ✅ |
| | Peradeniya | NA | - | - | NO_DATA | ✅ |
| | Nawalapitiya | NA | - | - | NO_DATA | ✅ |
| | Thaldena | NA | - | - | NO_DATA | ✅ |
| **Yan Oya** |
| | Horowpothana | 7.72 m | 7.69 m | Minor Flood | MINOR_FLOOD | ✅ |
| **Ma Oya** |
| | Yaka Wewa | NA | 2.11 m | - | NORMAL | ⚠️ Official NA |
| **Malwathu Oya** |
| | Thanthirimale | NA | 10.30 m | - | MAJOR_FLOOD | ⚠️ Official NA, stale data |
| **Mee Oya** |
| | Galgamuwa | NA | - | - | NO_DATA | ✅ |
| **Deduru Oya** |
| | Moragaswewa | NA | 8.33 m | - | MAJOR_FLOOD | ⚠️ Official NA, stale data |
| **Maha Oya** |
| | Badalgama | 13.38 m | 13.02 m | Major Flood | MAJOR_FLOOD | ✅ |
| | Giriulla | 11.47 m | 10.83 m | Major Flood | MAJOR_FLOOD | ✅ |
| **Attanagalu Oya** |
| | Dunamale | 6.60 m | 6.43 m | Major Flood | MAJOR_FLOOD | ✅ |

## Summary Statistics

- **Total Stations in Official Report**: 39
- **Total Stations in API**: 42
- **Matching Status**: 28/39 (72%)
- **NA in Official but Data in API**: 6 stations
- **Issues**: 4 stations with discrepancies

## Known Issues

### 1. Unit Mismatch - Nagalagam Street
- **Problem**: Official report shows **feet**, API returns **meters**
- **Impact**: Display shows incorrect comparison
- **Source**: ArcGIS data source issue

### 2. Status Mismatch - Kithulgala
- **Official**: 2.85 m → Normal
- **API**: 4.05 m → Minor Flood
- **Impact**: Incorrect flood status displayed
- **Possible Cause**: Different gauge reading or timing

### 3. Level Discrepancy - Katharagama
- **Official**: 2.90 m
- **API**: 2.11 m
- **Difference**: 0.79 m
- **Impact**: Minor, both show Normal status

### 4. Stale Data - Some Stations
- **Thanthirimale**: API data from Nov 28, 09:30
- **Moragaswewa**: API data from Nov 28, 00:34
- **Impact**: Shows Major Flood status but data is >24 hours old

## Flood Status Classification

| Status | Water Level Condition |
|--------|----------------------|
| MAJOR_FLOOD | level >= major threshold |
| MINOR_FLOOD | level >= minor threshold |
| ALERT | level >= alert threshold |
| NORMAL | level < alert threshold |
| UNKNOWN | Missing threshold data |
| NO_DATA | No recent readings |

## Recommendations

1. **Add unit indicator** for Nagalagam Street (feet vs meters)
2. **Add staleness warning** for data older than 6 hours
3. **Investigate Kithulgala** discrepancy with data source
4. **Consider filtering** stations with data older than 24 hours
