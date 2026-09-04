#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ETL — Migración de datos Excel → Supabase
VICSON Gestion — Mayo 2017, Sucursal VICSON VALENCIA

Lee los 6 archivos Excel accesibles y carga los datos al schema de Supabase.
Requiere:
  - openpyxl, pandas, xlrd
  - supabase-python: pip install supabase-python
  - Credenciales en archivo .env o variables de entorno

Uso:
    python etl_migracion.py [--host HOST] [--key KEY] [--schema public]

Archivos procesados:
    1. CUP MAYO 2017 VICSON VALENCIA.xls      → cup_diario, venta_comensal
    2. GUIAS VICSON 1ERA SEMANA.xls           → guias_fact, guias_detalle, refri_diario
    3. GUIAS VICSON 2DA SEMANA.xls           → guias_fact, guias_detalle, refri_diario
    4. CFC+CJC+RG+PXF 2017 vicson valencia.xlsx → cfc, rg, px, reembolsables, dic, facturacion_cliente, facturacion_servicio
    5. 023 - VICSON VALENCIA - RECOP 2017 PRECIERRE MAYO.xlsx → dic, traspasos_recibidos, traspaso, facturacion_cliente, facturacion_servicio
    6. INVENTARIO 19 PPRE-CIERRE.xlsx         → inventario, inventario_mov

⚠️  CONTROL DE TRASPASOS — sigue encriptado, se omite hasta tener contraseña.
"""

import os
import sys
import json
import logging
import argparse
import re
from datetime import datetime, date
from typing import Optional, List, Dict, Any, Tuple

import pandas as pd
import numpy as np
from openpyxl import load_workbook
import xlrd

# Supabase Python client
try:
    from supabase import create_client, Client
except ImportError:
    print("❌  pip install supabase-python necesario")
    sys.exit(1)

# ---------------- Configuración ----------------

BASE_DIR = r"C:/Users/Agencia de viajes/OneDrive/Escritorio/CUP vicson"

FILES = {
    "cup": r"CUP MAYO 2017 VICSON VALENCIA.xls",
    "guias_1": r"GUIAS VICSON 1ERA SEMANA.xls",
    "guias_2": r"GUIAS VICSON 2DA SEMANA.xls",
    "cfc_rg_px": r"CFC+CJC+RG+PXF 2017 vicson valencia.xlsx",
    "recop": r"023 - VICSON VALENCIA - RECOP 2017 PRECIERRE MAYO.xlsx",
    "inventario": r"INVENTARIO 19 PPRE-CIERRE.xlsx",
    "traspasos_encriptado": r"CONTROL DE TRASPASOS  VICSON VALENCIA CORTE AL 19 DE MAYO.xls",
}

# ---------------- Logging ----------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("ETL-Vicson")

# ---------------- Cliente Supabase ----------------

def get_supabase_client(url: str, key: str) -> Client:
    return create_client(url, key)

def insert_batch(client: Client, table: str, rows: List[Dict[str, Any]], batch_size: int = 50) -> Tuple[int, int]:
    """Inserta en lotes. Retorna (inseridos, fallidos)."""
    inserted = 0
    failed = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        # Limpiar None que Supabase puede rechazar
        clean = []
        for row in batch:
            clean_row = {k: v for k, v in row.items() if v is not None and v != ""}
            if clean_row:
                clean.append(clean_row)

        if not clean:
            continue

        try:
            resp = client.table(table).insert(clean).execute()
            if resp.error:
                log.warning(f"Batch insert falló en {table}: {resp.error}")
                failed += len(batch)
            else:
                inserted += len(clean)
        except Exception as e:
            log.warning(f"Exception en batch insert {table}: {e}")
            failed += len(batch)
    return inserted, failed

def upsert_batch(client: Client, table: str, rows: List[Dict[str, Any]], on_conflict: str, batch_size: int = 50) -> Tuple[int, int]:
    """Upsert en lotes."""
    inserted = 0
    failed = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        clean = []
        for row in batch:
            clean_row = {k: v for k, v in row.items() if v is not None and v != ""}
            if clean_row:
                clean.append(clean_row)

        if not clean:
            continue

        try:
            resp = client.table(table).upsert(clean, on_conflict=on_conflict).execute()
            if resp.error:
                log.warning(f"Batch upsert falló en {table}: {resp.error}")
                failed += len(batch)
            else:
                inserted += len(clean)
        except Exception as e:
            log.warning(f"Exception en batch upsert {table}: {e}")
            failed += len(batch)
    return inserted, failed

# ---------------- Constantes de datos ----------------

# Datos maestros extraídos del análisis de los archivos
EMPRESA_DATA = {
    "nombre": "VICSON SA",
    "rif": "J-00000000-0",
    "telefono": "0212-0000000",
    "direccion": "Valencia, Carabobo",
    "email": "contacto@vicson.com",
    "estado": "activo",
}

SUCURSAL_VICSON_VALENCIA = {
    "empresa_nombre": "VICSON SA",
    "nombre": "VICSON VALENCIA",
    "codigo": "023",
    "direccion": "Valencia - Caraboba",
    "rif": "J-00038411-8",
    "telefono": "0424-4198920",
    "responsable": "PEDRO OJEDA",
    "estado": "activo",
}

CLIENTE_SELOGRA = {
    "nombre": "SELOGRA 111, C.A.",
    "rif": "J-00000000-0",
    "telefono": "0212-0000000",
    "email": "contacto@selogra.com",
    "contacto_nombre": "DAMIR DROVINIC",
    "contacto_cargo": "RECURSOS HUMANOS",
    "contacto_tel": "0424-4198920",
    "direccion": "",
    "estado": "activo",
}

SERVICIOS_DATA = [
    {"codigo": "300001", "nombre": "SERV. DESAYUNO PREST. COMEDOR (E)", "indicador": "E", "grupo": "Alimentación", "precio_vigente": 11076.80},
    {"codigo": "300002", "nombre": "SERV. DESAYUNO NO PREST. COMEDOR (G)", "indicador": "G", "grupo": "Alimentación", "precio_vigente": 11076.80},
    {"codigo": "300003", "nombre": "SERV. ALMUERZO PREST. COMEDOR (E)", "indicador": "E", "grupo": "Alimentación", "precio_vigente": 11076.80},
    {"codigo": "300004", "nombre": "SERV. ALMUERZO NO PREST. COMEDOR (G)", "indicador": "G", "grupo": "Alimentación", "precio_vigente": 11076.80},
    {"codigo": "300005", "nombre": "SERV. CENA PREST. COMEDOR (E)", "indicador": "E", "grupo": "Alimentación", "precio_vigente": 11076.80},
    {"codigo": "300006", "nombre": "SERV. CENA NO PREST. COMEDOR (G)", "indicador": "G", "grupo": "Alimentación", "precio_vigente": 11076.80},
    {"codigo": "300007", "nombre": "SOBRECENA", "indicador": "E", "grupo": "Alimentación", "precio_vigente": 11076.80},
    {"codigo": "300008", "nombre": "REFRIGERIOS", "grupo": "Reembolsables", "precio_vigente": 0},
    {"codigo": "300009", "nombre": "MERIENDA 1", "grupo": "Reembolsables", "precio_vigente": 0},
    {"codigo": "30000A", "nombre": "MERIENDA 2", "grupo": "Reembolsables", "precio_vigente": 0},
    {"codigo": "30000B", "nombre": "CAFETIN", "grupo": "Café", "precio_vigente": 0},
    {"codigo": "30000C", "nombre": "EFECTIVO", "grupo": "Alimentación", "precio_vigente": 0},
    {"codigo": "30000D", "nombre": "OTROS", "grupo": "Alimentación", "precio_vigente": 0},
]

PROVEEDORES_DATA = [
    {"nombre": "PROCESADORA DE CARNES FITCA, C.A.", "rif": "", "telefono": "", "email": "", "direccion": "", "estado": "activo"},
    {"nombre": "DISTRIBUIDORA DISPROPER, C.A.", "rif": "", "telefono": "", "email": "", "direccion": "", "estado": "activo"},
    {"nombre": "DISTRIBUIDORA YHOMMAT 2015, C.A.", "rif": "", "telefono": "", "email": "", "direccion": "", "estado": "activo"},
    {"nombre": "PESCADERIA LOS HERMANOS, C.A.", "rif": "", "telefono": "", "email": "", "direccion": "", "estado": "activo"},
]

PRODUCTOS_REFRI_DATA = [
    # Del archivo GUIAS — hoja REFRIGERIOS — 25 productos del 1-ro de mayo
    {"nombre": "JARRA DE JUGO", "codigo": "1001", "categoria": "JUGOS", "precio": 20, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "CACHITO", "codigo": "1002", "categoria": "PASAPALOS", "precio": 20, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "SUBAMARIBNOS GRANJEROS PAN CANILLA", "codigo": "1003", "categoria": "PASAPALOS", "precio": 3500, "unidad": "KG", "stock_minimo": 0},
    {"nombre": "SANDWINCH", "codigo": "1004", "categoria": "SANDWICHES", "precio": 2000, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "PASAPALOS/CROASANT", "codigo": "1005", "categoria": "PASAPALOS", "precio": 2100, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "EMPANADA/PASTELITOS", "codigo": "1006", "categoria": "PASAPALOS", "precio": 1000, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "DULCES PEQUEÑOS", "codigo": "1007", "categoria": "DULCES", "precio": 1200, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "TERMO DE LECHE", "codigo": "1008", "categoria": "CAFE", "precio": 4100, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "TERMO DE CAFÉ", "codigo": "1009", "categoria": "CAFE", "precio": 4100, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "SANDWCH ESPECIAL", "codigo": "1010", "categoria": "SANDWICHES", "precio": 2520, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "GATORADE", "codigo": "1011", "categoria": "REFRESCOS", "precio": 2520, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "PASTA SECA", "codigo": "1012", "categoria": "PASAPALOS", "precio": 12500, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "PASAPALOS HOJALDRES", "codigo": "1013", "categoria": "PASAPALOS", "precio": 2100, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "JARRO DE JUGO", "codigo": "1014", "categoria": "JUGOS", "precio": 5500, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "AGUA PEQUENA", "codigo": "1015", "categoria": "REFRESCOS", "precio": 840, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "MESA DE PASAPALOS", "codigo": "1016", "categoria": "PASAPALOS", "precio": 1500, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "MINI PASTELITOS VARIADOS", "codigo": "1017", "categoria": "DULCES", "precio": 2000, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "TARTALETAS, DULCES GRANDES", "codigo": "1018", "categoria": "DULCES", "precio": 1500, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "EREPAS RELLENAS", "codigo": "1019", "categoria": "PASAPALOS", "precio": 3100, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "YOGURT CON CEREAL", "codigo": "1020", "categoria": "DULCES", "precio": 1600, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "ENSALADAS DE FRUTAS", "codigo": "1021", "categoria": "DULCES", "precio": 1690, "unidad": "UND", "stock_minimo": 0},
    {"nombre": "TEQUEÑOS (100 UNIDADES)", "codigo": "1022", "categoria": "PASAPALOS", "precio": 1690, "unidad": "UND", "stock_minimo": 0},
]

# ---------------- Función principal de ETL ----------------

def run_etl(
    supabase_url: str,
    supabase_key: str,
    dry_run: bool = False,
    skip_maestros: bool = False,
    proceso: Optional[str] = None,
):
    client = get_supabase_client(supabase_url, supabase_key)

    total_inserted = 0
    total_failed = 0

    # ------------------------------------ MAESTROS ------------------------------------

    if not skip_maestros:
        log.info("=== Cargando datos maestros ===")

        # Empresas
        r = client.table("empresas").select("id").eq("nombre", EMPRESA_DATA["nombre"]).single().execute()
        if r.error and "PGRST116" not in str(r.error):
            log.warning(f"Error al buscar empresa: {r.error}")
        empresa_id = r.data.get("id") if r.data else None

        if not empresa_id:
            if dry_run:
                log.info("[DRY] insert empresa: VICSON SA")
            else:
                resp = client.table("empresas").insert(EMPRESA_DATA).select("id").single().execute()
                if resp.error:
                    log.warning(f"Error al insertar empresa: {resp.error}")
                else:
                    empresa_id = resp.data.id if resp.data else None
                    log.info(f"Empresa creada: {empresa_id}")

        # Sucursales
        r = client.table("sucursales").select("id").eq("codigo", SUCURSAL_VICSON_VALENCIA["codigo"]).single().execute()
        sucursal_id = r.data.id if r.data else None if r.data else None

        if not sucursal_id:
            if empresa_id:
                SUCURSAL_VICSON_VALENCIA["empresa_id"] = empresa_id
            if dry_run:
                log.info(f"[DRY] insert sucursal: {SUCURSAL_VICSON_VALENCIA['nombre']}")
            else:
                resp = client.table("sucursales").insert(SUCURSAL_VICSON_VALENCIA).select("id").single().execute()
                if resp.error:
                    log.warning(f"Error al insertar sucursal: {resp.error}")
                else:
                    sucursal_id = resp.data.id if resp.data else None
                    log.info(f"Sucursal creada: {sucursal_id}")

        # Clientes
        r = client.table("clientes").select("id").eq("nombre", CLIENTE_SELOGRA["nombre"]).single().execute()
        if not r.data:
            if empresa_id:
                CLIENTE_SELOGRA["empresa_id"] = empresa_id
            if dry_run:
                log.info(f"[DRY] insert cliente: {CLIENTE_SELOGRA['nombre']}")
            else:
                resp = client.table("clientes").insert(CLIENTE_SELOGRA).select("id").single().execute()
                if resp.error:
                    log.warning(f"Error al insertar cliente: {resp.error}")
                else:
                    log.info(f"Cliente creado: {resp.data.id if resp.data else None}")

        # Servicios
        if not dry_run:
            for s in SERVICIOS_DATA:
                r = client.table("servicios").select("id").eq("codigo", s["codigo"]).single().execute()
                if not r.data:
                    resp = client.table("servicios").insert(s).select("id").execute()
                    if not resp.error:
                        log.info(f"Servicio creado: {s['codigo']} — {s['nombre']}")
        else:
            log.info(f"[DRY] {len(SERVICIOS_DATA)} servicios pendientes")

        # Proveedores
        if not dry_run:
            for p in PROVEEDORES_DATA:
                r = client.table("proveedores").select("id").eq("nombre", p["nombre"]).single().execute()
                if not r.data:
                    resp = client.table("proveedores").insert(p).select("id").execute()
                    if not resp.error:
                        log.info(f"Proveedor creado: {p['nombre']}")
        else:
            log.info(f"[DRY] {len(PROVEEDORES_DATA)} proveedores pendientes")

        # Productos de refrigerio
        if not dry_run:
            for p in PRODUCTOS_REFRI_DATA:
                r = client.table("productos_refri").select("id").eq("codigo", p["codigo"]).single().execute()
                if not r.data:
                    resp = client.table("productos_refri").insert(p).select("id").execute()
                    if not resp.error:
                        log.info(f"Producto refri creado: {p['nombre']}")
        else:
            log.info(f"[DRY] {len(PRODUCTOS_REFRI_DATA)} productos refri pendientes")

        if not empresa_id or not sucursal_id:
            log.error("❌  No se pudieron crear empresa y sucursal. Abortando.")
            sys.exit(1)

    # ------------------------------------ CUP DIARIO ------------------------------------

    if proceso is None or proceso == "cup":
        log.info("=== Procesando CUP MAYO 2017 VICSON VALENCIA.xls ===")

        cup_path = os.path.join(BASE_DIR, FILES["cup"])
        if not os.path.exists(cup_path):
            log.warning(f"Archivo no encontrado: {cup_path}")
        else:
            try:
                # Leer con xlrd para .xls
                wb = xlrd.open_workbook(cup_path)
                hojas_dia = [f for f in wb.sheet_names() if f not in ("Resumen",)]

                for sname in hojas_dia:
                    df = pd.read_excel(cup_path, sheet_name=sname, header=None)

                    # Buscar fila con fecha y día de la semana
                    fecha_val = None
                    dia_val = None
                    for i in range(min(8, df.shape[0])):
                        row = df.iloc[i]
                        for v in row:
                            if isinstance(v, (datetime, date)):
                                fecha_val = v
                            if isinstance(v, str):
                                v_clean = v.strip().upper()
                                if v_clean in ("LUNES", "MARTES", "MIERCOLES", "MIERCOL", "JUEVES", "VIERNES", "SABADO", "DOMINGO", "SÁBADO"):
                                    dia_val = v_clean

                    if fecha_val is None:
                        continue

                    fecha_str = datetime(fecha_val.year, fecha_val.month, fecha_val.day).isoformat()

                    # Extraer servicios y precios (fila 13 y 15)
                    row13 = df.iloc[12] if df.shape[0] > 12 else None
                    row15 = df.iloc[14] if df.shape[0] > 14 else None

                    if row13 is None:
                        continue

                    precio_row = row13.values if hasattr(row13, "values") else list(row13)
                    valor_row = row15.values if hasattr(row15, "values") else list(row15) if row15 is not None else [None]*len(precio_row)

                    # Mapear columnas: índices conocidos
                    # Fila 13 cabecera: Sobrecena(3), Desayuno(4), Almuerzo(5), Cena(6), Refrigerios(7), Merienda1(8), Merienda2(9), Efectivo(10), Cafetín(11), Otros(12)
                    # Fila 15 valores: mismos índices

                    def safe_float(v):
                        try:
                            f = float(v)
                            if np.isnan(f) or np.isinf(f):
                                return None
                            return f
                        except (ValueError, TypeError):
                            return None

                    sobrecena_p = safe_float(precio_row[3]) if len(precio_row) > 3 else None
                    desayuno_p = safe_float(precio_row[4]) if len(precio_row) > 4 else None
                    almuerzo_p = safe_float(precio_row[5]) if len(precio_row) > 5 else None
                    cena_p = safe_float(precio_row[6]) if len(precio_row) > 6 else None
                    refrigerios_p = safe_float(precio_row[7]) if len(precio_row) > 7 else None
                    merienda1_p = safe_float(precio_row[8]) if len(precio_row) > 8 else None
                    merienda2_p = safe_float(precio_row[9]) if len(precio_row) > 9 else None
                    efectivo_p = safe_float(precio_row[10]) if len(precio_row) > 10 else None
                    cafetin_p = safe_float(precio_row[11]) if len(precio_row) > 11 else None
                    otros_p = safe_float(precio_row[12]) if len(precio_row) > 12 else None

                    # Valores reales
                    sobrecena_v = safe_float(valor_row[3]) if len(valor_row) > 3 else None
                    desayuno_v = safe_float(valor_row[4]) if len(valor_row) > 4 else None
                    almuerzo_v = safe_float(valor_row[5]) if len(valor_row) > 5 else None
                    cena_v = safe_float(valor_row[6]) if len(valor_row) > 6 else None
                    refrigerios_v = safe_float(valor_row[7]) if len(valor_row) > 7 else None
                    merienda1_v = safe_float(valor_row[8]) if len(valor_row) > 8 else None
                    merienda2_v = safe_float(valor_row[9]) if len(valor_row) > 9 else None
                    efectivo_v = safe_float(valor_row[10]) if len(valor_row) > 10 else None
                    cafetin_v = safe_float(valor_row[11]) if len(valor_row) > 11 else None
                    otros_v = safe_float(valor_row[12]) if len(valor_row) > 12 else None

                    # Total venta = almuerzo + cena (desde Fichas) o del Resumen
                    # Para simplicidad: total_venta = almuerzo_v + cena_v si están disponibles
                    # Sino se lee de la hoja Resumen o se calcula
                    total_venta = (almuerzo_v or 0) + (cena_v or 0)

                    # Costos — del Resumen
                    costo_insumos = None
                    desechables = None
                    costo_cup = None
                    costo_personal = None

                    # Intentar leer del Resumen la fila correspondiente a este día
                    try:
                        df_resumen = pd.read_excel(cup_path, sheet_name="Resumen", header=None)
                        # El Resumen tiene días en columna 0 (1-31), fecha en columna 11
                        for i in range(df_resumen.shape[0]):
                            row = df_resumen.iloc[i]
                            if len(row) > 11:
                                cell_val = row[11]
                                if isinstance(cell_val, (datetime, date)):
                                    d = datetime(cell_val.year, cell_val.month, cell_val.day)
                                    if d.date() == fecha_val.date() or d.isoformat() == fecha_str:
                                        # columnas: 13=Alimentos, 17=Desechables, 20=TotalDia, 24=CostoDiarioCup
                                        if len(row) > 13:
                                            v = row[13]
                                            costo_insumos = safe_float(v)
                                        if len(row) > 17:
                                            v = row[17]
                                            desechables = safe_float(v)
                                        if len(row) > 20:
                                            v = row[20]
                                            # Total Dia no es costo
                                        if len(row) > 24:
                                            v = row[24]
                                            costo_cup = safe_float(v)
                                        break
                    except Exception as e:
                        log.debug(f"No se pudo leer costo desde Resumen para {fecha_str}: {e}")

                    cup_data = {
                        "contrato_id": None,  # Se actualizará después
                        "fecha": fecha_str,
                        "dia_semana": dia_val,
                        "sobrecena": sobrecena_v,
                        "desayuno": desayuno_v,
                        "almuerzo": almuerzo_v,
                        "cena": cena_v,
                        "refrigerios": refrigerios_v,
                        "merienda_1": merienda1_v,
                        "merienda_2": merienda2_v,
                        "efectivo": efectivo_v,
                        "cafetin": cafetin_v,
                        "otros": otros_v,
                        "total_venta": total_venta if total_venta > 0 else None,
                        "costo_insumos": costo_insumos,
                        "desechables": desechables,
                        "costo_cup": costo_cup,
                        "costo_personal": costo_personal,
                    }

                    if dry_run:
                        log.info(f"[DRY] cup_diario: {fecha_str} — total {total_venta}")
                    else:
                        resp = client.table("cup_diario").upsert([cup_data], on_conflict="(contrato_id, fecha)").execute()
                        if resp.error:
                            log.warning(f"Error cup_diario {fecha_str}: {resp.error}")
                        else:
                            total_inserted += 1

            except Exception as e:
                log.error(f"Error procesando CUP: {e}")

    # ------------------------------------ GUIAS DE FACTURACION ------------------------------------

    for idx, guia_file in enumerate([FILES["guias_1"], FILES["guias_2"]]):
        log.info(f"=== Procesando GUIAS — Semana {idx+1} ===")

        guia_path = os.path.join(BASE_DIR, guia_file)
        if not os.path.exists(guia_path):
            log.warning(f"Archivo no encontrado: {guia_path}")
            continue

        try:
            # Leer fichas
            df_fichas = pd.read_excel(guia_path, sheet_name="FICHAS ", header=None)
            df_guia_header = pd.read_excel(guia_path, sheet_name="GUIA 1-FACT4589 " if idx == 0 else "GUIA 2", header=None)

            if df_fichas.shape[0] < 5:
                continue

            # Extraer header de la guía
            empresa_nombre = ""
            cliente_nombre = ""
            sucursal_nombre = ""
            rif = ""
            contacto_nombre = ""
            contacto_cargo = ""
            contacto_tel = ""
            no_oc = ""
            fecha_guia = None

            for i in range(df_guia_header.shape[0]):
                row = df_guia_header.iloc[i]
                for v in row:
                    if isinstance(v, str):
                        vs = v.strip()
                        if vs == "Empresa:":
                            empresa_nombre = str(df_guia_header.iloc[i+1, 3] or "").strip()
                        elif vs == "Razón Social del Cliente:":
                            cliente_nombre = str(df_guia_header.iloc[i+1, 11] or "").strip()
                        elif vs == "Sucursal:":
                            sucursal_nombre = str(df_guia_header.iloc[i+1, 26] or "").strip()
                        elif vs == "R.I.F. Nº:":
                            rif = str(df_guia_header.iloc[i+1, 31] or "").strip()
                        elif vs == "Persona contacto:":
                            contacto_nombre = str(df_guia_header.iloc[i+1, 3] or "").strip()
                        elif vs == "Cargo:":
                            contacto_cargo = str(df_guia_header.iloc[i+1, 11] or "").strip()
                        elif vs == "Teléfono:":
                            contacto_tel = str(df_guia_header.iloc[i+1, 20] or "").strip()
                        elif vs == "Nº O/C:":
                            no_oc = str(df_guia_header.iloc[i+1, 26] or "").strip()
                        elif vs == "Formato: Guía de Facturación":
                            # fecha en columna 32
                            cell = df_guia_header.iloc[i+1, 32] if df_guia_header.shape[1] > 32 else None
                            if isinstance(cell, (datetime, date)):
                                fecha_guia = cell

            # Leer cliente de DB
            cliente_res = client.table("clientes").select("id").eq("nombre", cliente_nombre or "SELOGRA 111, C.A.").single().execute()
            cliente_id = cliente_res.data.id if cliente_res.data else None if cliente_res.data else None
            if not cliente_id:
                log.warning(f"Cliente no encontrado para guía: {cliente_nombre}")
                cliente_id = None

            # Leer sucursal de DB
            sucursal_res = client.table("sucursales").select("id").eq("codigo", "023").single().execute()
            sucursal_id = sucursal_res.data.id if sucursal_res.data else None if sucursal_res.data else None

            # Iterar las fichas
            for i in range(4, df_fichas.shape[0]):
                row = df_fichas.iloc[i]
                if len(row) < 9:
                    continue
                fecha_cell = row[0]
                if not isinstance(fecha_cell, (datetime, date)):
                    continue

                fecha_str = datetime(fecha_cell.year, fecha_cell.month, fecha_cell.day).isoformat()
                dia = str(row[1]).strip() if pd.notna(row[1]) else ""
                n_alm = float(row[2]) if pd.notna(row[2]) else 0
                precio_alm = float(row[3]) if pd.notna(row[3]) else 0
                sub_alm = float(row[4]) if pd.notna(row[4]) else 0
                n_cena = float(row[5]) if pd.notna(row[5]) else 0
                precio_cena = float(row[6]) if pd.notna(row[6]) else 0
                sub_cena = float(row[7]) if pd.notna(row[7]) else 0
                total = float(row[8]) if pd.notna(row[8]) else 0

                if sub_alm == 0 and sub_cena == 0:
                    continue

                # Crear o actualizar cup_diario si no existe
                if not dry_run:
                    cup_check = client.table("cup_diario").select("id").eq("fecha", fecha_str).single().execute()
                    cup_id = cup_check.data.id if cup_check.data else None if cup_check.data else None

                    if not cup_id:
                        cup_data = {
                            "contrato_id": None,
                            "fecha": fecha_str,
                            "dia_semana": dia.upper() if dia else "",
                            "almuerzo": sub_alm,
                            "cena": sub_cena,
                            "total_venta": total,
                        }
                        cup_resp = client.table("cup_diario").insert(cup_data).select("id").single().execute()
                        if not cup_resp.error:
                            cup_id = cup_resp.data.id if resp.data else None

                    if cup_id:
                        # Venta comensal
                        vc_data = {
                            "cup_id": cup_id,
                            "fecha": fecha_str,
                            "dia": dia.upper() if dia else "",
                            "n_almuerzo": int(n_alm) if n_alm else None,
                            "precio_alm": precio_alm if precio_alm else None,
                            "subtotal_alm": sub_alm if sub_alm else None,
                            "n_cena": int(n_cena) if n_cena else None,
                            "precio_cena": precio_cena if precio_cena else None,
                            "subtotal_cena": sub_cena if sub_cena else None,
                            "total_general": total if total else None,
                        }
                        vc_resp = client.table("venta_comensal").insert(vc_data).execute()
                        if vc_resp.error:
                            log.warning(f"vc {fecha_str}: {vc_resp.error}")

                # Leer detalles de la guía asociada
                # (Por simplicidad, insertamos una guía por semana en lugar de por día)

            # Insertar guía de factura por semana
            if not dry_run and fecha_guia:
                fecha_str = fecha_guia.isoformat().split("T")[0]

                guia_data = {
                    "sucursal_id": sucursal_id,
                    "cliente_id": cliente_id,
                    "numero_guia": f"FF-{idx+1:02d}-01",
                    "fecha": fecha_str,
                    "periodo_ini": fecha_str,
                    "periodo_fin": fecha_str,
                    "no_oc": no_oc,
                    "estado": "facturada",
                }
                guia_resp = client.table("guias_fact").insert(guia_data).select("id").single().execute()
                if not guia_resp.error and guia_resp.data:
                    guia_id = guia_resp.data.id
                    log.info(f"Guía creada: {guia_resp.data.numero_guia} ({guia_id})")

                    # Detalles: servicios 300001-300006
                    servicios = [
                        {"codigo": "300001", "cantidad": 0, "precio": 11076.80},
                        {"codigo": "300003", "cantidad": 0, "precio": 11076.80},
                        {"codigo": "300005", "cantidad": 0, "precio": 11076.80},
                    ]
                    for sv in servicios:
                        sv_res = client.table("servicios").select("id").eq("codigo", sv["codigo"]).single().execute()
                        if sv_res.data:
                            det_data = {
                                "guia_id": guia_id,
                                "servicio_id": sv_res.data.id,
                                "cantidad": sv["cantidad"],
                                "precio_unit": sv["precio"],
                                "importe": 0,
                                "orden": servicios.index(sv),
                            }
                            det_resp = client.table("guias_detalle").insert(det_data).execute()
                            if det_resp.error:
                                log.warning(f"Detalle guía {guia_id}: {det_resp.error}")

        except Exception as e:
            log.error(f"Error procesando guías {idx+1}: {e}")

    # ------------------------------------ CFC + RG + PxF ------------------------------------

    if proceso is None or proceso == "cfc":
        log.info("=== Procesando CFC+CJC+RG+PXF 2017 vicson valencia.xlsx ===")

        cfc_path = os.path.join(BASE_DIR, FILES["cfc_rg_px"])
        if not os.path.exists(cfc_path):
            log.warning(f"Archivo no encontrado: {cfc_path}")
        else:
            try:
                # CFC
                df_cfc = pd.read_excel(cfc_path, sheet_name="CFC1", header=None)

                if df_cfc.shape[0] > 8:
                    # Cabecera en fila 8 (índice 7)
                    header_row = df_cfc.iloc[7]
                    # Encabezados: Nº(2), Fecha(3), Proveedor(4), Nº Doc(5), NotaRecepción(6), Alimentos(7), Desechables(8), Reembolsables(9), Varios(10), SubTotal(11), Descuentos(12), MontoIVA(13), TotalIVA(14), CuentaContable(15)

                    cfc_rows = []
                    for i in range(9, df_cfc.shape[0]):
                        row = df_cfc.iloc[i]
                        if len(row) < 4:
                            continue
                        n_doc = int(row[2]) if pd.notna(row[2]) else 0
                        if n_doc == 0:
                            continue

                        fecha_cell = row[3]
                        fecha_doc = None
                        if isinstance(fecha_cell, (datetime, date)):
                            fecha_doc = datetime(fecha_cell.year, fecha_cell.month, fecha_cell.day).isoformat()

                        proveedor_nombre = str(row[4] or "").strip() if pd.notna(row[4]) else ""

                        doc_n = str(row[5] or "").strip() if pd.notna(row[5]) else ""

                        alimentos = float(row[7]) if pd.notna(row[7]) and row[7] != 0 else 0
                        desechables = float(row[8]) if pd.notna(row[8]) and row[8] != 0 else 0
                        reembolsables = float(row[9]) if pd.notna(row[9]) and row[9] != 0 else 0
                        varios = float(row[10]) if pd.notna(row[10]) and row[10] != 0 else 0
                        subtotal = float(row[11]) if pd.notna(row[11]) and row[11] != 0 else 0
                        descuentos = float(row[12]) if pd.notna(row[12]) and row[12] != 0 else 0
                        monto_iva = float(row[13]) if pd.notna(row[13]) and row[13] != 0 else 0
                        total_iva = float(row[14]) if pd.notna(row[14]) and row[14] != 0 else 0

                        cuenta = str(row[15] or "").strip() if pd.notna(row[15]) else ""

                        # Buscar proveedor
                        prov_id = None
                        if proveedor_nombre:
                            prov_res = client.table("proveedores").select("id").eq("nombre", proveedor_nombre).single().execute()
                            if prov_res.data:
                                prov_id = prov_res.data.id
                            else:
                                # Insertar nuevo proveedor
                                prov_data = {
                                    "nombre": proveedor_nombre,
                                    "rif": "",
                                    "telefono": "",
                                    "email": "",
                                    "direccion": "",
                                    "estado": "activo",
                                }
                                prov_resp = client.table("proveedores").insert(prov_data).select("id").single().execute()
                                if not prov_resp.error:
                                    prov_id = prov_resp.data.id
                                    log.info(f"Proveedor creado desde CFC: {proveedor_nombre}")

                        if prov_id and fecha_doc:
                            cfc_rows.append({
                                "sucursal_id": sucursal_id,
                                "cfc_n": idx,
                                "fecha_doc": fecha_doc,
                                "proveedor_id": prov_id,
                                "documento_n": doc_n,
                                "nota_recepcion": "",
                                "alimentos": alimentos if alimentos else None,
                                "desechables": desechables if desechables else None,
                                "reembolsables": reembolsables if reembolsables else None,
                                "varios": varios if varios else None,
                                "subtotal": subtotal if subtotal else None,
                                "descuentos": descuentos if descuentos else None,
                                "monto_iva": monto_iva if monto_iva else None,
                                "total_iva": total_iva if total_iva else None,
                                "cuenta_contable": cuenta if cuenta else None,
                            })

                    if cfc_rows:
                        if dry_run:
                            log.info(f"[DRY] {len(cfc_rows)} facturas CFC a insertar")
                        else:
                            inserted, failed = insert_batch(client, "cfc", cfc_rows)
                            total_inserted += inserted
                            total_failed += failed
                            log.info(f"CFC: {inserted} insertados, {failed} fallidos")

                # RG
                for rg_idx in range(1, 9):
                    sheet_name = f"RG{rg_idx}"
                    try:
                        df_rg = pd.read_excel(cfc_path, sheet_name=sheet_name, header=None)
                    except:
                        continue

                    if df_rg.shape[0] < 6:
                        continue

                    rg_rows = []
                    for i in range(6, df_rg.shape[0]):
                        row = df_rg.iloc[i]
                        if len(row) < 4:
                            continue
                        n_doc = int(row[2]) if pd.notna(row[2]) else 0
                        if n_doc == 0:
                            continue

                        fecha_cell = row[3]
                        fecha_doc = None
                        if isinstance(fecha_cell, (datetime, date)):
                            fecha_doc = datetime(fecha_cell.year, fecha_cell.month, fecha_cell.day).isoformat()

                        proveedor_nombre = str(row[4] or "").strip() if pd.notna(row[4]) else ""
                        doc_n = str(row[5] or "").strip() if pd.notna(row[5]) else ""

                        alimentos = float(row[6]) if pd.notna(row[6]) and row[6] != 0 else 0
                        desechables = float(row[7]) if pd.notna(row[7]) and row[7] != 0 else 0
                        reembolsables = float(row[8]) if pd.notna(row[8]) and row[8] != 0 else 0
                        varios = float(row[9]) if pd.notna(row[9]) and row[9] != 0 else 0
                        subtotal = float(row[10]) if pd.notna(row[10]) and row[10] != 0 else 0
                        descuentos = float(row[11]) if pd.notna(row[11]) and row[11] != 0 else 0
                        monto_iva = float(row[12]) if pd.notna(row[12]) and row[12] != 0 else 0
                        total_iva = float(row[13]) if pd.notna(row[13]) and row[13] != 0 else 0
                        cuenta = str(row[14] or "").strip() if pd.notna(row[14]) else ""

                        if proveedor_nombre:
                            prov_res = client.table("proveedores").select("id").eq("nombre", proveedor_nombre).single().execute()
                            if prov_res.data:
                                prov_id = prov_res.data.id
                            else:
                                prov_data = {"nombre": proveedor_nombre, "rif": "", "telefono": "", "email": "", "direccion": "", "estado": "activo"}
                                prov_resp = client.table("proveedores").insert(prov_data).select("id").single().execute()
                                if not prov_resp.error:
                                    prov_id = prov_resp.data.id

                            if prov_id and fecha_doc:
                                rg_rows.append({
                                    "sucursal_id": sucursal_id,
                                    "rg_n": rg_idx,
                                    "fecha_doc": fecha_doc,
                                    "proveedor_id": prov_id,
                                    "documento_n": doc_n if doc_n else None,
                                    "alimentos": alimentos if alimentos else None,
                                    "desechables": desechables if desechables else None,
                                    "reembolsables": reembolsables if reembolsables else None,
                                    "varios": varios if varios else None,
                                    "subtotal": subtotal if subtotal else None,
                                    "descuentos": descuentos if descuentos else None,
                                    "monto_iva": monto_iva if monto_iva else None,
                                    "total_iva": total_iva if total_iva else None,
                                    "cuenta_contable": cuenta if cuenta else None,
                                })

                    if rg_rows:
                        if dry_run:
                            log.info(f"[DRY] {len(rg_rows)} gastos RG{rg_idx} a insertar")
                        else:
                            inserted, failed = insert_batch(client, "rg", rg_rows)
                            total_inserted += inserted
                            total_failed += failed

                # PxF
                try:
                    df_px = pd.read_excel(cfc_path, sheet_name="PxF", header=None)
                except:
                    df_px = None

                if df_px is not None and df_px.shape[0] > 5:
                    px_rows = []
                    for i in range(6, df_px.shape[0]):
                        row = df_px.iloc[i]
                        if len(row) < 4:
                            continue
                        doc_n = str(row[0] or "").strip() if pd.notna(row[0]) else ""
                        if not doc_n:
                            continue

                        fecha_cell = row[1]
                        fecha_doc = None
                        if isinstance(fecha_cell, (datetime, date)):
                            fecha_doc = datetime(fecha_cell.year, fecha_cell.month, fecha_cell.day).isoformat()

                        proveedor_nombre = str(row[2] or "").strip() if pd.notna(row[2]) else ""
                        monto = float(row[3]) if pd.notna(row[3]) and row[3] != 0 else 0
                        cuenta = str(row[4] or "").strip() if pd.notna(row[4]) else ""

                        if proveedor_nombre:
                            prov_res = client.table("proveedores").select("id").eq("nombre", proveedor_nombre).single().execute()
                            if prov_res.data:
                                prov_id = prov_res.data.id
                            else:
                                prov_data = {"nombre": proveedor_nombre, "rif": "", "telefono": "", "email": "", "direccion": "", "estado": "activo"}
                                prov_resp = client.table("proveedores").insert(prov_data).select("id").single().execute()
                                if not prov_resp.error:
                                    prov_id = prov_resp.data.id

                            if prov_id and fecha_doc:
                                px_rows.append({
                                    "sucursal_id": sucursal_id,
                                    "numero_doc": doc_n,
                                    "fecha": fecha_doc,
                                    "proveedor_id": prov_id,
                                    "monto": monto if monto else None,
                                    "cuenta": cuenta if cuenta else None,
                                })

                    if px_rows:
                        if dry_run:
                            log.info(f"[DRY] {len(px_rows)} próximos pagos PxF")
                        else:
                            inserted, failed = insert_batch(client, "px", px_rows)
                            total_inserted += inserted
                            total_failed += failed

            except Exception as e:
                log.error(f"Error procesando CFC+RG+PxF: {e}")

    # ------------------------------------ RECOP (DIC) ------------------------------------

    if proceso is None or proceso == "recop":
        log.info("=== Procesando 023 - RECOP 2017 PRECIERRE MAYO.xlsx ===")

        recop_path = os.path.join(BASE_DIR, FILES["recop"])
        if not os.path.exists(recop_path):
            log.warning(f"Archivo no encontrado: {recop_path}")
        else:
            try:
                df_dic = pd.read_excel(recop_path, sheet_name="DIC", header=None)

                # Buscar la fila donde se encuentra "Periodo:" -> columna 2
                periodo_val = None
                for i in range(df_dic.shape[0]):
                    row = df_dic.iloc[i]
                    if len(row) > 2:
                        v = row[2]
                        if isinstance(v, (datetime, date)):
                            periodo_val = datetime(v.year, v.month, v.day).isoformat()
                            break

                if not periodo_val:
                    log.warning("No se encontró periodo en DIC")
                else:
                    dic_data = {
                        "sucursal_id": sucursal_id,
                        "periodo": periodo_val,
                        "responsable": "PEDRO OJEDA",
                        "meta_ventas": None,
                        "resultado": None,
                        "ventas_bs": 15805475.60,
                        "costo_insumos": 9541853.20,
                        "costo_personal": None,
                        "desechables": 241897.97,
                        "costo_cup_pct": 1.6154821726412032,
                        "facturacion": None,
                        "ventas_efectivo": None,
                        "total_cfc": 12500716.44,
                        "total_rg": 0,
                        "total_px": 0,
                        "total_trasp": 0,
                        "inventario_ini": None,
                        "inventario_final": None,
                        "ajustes": None,
                    }

                    if dry_run:
                        log.info(f"[DRY] dic: {dic_data['periodo']} — ventas {dic_data['ventas_bs']}")
                    else:
                        resp = client.table("dic").upsert([dic_data], on_conflict="(sucursal_id, periodo)").execute()
                        if resp.error:
                            log.warning(f"Error DIC: {resp.error}")
                        else:
                            log.info(f"DIC creado: {dic_data['periodo']}")

                        dic_id = dic_data.get("id") or None
                        # Poner el dic_id explícito
                        # En este punto el upsert devuelve el ID
                        # Si no, hacer select

            except Exception as e:
                log.error(f"Error procesando RECOP: {e}")

    # ------------------------------------ INVENTARIO ------------------------------------

    if proceso is None or proceso == "inventario":
        log.info("=== Procesando INVENTARIO 19 PPRE-CIERRE.xlsx ===")

        inv_path = os.path.join(BASE_DIR, FILES["inventario"])
        if not os.path.exists(inv_path):
            log.warning(f"Archivo no encontrado: {inv_path}")
        else:
            try:
                df_inv = pd.read_excel(inv_path, sheet_name="INVENTARIO ", header=None)

                inventario_rows = []
                current_categoria = ""
                current_subcategoria = ""

                for i in range(5, df_inv.shape[0]):
                    row = df_inv.iloc[i]
                    if len(row) < 3:
                        continue

                    # Detectar categoría (fila que empieza con número + espacio + texto, tipo "01      AVES Y HUEVOS")
                    if isinstance(row[1], str) and re.match(r"^\d{2}\s{2,}", row[1]):
                        current_categoria = row[1].strip()
                        current_subcategoria = ""
                        continue

                    # Detectar subcategoría (fila que empieza con número + espacio + texto, tipo "001     POLLO")
                    if isinstance(row[1], str) and re.match(r"^\d{3}\s{2,}", row[1]):
                        current_subcategoria = row[1].strip()
                        continue

                    # Fila de producto: pri_columna es número flotante, segunda es código (100XXX), tercera es nombre
                    first = row[0]
                    if not isinstance(first, (int, float)):
                        continue

                    codigo = row[1]
                    nombre = row[2]

                    # Saltar si es "Sub-Total" o "Total"
                    if isinstance(nombre, str) and ("Sub-Total" in nombre or "Total" in nombre):
                        continue

                    if not isinstance(codigo, (int, float, str)):
                        continue

                    codigo_str = str(int(codigo)) if isinstance(codigo, float) else (str(codigo) if isinstance(codigo, str) else "")

                    if not codigo_str.startswith("100") and not codigo_str.isdigit():
                        continue

                    unidad = str(row[3] or "").strip() if pd.notna(row[3]) else ""
                    costo_unit = float(row[4]) if pd.notna(row[4]) and row[4] != 0 else 0

                    if costo_unit == 0:
                        continue

                    nombre_str = str(nombre).strip() if isinstance(nombre, str) else ""

                    if not nombre_str:
                        continue

                    inventario_rows.append({
                        "sucursal_id": sucursal_id,
                        "nombre": nombre_str,
                        "codigo": codigo_str,
                        "categoria": current_categoria,
                        "subcategoria": current_subcategoria,
                        "unidad": unidad if unidad else None,
                        "costo_unit": costo_unit,
                    })

                if inventario_rows:
                    if dry_run:
                        log.info(f"[DRY] {len(inventario_rows)} productos de inventario")
                    else:
                        inserted, failed = insert_batch(client, "inventario", inventario_rows, batch_size=100)
                        total_inserted += inserted
                        total_failed += failed
                        log.info(f"INVENTARIO: {inserted} insertados, {failed} fallidos")

            except Exception as e:
                log.error(f"Error procesando INVENTARIO: {e}")

    # ------------------------------------ TRASPASOS (PENDING) ------------------------------------

    if proceso is None or proceso == "traspasos":
        log.info("=== CONTROL DE TRASPASOS — ARCHIVO ENCPROTADO ===")
        log.info("Este archivo sigue encriptado. Se omite hasta tener la contraseña.")
        log.info("Tabla traspasos lista para recibir datos cuando se desbloquee.")

    # ------------------------------------ RESUMEN ------------------------------------

    log.info(f"\n=== RESUMEN ETL ===")
    log.info(f"Total insertados: {total_inserted}")
    log.info(f"Total fallidos: {total_failed}")
    if dry_run:
        log.info("Ejecución en DRY RUN — ningún dato fue insertado.")
    else:
        log.info("Migración completada.")


# ---------------- CLI ----------------

def main():
    parser = argparse.ArgumentParser(description="ETL VICSON → Supabase")
    parser.add_argument("--host", default=None, help="URL de Supabase")
    parser.add_argument("--key", default=None, help="Anon key de Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin insertar")
    parser.add_argument("--skip-maestros", action="store_true", help="No insertar datos maestros")
    parser.add_argument("--proceso", default=None, help="Proceso específico: cup, guias, cfc, recop, inventario, traspasos, todos")
    parser.add_argument("--verbose", action="store_true", help="Log más detallado")

    args = parser.parse_args()

    if args.verbose:
        log.setLevel(logging.DEBUG)

    supabase_url = args.host or os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    supabase_key = args.key or os.environ.get("SUPABASE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        print("❌  Falten credenciales de Supabase.")
        print("    Proporciona --host y --key, o define SUPABASE_URL y SUPABASE_KEY / VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY")
        sys.exit(1)

    log.info(f"Conectando a Supabase: {supabase_url}")
    run_etl(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        dry_run=args.dry_run,
        skip_maestros=args.skip_maestros,
        proceso=args.proceso,
    )


if __name__ == "__main__":
    main()
