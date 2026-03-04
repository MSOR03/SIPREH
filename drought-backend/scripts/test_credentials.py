import os
import duckdb
import time

# 🔹 Leer variables de entorno
CLOUD_STORAGE_PROVIDER="cloudflare-r2"
CLOUD_STORAGE_ENDPOINT="292766f9bdfeb4ae57479857469a184b.r2.cloudflarestorage.com"
CLOUD_ACCOUNT_ID="292766f9bdfeb4ae57479857469a184b"
CLOUD_STORAGE_TOKEN="pGUNbghZi_3dHPPqA2bcQdHKeTzPURfGKuhktxBB"
CLOUD_STORAGE_BUCKET="drought-monitor-data"
CLOUD_STORAGE_ACCESS_KEY="8271fe65436cd6fbb790a9eadbc0f7d6"
CLOUD_STORAGE_SECRET_KEY="2377328bf0817d96728e654657257e0140b766bba7b4cf425be04560a67325c4"
CLOUD_STORAGE_REGION="auto"

import duckdb
import time

# ==============================
# CONEXIÓN
# ==============================

print("\n🔌 Conectando a DuckDB...")
t0 = time.time()

con = duckdb.connect()
con.execute("INSTALL httpfs;")
con.execute("LOAD httpfs;")

# Configuración S3 (Cloudflare R2)
con.execute(f"SET s3_region='{CLOUD_STORAGE_REGION}';")
con.execute(f"SET s3_access_key_id='{CLOUD_STORAGE_ACCESS_KEY}';")
con.execute(f"SET s3_secret_access_key='{CLOUD_STORAGE_SECRET_KEY}';")
con.execute(f"SET s3_endpoint='{CLOUD_STORAGE_ENDPOINT}';")

# Estilo de URL: prueba 'virtual' si 'path' es lento
con.execute("SET s3_url_style='path';")
con.execute("SET s3_use_ssl=true;")

# Activar cache y paralelismo
con.execute("PRAGMA enable_object_cache;")
con.execute("PRAGMA threads=8;")  # Ajusta según tus cores

print(f"✅ Conectado en {round(time.time() - t0, 2)} segundos\n")

s3_url = f"s3://{CLOUD_STORAGE_BUCKET}/parquet/20260301_181628_grid_ERA5.parquet"

# ==============================
# 1️⃣ METADATA GENERAL
# ==============================

print("📦 Leyendo metadata del Parquet...")
t1 = time.time()

metadata = con.execute(f"""
    SELECT *
    FROM parquet_metadata('{s3_url}')
""").fetchdf()

t_metadata = round(time.time() - t1, 2)
print(f"⏱ Tiempo metadata: {t_metadata} segundos")

print("\nColumnas disponibles en metadata:")
print(metadata.columns)

# ==============================
# 2️⃣ ROW GROUPS
# ==============================

row_groups = metadata["row_group_id"].nunique()
print(f"📊 Número de Row Groups: {row_groups}")

rows_por_group = metadata.groupby("row_group_id")["row_group_num_rows"].max()
print("\n📈 Filas por Row Group:")
print(rows_por_group)

# ==============================
# 3️⃣ TOTAL FILAS (rápido con metadata)
# ==============================

print("\n🔢 Contando filas totales (solo metadata)...")
t2 = time.time()

total_rows = con.execute(f"""
    SELECT SUM(row_group_num_rows)
    FROM parquet_metadata('{s3_url}')
""").fetchone()[0]

t_count = round(time.time() - t2, 2)
print(f"⏱ Tiempo COUNT (metadata): {t_count} segundos")
print(f"📊 Total filas: {total_rows}")

# ==============================
# 4️⃣ LIMIT 10 (lectura parcial)
# ==============================

print("\n🔎 Probando SELECT LIMIT 10...")
t3 = time.time()

sample = con.execute(f"""
    SELECT *
    FROM '{s3_url}'
    LIMIT 10
""").fetchdf()

t_limit = round(time.time() - t3, 2)
print(f"⏱ Tiempo LIMIT 10: {t_limit} segundos")
print(sample)

# ==============================
# 5️⃣ SOLO UNA COLUMNA
# ==============================

print("\n📌 Probando SELECT de una sola columna...")
t4 = time.time()

onecol = con.execute(f"""
    SELECT row_group_id
    FROM parquet_metadata('{s3_url}')
    LIMIT 5
""").fetchdf()

t_onecol = round(time.time() - t4, 2)
print(f"⏱ Tiempo metadata simple: {t_onecol} segundos")
print(onecol)

# ==============================
# 📋 RESUMEN
# ==============================

print("\n==============================")
print("📋 RESUMEN")
print("==============================")
print(f"Metadata: {t_metadata}s")
print(f"COUNT (metadata): {t_count}s")
print(f"LIMIT 10: {t_limit}s")
print(f"Row Groups: {row_groups}")
print(f"Total filas: {total_rows}")
print("==============================")
