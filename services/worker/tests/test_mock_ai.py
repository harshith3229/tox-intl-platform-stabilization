from app.mock_ai import extract_document


def test_extracts_supported_invoice_fields() -> None:
    result = extract_document(
        """INVOICE NW-1042
Supplier: Example Office Supplies
Total: INR 12450.00
Date: 2026-08-01
"""
    )

    assert result == {
        "invoiceNumber": "NW-1042",
        "supplier": "Example Office Supplies",
        "total": 12450.0,
        "currency": "INR",
        "date": "2026-08-01",
        "summary": "Invoice NW-1042 from Example Office Supplies",
    }


def test_uses_safe_defaults_for_missing_fields() -> None:
    result = extract_document("A document with no recognised fields")

    assert result["invoiceNumber"] == "UNKNOWN"
    assert result["supplier"] == "Unknown supplier"
    assert result["total"] == 0.0
