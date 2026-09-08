import re
from decimal import Decimal


def extract_document(source_text: str) -> dict[str, object]:
    """Deterministic local stand-in for Azure OCR and AI extraction."""
    invoice_match = re.search(r"INVOICE\s+([A-Z0-9-]+)", source_text, re.IGNORECASE)
    supplier_match = re.search(r"Supplier:\s*(.+)", source_text, re.IGNORECASE)
    total_match = re.search(r"Total:\s*([A-Z]{3})\s*([0-9.]+)", source_text, re.IGNORECASE)
    date_match = re.search(r"Date:\s*(\d{4}-\d{2}-\d{2})", source_text, re.IGNORECASE)

    invoice_number = invoice_match.group(1) if invoice_match else "UNKNOWN"
    supplier = supplier_match.group(1).strip() if supplier_match else "Unknown supplier"
    currency = total_match.group(1).upper() if total_match else "INR"
    total = Decimal(total_match.group(2)) if total_match else Decimal("0")
    invoice_date = date_match.group(1) if date_match else None

    return {
        "invoiceNumber": invoice_number,
        "supplier": supplier,
        "total": float(total),
        "currency": currency,
        "date": invoice_date,
        "summary": f"Invoice {invoice_number} from {supplier}",
    }
