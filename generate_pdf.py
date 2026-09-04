#!/usr/bin/env python3
"""Generate PDF audit report from HTML using Playwright (if available) or fallback."""

import os
import sys
from pathlib import Path

HTML_PATH = Path(r"C:\Users\Agencia de viajes\OneDrive\Escritorio\CUP vicson\AUDIT_REPORT.html")
PDF_PATH = Path(r"C:\Users\Agencia de viajes\OneDrive\Escritorio\CUP vicson\AUDIT_REPORT.pdf")

def generate_pdf():
    # Try Playwright first
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(f"file://{HTML_PATH}")
            page.wait_for_load_state("networkidle")
            page.pdf(path=str(PDF_PATH), format="A4", margin={"top": "2cm", "bottom": "2cm", "left": "2cm", "right": "2cm"})
            browser.close()
        print(f"✅ PDF generado: {PDF_PATH}")
        return True
    except ImportError:
        pass

    # Try pdfkit (wkhtmltopdf)
    try:
        import pdfkit
        pdfkit.from_file(str(HTML_PATH), str(PDF_PATH))
        print(f"✅ PDF generado (pdfkit): {PDF_PATH}")
        return True
    except ImportError:
        pass

    # Try weasyprint
    try:
        from weasyprint import HTML
        HTML(filename=str(HTML_PATH)).write_pdf(str(PDF_PATH))
        print(f"✅ PDF generado (weasyprint): {PDF_PATH}")
        return True
    except ImportError:
        pass

    # Fallback: aviso
    print("⚠️ No se encontró herramienta PDF disponible.")
    print("   Opciones:")
    print(f"   1. Instalar playwright: pip install playwright && playwright install chromium")
    print(f"   2. Instalar pdfkit: pip install pdfkit && instalar wkhtmltopdf")
    print(f"   3. Usar el HTML directamente: abrir {HTML_PATH} en el navegador")
    print(f"   4. Imprimir el HTML como PDF desde el navegador (Ctrl+P)")
    return False

if __name__ == "__main__":
    if not HTML_PATH.exists():
        print(f"❌ HTML no encontrado: {HTML_PATH}")
        sys.exit(1)
    generate_pdf()
