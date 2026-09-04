import pandas as pd, os, warnings
warnings.filterwarnings('ignore')

base = r"C:/Users/Agencia de viajes/OneDrive/Escritorio/CUP vicson"

targets = [
    "CFC+CJC+RG+PXF 2017 vicson valencia.xlsx",
    "CFC+CJC+RG+PXF 2017 vicson valencia.xls",
    "023 - VICSON VALENCIA - RECOP 2017 PRECIERRE MAYO.xlsx",
    "INVENTARIO 19 PPRE-CIERRE.xlsx",
    "CONTROL DE TRASPASOS  VICSON VALENCIA CORTE AL 19 DE MAYO.xls",
]

for fname in targets:
    path = os.path.join(base, fname)
    sz = os.path.getsize(path)
    print(f"\n{'='*90}")
    print(f"ARCHIVO: {fname}  ({sz} bytes)")
    print(f"{'='*90}")
    try:
        xls = pd.ExcelFile(path)
        print(f"Hojas ({len(xls.sheet_names)}): {xls.sheet_names}")
        for sname in xls.sheet_names:
            df = pd.read_excel(path, sheet_name=sname, header=None)
            print(f"\n  --- Hoja '{sname}' | {df.shape[0]} filas × {df.shape[1]} cols ---")
            ne = []
            for i in range(df.shape[0]):
                row = df.iloc[i]
                if any(pd.notna(v) and v != 0 for v in row):
                    ne.append(i+1)
            print(f"  Filas con datos: {ne}")
            show = list(dict.fromkeys(ne))[:30]
            for idx in sorted(show):
                if idx <= df.shape[0]:
                    rv = [str(v)[:100] if pd.notna(v) else "·" for v in df.iloc[idx-1]]
                    print(f"  F{idx}: {rv}")
            if len(ne) > 30:
                print(f"  ... y {len(ne)-30} filas con datos más")
    except Exception as e:
        import traceback
        print(f"  ❌ ERROR: {type(e).__name__}: {e}")
        traceback.print_exc()
