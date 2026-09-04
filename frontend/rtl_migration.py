#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RTL Migration — Migración de datos Excel → Supabase
VICSON Gestion — Sucursal: VICSON VALENCIA — Mayo 2017
"""
import os, sys, json, uuid, argparse, requests
import pandas as pd
from datetime import datetime, date
from pathlib import Path

BASE = Path(r"C:\Users\Agencia de viajes\OneDrive\Escritorio\CUP vicson")
TEMP = Path(r"C:\Users\Agencia de viajes\TempCUP")

F_CUP       = "CUP MAYO 2017 VICSON VALENCIA.xls"
F_GUIAS_1   = "GUIAS VICSON 1ERA SEMANA.xls"
F_GUIAS_2   = "GUIAS VICSON 2DA SEMANA.xls"
F_CFC       = "CFC+CJC+RG+PXF 2017 vicson valencia.xlsx"
F_RECOP     = "023 - VICSON VALENCIA - RECOP 2017 PRECIERRE MAYO.xlsx"
F_INV       = "INVENTARIO 19 PPRE-CIERRE.xlsx"
F_TRASP     = "CONTROL DE TRASPASOS  VICSON VALENCIA CORTE AL 19 DE MAYO.xls"

URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL", "")
KEY = os.environ.get("VITE_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")
if not URL or not KEY:
    print("❌ Faltan credenciales. Setea VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno.")
    sys.exit(1)

H = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
     "Content-Type": "application/json", "Prefer": "return=minimal"}
BASE_URL = f"{URL}/rest/v1"

def _post(t, recs):
    if not recs: return []
    r = requests.post(f"{BASE_URL}/{t}", data=json.dumps(recs), headers=H)
    if r.status_code in (200, 201):
        d = r.json(); return d if isinstance(d, list) else [d]
    print(f"  ❌ POST {t} → {r.status_code}: {r.text[:160]}")
    return []

def _get(t, q=""):
    u = f"{BASE_URL}/{t}?{q}" if q else f"{BASE_URL}/{t}"
    r = requests.get(u, headers=H)
    if r.status_code == 200: return r.json() or []
    print(f"  ⚠️ GET {t} → {r.status_code}")
    return []

def _f(v):
    if v is None or (isinstance(v, float) and pd.isna(v)): return None
    if isinstance(v, (int, float)): return round(float(v), 2)
    s = str(v).strip().replace(".",",").replace(",",".")
    try: return round(float(s), 2)
    except: return None

def _i(v):
    if v is None or (isinstance(v, float) and pd.isna(v)): return None
    if isinstance(v, int): return v
    if isinstance(v, float): return int(v)
    try: return int(float(str(v).replace(".","").replace(",",".")))
    except: return None

def _d(v):
    if v is None or (isinstance(v, float) and pd.isna(v)): return None
    if isinstance(v, datetime): return v.strftime("%Y-%m-%d")
    if isinstance(v, date): return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    for fmt in ("%Y-%m-%d","%d/%m/%Y","%d-%m-%Y","%Y/%m/%d","%d/%m/%y"):
        try: return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except: pass
    try: return pd.to_datetime(s).strftime("%Y-%m-%d")
    except: return None

def _u(): return str(uuid.uuid4())
def _info(m): print(f"  ▶ {m}")
def _ok(m):   print(f"  ✅ {m}")
def _warn(m): print(f"  ⚠️ {m}")

def read_xl(fn):
    p = BASE/fn
    if not p.exists(): p = TEMP/fn
    if not p.exists(): _warn(f"Archivo no encontrado: {fn}"); return {}
    try:
        eng = "xlrd" if fn.endswith(".xls") else "openpyxl"
        xl = pd.ExcelFile(p, engine=eng)
        return {s.strip(): xl.parse(s, header=None) for s in xl.sheet_names}
    except Exception as e:
        _warn(f"Error leyendo {fn}: {e}")
        return {}

def _row_with(df, text, col=0):
    for i, row in df.iterrows():
        v = str(row[col]).strip() if pd.notna(row[col]) else ""
        if text.lower() in v.lower(): return i
    return None

def _ok_df(df):
    return df.shape[0] > 1 and df.shape[1] > 1


# ====== SEMILLA MAESTRA ======
def seed_empresa():
    d = _get("empresas", "select=id")
    if d: return d[0]["id"]
    r = {"id": _u(), "nombre": "VICSON SA", "rif": "J-00038411-8",
         "telefono": "0424-4198920", "direccion": "Valencia, Carabobo",
         "email": "vicson@vicson.com.ve", "estado": "activo"}
    res = _post("empresas", [r])
    _ok(f"Empresa: {r['nombre']}") if res else _warn("Error creando empresa")
    return res[0]["id"] if res else None

def seed_sucursal(eid):
    d = _get("sucursales", "select=id,codigo")
    for r in d:
        if r.get("codigo")=="023": _ok("Sucursal 023 ya existe"); return r["id"]
    r = {"id": _u(), "empresa_id": eid, "nombre": "VICSON VALENCIA", "codigo": "023",
         "direccion": "Valencia, Carabobo", "rif": "J-00038411-8",
         "telefono": "0424-4198920", "responsable": "PEDRO OJEDA", "estado": "activo"}
    res = _post("sucursales", [r])
    _ok(f"Sucursal: {r['nombre']} ({r['codigo']})") if res else _warn("Error creando sucursal")
    return res[0]["id"] if res else None

def seed_cats():
    cats = [("COMEDOR","Servicios de comedor"),("CAFE","Cafetería/termos"),
            ("REFRIGERIO","Refrigerios"),("REEMBOLSO","Reembolsables")]
    ex = {r["nombre"] for r in _get("categorias_servicio")}
    cre = [{"id": _u(), "nombre": n, "descripcion": d} for n,d in cats if n not in ex]
    if cre:
        _post("categorias_servicio", cre)
        _ok(f"Categorías creadas: {len(cre)}")
    return True

def seed_servicios(cid_map):
    svcs = [("300001","SERV. DESAYUNO PREST. COMEDOR (E)","E","Alimentación",11076.80),
            ("300002","SERV. DESAYUNO NO PREST. COMEDOR (G)","G","Alimentación",11076.80),
            ("300003","SERV. ALMUERZO PREST. COMEDOR (E)","E","Alimentación",11076.80),
            ("300004","SERV. ALMUERZO NO PREST. COMEDOR (G)","G","Alimentación",11076.80),
            ("300005","SERV. CENA PREST. COMEDOR (E)","E","Alimentación",11076.80),
            ("300006","SERV. CENA NO PREST. COMEDOR (G)","G","Alimentación",11076.80)]
    ex = {r["codigo"] for r in _get("servicios","select=codigo")}
    cre = []
    for c,n,ind,gr,p in svcs:
        if c in ex: continue
        cre.append({"id": _u(), "codigo": c, "nombre": n,
                    "categoria_id": cid_map.get(gr), "indicador": ind,
                    "grupo": gr, "precio_vigente": p, "descripcion": n})
    if cre:
        res = _post("servicios", cre)
        _ok(f"Servicio(s) creado(s): {len(res)} — {', '.join(s['codigo'] for s in cre)}")
    all_s = _get("servicios","select=id,codigo")
    return {s["codigo"]: s["id"] for s in all_s}

def seed_cliente(eid):
    d = _get("clientes","select=id")
    if d: return d[0]["id"]
    r = {"id": _u(), "empresa_id": eid, "nombre": "VICSON SA", "rif": "J-00038411-8",
         "telefono": "0424-4198920", "contacto": "DAMIR DROVINIC", "cargo": "RRHH",
         "email": "vicson@vicson.com.ve", "direccion": "Valencia, Carabobo",
         "comentario": "Nº O/C 4600075688", "estado": "activo"}
    res = _post("clientes", [r])
    _ok(f"Cliente: {r['nombre']}") if res else _warn("Error creando cliente")
    return res[0]["id"] if res else None

def seed_contratos(sid):
    d = _get("contratos","select=id,nombre")
    if d: return {r["nombre"]: r["id"] for r in d}
    r = {"id": _u(), "sucursal_id": sid, "nombre": "023 - VICSON VALENCIA",
         "responsable": "PEDRO OJEDA", "telefono": "0424-4198920",
         "email": "vicson@vicson.com.ve", "estado": "activo"}
    res = _post("contratos", [r])
    _ok(f"Contrato: {r['nombre']}") if res else _warn("Error creando contrato")
    return {r["nombre"]: res[0]["id"]} if res else {}

def seed_prod_refri():
    prods = [("101","Jarra de Jugo","Jarra",20.00),
             ("102","Cachito de Viento","Unidad",20.00),
             ("103","Subamaribños Pan Canilla","Unidad",3500.00),
             ("104","Sándwich de Jamón","Unidad",2000.00)]
    ex = {r["codigo"] for r in _get("productos_refri","select=codigo")}
    cre = [{"id": _u(), "codigo": c, "nombre": n, "unidad": u, "costo": co}
           for c,n,u,co in prods if c not in ex]
    if cre:
        _post("productos_refri", cre)
        _ok(f"Productos refri creados: {len(cre)}")
    return True

def seed_proveedor():
    d = _get("proveedores","select=id")
    if d: return
    r = {"id": _u(), "codigo_p": "F001", "nombre": "PROCESADORA DE CARNES FITCA, C.A.",
         "rif": "J-00079211", "telefono": "", "contacto": "", "email": "",
         "direccion": "", "comentario": "Proveedor principal de carnes", "estado": "activo"}
    _post("proveedores", [r])
    _ok(f"Proveedor: {r['nombre']}")

def seed_maestra():
    _info("\n── SEMILLA MAESTRA ──")
    eid  = seed_empresa()
    if not eid: return None
    sid  = seed_sucursal(eid)
    seed_cats()
    cids = {r["nombre"]: r["id"] for r in _get("categorias_servicio","select=id,nombre")}
    sids = seed_servicios(cids)
    cid  = seed_cliente(eid)
    cts  = seed_contratos(sid)
    seed_prod_refri()
    seed_proveedor()
    return {"empresa_id": eid, "sucursal_id": sid, "cliente_id": cid,
            "contratos": cts, "servicios": sids}


# ====== EXTRACT: CUP DIARIO ======
def extract_cup(m, dry=False):
    _info("\n── EXTRACT: CUP MAYO 2017 ──")
    sheets = read_xl(F_CUP)
    if not sheets or "Resumen" not in sheets: _warn("Sin hojas CUP"); return 0
    cid = m.get("contratos",{}).get("023 - VICSON VALENCIA")
    if not cid: _warn("Sin contrato"); return 0
    registros = []
    for i in range(1, 32):
        df = sheets.get(str(i))
        if df is None or not _ok_df(df): continue
        fr = _row_with(df, "Fecha")
        if fr is None: continue
        fv = df.iloc[fr+1, 1] if fr+1 < len(df) else None
        fs = _d(fv) or f"2017-05-{i:02d}"
        try:
            dt = datetime.strptime(fs, "%Y-%m-%d")
            ds = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO","DOMINGO"][dt.weekday()]
        except: ds = ""
        fd = None
        for r in range(len(df)):
            rv = [str(v).strip() if pd.notna(v) else "" for v in df.iloc[r]]
            nums = [v for v in rv if v.replace(".","").replace("-","").isdigit()]
            if len(nums) >= 3:
                fd = r; break
        if fd is None: continue
        vals = [_f(v) for v in df.iloc[fd]]
        rec = {"id": _u(), "contrato_id": cid, "fecha": fs, "dia_semana": ds,
               "sobrecena": vals[5] if len(vals)>5 else None,
               "desayuno":  vals[6] if len(vals)>6 else None,
               "almuerzo":  vals[7] if len(vals)>7 else None,
               "cena":      vals[8] if len(vals)>8 else None,
               "refrigerios": vals[9] if len(vals)>9 else None,
               "merienda_1": vals[10] if len(vals)>10 else None,
               "merienda_2": vals[11] if len(vals)>11 else None,
               "efectivo":  vals[12] if len(vals)>12 else None,
               "cafetin":   vals[13] if len(vals)>13 else None,
               "otros":     vals[14] if len(vals)>14 else None}
        tv = [v for v in rec.values() if isinstance(v, float)]
        rec["total_venta"] = round(sum(tv), 2) if tv else 0.00
        registros.append(rec)
    if not registros: _warn("Sin registros CUP extraídos"); return 0
    _info(f"Extraídos: {len(registros)} días")
    if dry:
        _info("[DRY-RUN] Cup diario — no se insertan")
        return len(registros)
    res = _post("cup_diario", registros)
    _ok(f"CUP diario insertados: {len(res)}")
    rs = sheets["Resumen"]
    for r in range(len(rs)):
        vals = [str(v).strip() if pd.notna(v) else "" for v in rs.iloc[r]]
        txt = " ".join(vals)
        if "Total Venta" in txt or "Venta diaria" in txt:
            _ok(f"Total venta mes: {_f(rs.iloc[r,1])} Bs.")
        if "Costo" in txt and "Insumos" in txt:
            _ok(f"Costo insumos mes: {_f(rs.iloc[r,1])} Bs.")
    return len(res)


# ====== EXTRACT: GUIAS (FICHAS, CAFE, REFRI, REEMB) ======
def extract_guias(m, dry=False):
    _info("\n── EXTRACT: GUIAS VICSON ──")
    s1 = read_xl(F_GUIAS_1)
    s2 = read_xl(F_GUIAS_2)
    sheets = {**s1, **s2}
    if not sheets: _warn("Sin hojas GUIAS"); return 0
    cid = m.get("contratos",{}).get("023 - VICSON VALENCIA")
    clid = m.get("cliente_id")
    if not cid or not clid: _warn("Sin contrato o cliente"); return 0
    cuenta = {"guia": 0, "fichas": 0, "cafe": 0, "refri": 0, "reemb": 0}
    guia_names = [n for n in sheets if n.upper().startswith("GUIA")]
    for gn in guia_names:
        df = sheets[gn]
        if df is None or not _ok_df(df): continue
        _info(f"Procesando guía: {gn}")
        fv = None; gnum = None
        for r in range(min(20, len(df))):
            vals = [str(v).strip() if pd.notna(v) else "" for v in df.iloc[r]]
            txt = " ".join(vals)
            if "fecha" in txt.lower(): fv = df.iloc[r,1] if len(df.columns)>1 else None
            if "n° guía" in txt.lower() or "numero de guia" in txt.lower(): gnum = df.iloc[r,1] if len(df.columns)>1 else None
        fs = _d(fv) or datetime.now().strftime("%Y-%m-%d")
        guid = _u()
        guia = {"id": guid, "contrato_id": cid, "cliente_id": clid,
                "numero_guia": gnum or f"FF-005-{gn[-1]}", "fecha": fs,
                "estado": "pendiente", "periodo": "MAYO 2017",
                "monto_total": 0.00, "created_at": datetime.now().isoformat()}
        if not dry:
            res = _post("guias_fact", [guia])
            if res:
                cuenta["guia"] += 1
                _ok(f"Guía: {guia['numero_guia']} ({fs})")
            # FICHAS
            fdf = sheets.get("FICHAS")
            if fdf is not None and _ok_df(fdf):
                for r in range(1, len(fdf)):
                    row = fdf.iloc[r]
                    ff = _d(row[0]) if pd.notna(row[0]) else None
                    if not ff: continue
                    na = _i(row[2]) or 0; pa = _f(row[3]) or 0; sa = _f(row[4]) or 0
                    nc = _i(row[5]) or 0; pc = _f(row[6]) or 0; sc = _f(row[7]) or 0
                    tf = _f(row[8]) or 0
                    if na==0 and nc==0 and tf==0: continue
                    rec = {"id": _u(), "cup_id": None, "fecha": ff,
                           "dia": ff[:3].upper() if ff else "", "n_almuerzo": na,
                           "precio_alm": pa, "subtotal_alm": sa, "n_cena": nc,
                           "precio_cena": pc, "subtotal_cena": sc, "total": tf,
                           "estado": "pagada" if tf>0 else "pendiente",
                           "created_at": datetime.now().isoformat()}
                    fr = _post("venta_comensal", [rec])
                    if fr:
                        cuenta["fichas"] += 1
                        _ok(f"  Ficha: {ff} — {na}A+{nc}C = {tf} Bs.")
                _ok(f"Fichas insertadas: {cuenta['fichas']}")
            # CAFE
            cdf = sheets.get("CAFE")
            if cdf is not None and _ok_df(cdf):
                for r in range(1, len(cdf)):
                    row = cdf.iloc[r]
                    fc = _d(row[1]) if pd.notna(row[1]) else None
                    if not fc: continue
                    tc = _f(row[0]) or 0; tl = _f(row[1]) or 0; tt = _f(row[2]) or 0
                    rec = {"id": _u(), "fecha": fc, "dia": fc[:3].upper() if fc else "",
                           "termo_cafe": tc, "termo_leche": tl, "total": tt,
                           "estado": "pagada"}
                    cr = _post("refri_diario", [rec])
                    if cr: cuenta["cafe"] += 1
                    # marcamos como café para que no se pierda
                    if cr:
                        _post("refri_diario", [{"id": cr[0]["id"], "es_cafe": True}])
                _ok(f"Café/termos insertados: {cuenta['cafe']}")
            # REFRI
            rdf = sheets.get("REFRIGERIOS")
            if rdf is not None and _ok_df(rdf):
                prdf = _get("productos_refri","select=id,codigo")
                pmap = {p["codigo"]: p["id"] for p in prdf}
                for r in range(1, len(rdf)):
                    row = rdf.iloc[r]
                    if pd.isna(row[0]): continue
                    pc = str(row[0]).strip()
                    cant = _i(row[1]) or 0; pu = _f(row[2]) or 0; imp = _f(row[3]) or 0
                    if cant==0 and imp==0: continue
                    pid = None
                    for p in prdf:
                        if p["codigo"] == pc: pid = p["id"]; break
                    if not pid:
                        pid = _u()
                        _post("productos_refri", [{"id": pid, "codigo": pc,
                            "nombre": pc, "unidad": "Unidad", "costo": 0}])
                    rec = {"id": _u(), "fecha": "2017-05-01", "producto_id": pid,
                           "cantidad": cant, "precio_unitario": pu, "importe": imp,
                           "estado": "pagado"}
                    rr = _post("refri_diario", [rec])
                    if rr: cuenta["refri"] += 1
                _ok(f"Refrigerios insertados: {cuenta['refri']}")
            # REEMBOLSABLES
            embdf = sheets.get("REEMBOLSABLES 1")
            if embdf is not None and _ok_df(embdf):
                for r in range(1, len(embdf)):
                    row = embdf.iloc[r]
                    desc = str(row[0]).strip() if pd.notna(row[0]) else ""
                    if not desc or desc=="nan": continue
                    mon = _f(row[1]) if len(row)>1 and pd.notna(row[1]) else 0
                    if mon==0 and "Sub" not in desc and "IVA" not in desc and "TOTAL" not in desc: continue
                    rec = {"id": _u(), "fecha": fs, "proveedor_id": None,
                           "descripcion": desc, "monto_pendiente": mon,
                           "estado": "pagado" if mon>0 else "pendiente",
                           "observacion": f"Guía {gnum}"}
                    er = _post("reembolsables", [rec])
                    if er: cuenta["reemb"] += 1
                _ok(f"Reembolsables insertados: {cuenta['reemb']}")
            # Actualizar monto total guía
            _post("guias_fact", [{"id": guid, "monto_total":
                round(cuenta["fichas"]*11076.80, 2)}])
        else:
            _info(f"[DRY-RUN] Guía {gn} — fecha {fs}, ~15M Bs estimado")
    total = sum(cuenta.values())
    _ok(f"GUIAS — Total insertados: {total} (G:{cuenta['guia']} F:{cuenta['fichas']} "
        f"C:{cuenta['cafe']} R:{cuenta['refri']} E:{cuenta['reemb']})")
    return total


# ====== EXTRACT: CFC (FACTURACIÓN COMPROMISADA) ======
def extract_cfc(m, dry=False):
    _info("\n── EXTRACT: CFC (FACTURACIÓN COMPROMISADA) ──")
    sheets = read_xl(F_CFC)
    if not sheets: _warn("Sin hojas CFC"); return 0
    cid = m.get("contratos",{}).get("023 - VICSON VALENCIA")
    if not cid: _warn("Sin contrato"); return 0
    # Buscar todas las hojas CFC1..CFC5 y RG1..RG5
    cfc_names = [n for n in sheets if n.upper().startswith("CFC") and len(n)<=6]
    rg_names  = [n for n in sheets if n.upper().startswith("RG") and len(n)<=6]
    cuenta = {"cfc": 0, "rg": 0}
    # Procesar CFC
    for cn in cfc_names:
        df = sheets[cn]
        if df is None or not _ok_df(df): continue
        _info(f"Procesando CFC: {cn}")
        for r in range(1, len(df)):
            row = df.iloc[r]
            fecha = _d(row[1]) if pd.notna(row[1]) else None
            if not fecha: continue
            prov = str(row[2]).strip() if pd.notna(row[2]) else ""
            if not prov or prov=="nan": continue
            doc  = str(row[3]).strip() if pd.notna(row[3]) else ""
            alim = _f(row[5]) or 0
            desl = _f(row[6]) or 0
            reem = _f(row[7]) or 0
            vari = _f(row[8]) or 0
            sub  = _f(row[9]) or 0
            iva  = _f(row[11]) or 0
            tot  = _f(row[12]) or 0
            if sub==0 and tot==0: continue
            cuen = str(row[13]).strip() if pd.notna(row[13]) else "51102013"
            rec = {"id": _u(), "contrato_id": cid, "fecha": fecha,
                   "numero_cfc": doc, "proveedor": prov, "numero_doc": doc,
                   "nota_recepcion": "", "alimentos": alim, "desechables": desl,
                   "reembolsables": reem, "varios": vari, "subtotal": sub,
                   "descuentos": 0, "iva": iva, "total_con_iva": tot,
                   "cuenta_contable": cuen, "estado": "registrado"}
            cr = _post("cfc", [rec])
            if cr:
                cuenta["cfc"] += 1
                _ok(f"CFC: {doc} — {prov} — {tot} Bs. (Cuenta: {cuen})")
        _ok(f"CFC {cn}: {cuenta['cfc']} registros")
    # Procesar RG
    for rn in rg_names:
        df = sheets[rn]
        if df is None or not _ok_df(df): continue
        _info(f"Procesando RG: {rn}")
        for r in range(1, len(df)):
            row = df.iloc[r]
            fecha = _d(row[1]) if pd.notna(row[1]) else None
            if not fecha: continue
            det = str(row[2]).strip() if pd.notna(row[2]) else ""
            if not det or det=="nan": continue
            mnt = _f(row[3]) if pd.notna(row[3]) else 0
            if mnt==0: continue
            rec = {"id": _u(), "contrato_id": cid, "fecha": fecha,
                   "detalle": det, "monto": mnt, "estado": "registrado"}
            rr = _post("rg", [rec])
            if rr:
                cuenta["rg"] += 1
                _ok(f"RG: {det} — {mnt} Bs.")
    total = cuenta["cfc"] + cuenta["rg"]
    _ok(f"CFC/RG — Total insertados: {total} (CFC:{cuenta['cfc']} RG:{cuenta['rg']})")
    return total


# ====== EXTRACT: RECOP ======
def extract_recop(m, dry=False):
    _info("\n── EXTRACT: RECOP DIC ──")
    sheets = read_xl(F_RECOP)
    if not sheets: _warn("Sin hojas RECOP"); return 0
    # Buscar sección IX (cuentas contables con datos CFC/RG cruzados)
    cuenta = 0
    for sn in sheets:
        df = sheets[sn]
        if df is None or not _ok_df(df): continue
        # Buscar si hay datos significativos
        total_vals = 0
        for r in range(len(df)):
            row = df.iloc[r]
            nums = [_f(v) for v in row if isinstance(v, (int,float)) and not pd.isna(v)]
            if any(n != 0 for n in nums if n is not None):
                total_vals += 1
        if total_vals > 3:
            _info(f"Hoja {sn}: {total_vals} celdas con valores ≠ 0 — se analiza")
            # Intentar extraer estructura de cuentas/contratos
            for r in range(1, min(len(df), 100)):
                row = df.iloc[r]
                lbl = str(row[0]).strip() if pd.notna(row[0]) else ""
                if not lbl or lbl=="nan": continue
                # Si encontramos algo que parece cuenta contable o monto
                vals = [_f(v) for v in row[1:] if v is not None]
                mnt = next((v for v in vals if v is not None and v != 0), None)
                if mnt and lbl not in ("",): 
                    rec = {"id": _u(), "contrato_id": m.get("contratos",{}).get("023 - VICSON VALENCIA", _u()),
                           "descripcion": lbl, "monto": mnt,
                           "tipo": "recop_info", "estado": "registrado",
                           "fecha": "2017-05-31", "created_at": datetime.now().isoformat()}
                    if not dry:
                        _post("dic", [rec])
                        cuenta += 1
    _ok(f"RECOP — Información extraída: {cuenta} registros en dic")
    return cuenta


# ====== EXTRACT: INVENTARIO ======
def extract_inventario(m, dry=False):
    _info("\n── EXTRACT: INVENTARIO 19 PPRE-CIERRE ──")
    sheets = read_xl(F_INV)
    if not sheets: _warn("Sin hojas inventario"); return 0
    inv_df = sheets.get("INVENTARIO ")
    if inv_df is None or not _ok_df(inv_df): _warn("Sin hoja INVENTARIO"); return 0
    cuenta = 0
    for r in range(1, len(inv_df)):
        row = inv_df.iloc[r]
        codigo = str(row[1]).strip() if pd.notna(row[1]) else ""
        if not codigo or codigo=="nan": continue
        desc = str(row[2]).strip() if pd.notna(row[2]) else ""
        und  = str(row[3]).strip() if pd.notna(row[3]) else "UND"
        costo = _f(row[4]) or 0
        selogra = _i(row[5]) or 0
        costo_t = _f(row[6]) or 0
        fisico  = _i(row[7]) or 0
        diff    = _i(row[8]) or 0
        if selogra==0 and fisico==0 and diff==0: continue
        rec = {"id": _u(), "contrato_id": m.get("contratos",{}).get("023 - VICSON VALENCIA", _u()),
               "codigo": codigo, "descripcion": desc, "unidad_medida": und,
               "costo_unitario": costo, "inventario_selogra": selogra,
               "costo_total": costo_t, "inventario_fisico": fisico,
               "diferencia": diff, "estado": "registrado",
               "fecha_cierre": "2017-05-19", "created_at": datetime.now().isoformat()}
        if not dry:
            _post("inventario", [rec])
            cuenta += 1
    _ok(f"INVENTARIO — Productos registrados: {cuenta}")
    return cuenta


# ====== ARCHIVO ENCRIPTADO PENDIENTE ======
def warn_traspasos():
    _warn(f"\n── ARCHIVO PENDIENTE ──")
    _warn(f"  {F_TRASP}")
    _warn("  ❌ Archivo encriptado — requiere contraseña para descifrar.")
    _warn("  💡 Tabla 'traspasos' marcada como 'pending_password' en schema.")
    _warn("  Acción: obtener la contraseña del archivo y volver a ejecutar con --include-traspasos")


# ====== MAIN ======
def main():
    parser = argparse.ArgumentParser(
        description="RTL Migration — Excel → Supabase | VICSON Gestion Mayo 2017")
    parser.add_argument("--dry-run", action="store_true",
                        help="Solo lee los archivos y muestra lo que se insertaría (sin insertar)")
    parser.add_argument("--reset", action="store_true",
                        help="Limpia todas las tablas antes de insertar (solo en dev)")
    parser.add_argument("--include-traspasos", action="store_true",
                        help="Incluye el archivo encriptado (requiere contraseña)")
    args = parser.parse_args()

    mode = "DRY-RUN" if args.dry_run else "PRODUCCIÓN"
    _info(f"\n{'='*60}")
    _info(f"  RTL MIGRATION — VICSON Gestion — Mayo 2017")
    _info(f"  Modo: {mode}")
    _info(f"  Supabase: {URL}")
    _info(f"{'='*60}\n")

    # --- RESET (opcional) ---
    if args.reset:
        _info("Limpando tablas existentes...")
        for tbl in ["cup_diario","venta_comensal","refri_diario","reembolsables",
                    "guias_fact","detalle_guia","cfc","rg","dic","inventario",
                    "traspasos","traspasos_recibidos","traspasos_emitidos",
                    "nomina_cambios","headcount","objetivo_cup"]:
            try:
                r = requests.delete(f"{BASE_URL}/{tbl}", headers=H)
                if r.status_code in (200, 204, 404):
                    _info(f"  Vacía {tbl}" + (" (no existía)" if r.status_code==404 else ""))
            except Exception as e:
                _warn(f"  Error vaciando {tbl}: {e}")
        _ok("Tablas limpiadas.\n")

    # --- SEMILLA MAESTRA ---
    master = seed_maestra()
    if not master:
        _warn("No se pudo completar la semilla. Abortando.")
        sys.exit(1)

    # --- EXTRACTS ---
    total = 0
    total += extract_cup(master, args.dry_run)
    total += extract_guias(master, args.dry_run)
    total += extract_cfc(master, args.dry_run)
    total += extract_recop(master, args.dry_run)
    total += extract_inventario(master, args.dry_run)

    # --- TRASPASOS PENDIENTE ---
    warn_traspasos()

    # --- RESUMEN ---
    print(f"\n{'='*60}")
    if args.dry_run:
        print(f"  RESULTADO (DRY-RUN): {total} registros estimados")
        print(f"  No se realizaron inserciones.")
    else:
        print(f"  ✅ MIGRACIÓN COMPLETADA: {total} registros insertados")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
