# Sample documents

All synthetic — safe to upload through the dashboard. The mock extractor
(`services/worker/app/mock_ai.py`) looks for `INVOICE <id>`, `Supplier: ...`,
`Total: <CCY> <amount>`, and `Date: YYYY-MM-DD` lines; anything else falls back to
`UNKNOWN`/`Unknown supplier`/`0`/`null`.

| File | Use it to test |
| --- | --- |
| `invoice-northwind.txt` | Normal upload, Alice / org-northwind |
| `invoice-contoso.txt` | Normal upload, Bob / org-contoso |
| `invoice-acme-usd.txt` | Normal upload with a different currency (USD) |
| `invoice-globex-eur.txt` | Normal upload with a different currency (EUR) |
| `invoice-fabrikam-large.txt` | A larger total amount |
| `invoice-missing-fields.txt` | The extractor's fallback defaults (no invoice number, supplier, total, or date present) |

Handy manual tests with these files:

- **Auto-refresh (Issue B1 fix):** upload any file, open its detail page, and leave the tab
  untouched — status should flip to `Completed` on its own within ~3s of the mock worker
  finishing, no Refresh click needed.
- **Retry race (Issue B2 fix):** upload a file, then click **Retry processing** within a
  second or two (before the first attempt's ~8s mock delay finishes). The final result
  should reflect the *latest* attempt — check the summary text ends with the higher attempt
  number.
- **Cross-tenant access (Issue C fix):** upload as Alice, copy the document's id from the
  URL, switch the demo identity to Bob, and try opening `/documents/<that id>` — should be
  `404`, not Alice's data.
- **Duplicate upload (Issue A, documented not fixed):** upload the same file twice quickly
  (or double-click Upload) — you'll see two rows for it on the dashboard instead of one.
