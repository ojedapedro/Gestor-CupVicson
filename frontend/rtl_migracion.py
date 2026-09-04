def extract_cup_diario(master: dict, dry_run: bool = False) -> int:
    """Extrae los 31 días del CUP y los inserta"""
    print("\n── EXTRACCIÓN: CUP MAYO 2017 ──")
    sheets = read_excel_file(ARCHIVO_CUP)
    if not sheets:
        return 0

    # Hojas del 1 al 31 (días)
    contrato_id = master["contratos"].get("023 - VICSON VALENCIA")
    if not contrato_id:
        log_warn("No hay contrato '023 - VICSON VALENCIA'. Se omite CUP.")
        return 0

    registros_cup = []
    registros_comensal = []

    total_insertados = 0
    for i in range(1, 32):
        sheet_name = str(i)
        df = sheets.get(sheet_name)
        if df is None or not sheet_has_data(df):
            continue

        # Buscar fecha
        fecha_row = find_row(df, "Fecha")
        if fecha_row is None:
            continue
        fecha_val = df.iloc[fecha_row + 1, 1] if fecha_row + 1 < len(df) else None
        fecha_str = to_date(fecha_val)
        if not fecha_str:
            fecha_str = f"2017-05-{i:02d}"

        # Determinar día de la semana
        try:
            dt = datetime.strptime(fecha_str, "%Y-%m-%d")
            dias = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"]
            dia_semana = dias[dt.weekday()]
        except Exception:
            dia_semana = ""

        # Extraer valores de servicios (fila 15)
        fila_datos = None
        for r in range(len(df)):
            row_vals = [str(v).strip() if pd.notna(v) else "" for v in df.iloc[r]]
            if any("Sobrecena" in v or "SObrecena" in v for v in row_vals):
                continue
            if len([v for v in row_vals if v]) >= 3:
                fila_datos = r
                break

        if fila_datos is None:
            continue

        row = df.iloc[fila_datos]
        values = [to_float(v) for v in row]

        # Asignar según posición (ajustar según estructura real)
        # Columna típica: [0]..., [5] Sobrecena, [6] Desayuno, [7] Almuerzo...
        sobrecena = values[5] if len(values) > 5 else None
        desayuno = values[6] if len(values) > 6 else None
        almuerzo = values[7] if len(values) > 7 else None
        cena = values[8] if len(values) > 8 else None
        refrigerios = values[9] if len(values) > 9 else None
        merienda_1 = values[10] if len(values) > 10 else None
        merienda_2 = values[11] if len(values) > 11 else None
        efectivo = values[12] if len(values) > 12 else None
        cafetin = values[13] if len(values) > 13 else None
        otros = values[14] if len(values) > 14 else None

        # Calcular total_venta si tenemos datos
        total_venta = None
        ventas = [sobrecena, desayuno, almuerzo, cena, refrigerios, merienda_1,
                  merienda_2, efectivo, cafetin, otros]
        if any(v is not None for v in ventas):
            total_venta = round(sum(v for v in ventas if v is not None), 2)

        registro = {
            "id": gen_uuid(),
            "contrato_id": contrato_id,
            "fecha": fecha_str,
            "dia_semana": dia_semana,
            "sobrecena": sobrecena,
            "desayuno": desayuno,
            "almuerzo": almuerzo,
            "cena": cena,
            "refrigerios": refrigerios,
            "merienda_1": merienda_1,
            "merienda_2": merienda_2,
            "efectivo": efectivo,
            "cafetin": cafetin,
            "otros": otros,
            "total_venta": total_venta,
        }
        registros_cup.append(registro)

    if registros_cup:
        log_info(f"Registros CUP extraídos: {len(registros_cup)}")
        if not dry_run:
            result = supabase_insert("cup_diario", registros_cup)
            total_insertados = len(result)
            log_ok(f"CUP diario insertados: {total_insertados}")

            # Extraer datos de Resumen (línea F17 de Resumen = totales)
            resumen = sheets.get("Resumen")
            if resumen is not None:
                log_info("Resumen CUP: procesando totales...")
                # Buscar filas con 'Total' o 'Costo'
                for r in range(len(resumen)):
                    vals = [str(v).strip() if pd.notna(v) else "" for v in resumen.iloc[r]]
                    text = " ".join(vals)
                    if "Total Venta" in text:
                        total_val = to_float(resumen.iloc[r, 1])
                        log_ok(f"Total venta mes (Resumen): {total_val} Bs.")
                    if "Costo" in text and "Insumos" in text:
                        costo_val = to_float(resumen.iloc[r, 1])
                        log_ok(f"Costo insumos (Resumen): {costo_val} Bs.")

    return total_insertados
