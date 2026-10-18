# TDS 2026-09 GA2 — single service answering Q3/4/5/7/8/11/12

Deploy this folder as its own service, then paste the base URL (or base+path) into each question.

| Q | Paste |
|---|---|
| 3  | `<BASE>` |
| 4  | `<BASE>/verify` |
| 5  | `<BASE>/effective-config` |
| 7  | `<BASE>/analytics` |
| 8  | `<BASE>` |
| 11 | `<BASE>` |
| 12 | `<BASE>` |

Local run: `pip install -r requirements.txt && uvicorn main:app --port 8000`
