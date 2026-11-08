"""Fast, token-cheap data work on CSV / Excel.

    from clox_kit import data
    df = data.load("/mnt/user-data/uploads/orders.csv")   # sniffs delimiter, encoding, $, %, dates
    data.profile(df)                                       # compact overview — never print a whole frame
    top = data.summarize(df, by="Region", values="Revenue", top=10)
    print(data.md(top, fmt={"Revenue": "money"}))          # exact numbers to quote in the answer
"""
from __future__ import annotations

import csv
import io
import os
import re

from .charts import fmt_value

_NUM = re.compile(r"^\s*[(\-−+]?\s*[$€£¥₹]?\s*[\d,.\s]+\s*[%)]?\s*(k|m|bn|b)?\s*$", re.I)


def _read_text(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return raw.decode(enc), enc
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace"), "utf-8"


def load(path, sheet=None, *, clean=True, **kw):
    """Load CSV/TSV/TXT/XLSX/XLS/JSON/Parquet into a DataFrame. clean=True tidies types."""
    import pandas as pd
    ext = os.path.splitext(path)[1].lower()
    if ext in (".xlsx", ".xlsm", ".xls"):
        xl = pd.ExcelFile(path)
        if sheet is None and len(xl.sheet_names) > 1:
            print(f"sheets: {xl.sheet_names} → loading '{xl.sheet_names[0]}' (pass sheet=... for another)")
        df = xl.parse(sheet if sheet is not None else xl.sheet_names[0], **kw)
        df = _promote_header(df)
    elif ext == ".json":
        df = pd.read_json(path, **kw)
    elif ext == ".parquet":
        df = pd.read_parquet(path, **kw)
    else:
        text, enc = _read_text(path)
        sample = text[:20000]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
            sep = dialect.delimiter
        except csv.Error:
            sep = "\t" if sample.count("\t") > sample.count(",") else ","
        df = pd.read_csv(io.StringIO(text), sep=sep, low_memory=False, **kw)
    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all").dropna(axis=1, how="all")
    df = df.loc[:, [not str(c).startswith("Unnamed") or df[c].notna().any() for c in df.columns]]
    return tidy(df) if clean else df


def _promote_header(df):
    """Excel exports often have a title block above the real header row."""
    import pandas as pd
    if all(not str(c).startswith("Unnamed") for c in df.columns):
        return df
    for i in range(min(10, len(df))):
        row = df.iloc[i]
        if row.notna().mean() > 0.7 and all(isinstance(v, str) for v in row.dropna()):
            new = df.iloc[i + 1:].copy()
            new.columns = [str(v).strip() for v in row.values]
            return new.reset_index(drop=True)
    return df


def _to_number(s):
    import pandas as pd
    x = s.astype(str).str.strip()
    neg = x.str.startswith("(") & x.str.endswith(")")
    pct = x.str.endswith("%")
    mult = x.str.extract(r"(k|m|bn|b)\s*$", flags=re.I)[0].str.lower().map({"k": 1e3, "m": 1e6, "b": 1e9, "bn": 1e9})
    x = x.str.replace(r"[()$€£¥₹%\s]|(k|m|bn|b)$", "", regex=True, flags=re.I).str.replace("−", "-", regex=False)
    # 1.234,56 (EU) vs 1,234.56 (US)
    eu = x.str.contains(r"^\-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$")
    x = x.where(~eu, x.str.replace(".", "", regex=False).str.replace(",", ".", regex=False))
    x = x.str.replace(",", "", regex=False)
    n = pd.to_numeric(x, errors="coerce")
    n = n.where(~neg, -n).where(~pct, n / 100)
    return n * mult.fillna(1)


def tidy(df):
    """Numbers stored as text → numbers, date-like text → dates, trimmed strings."""
    import pandas as pd
    df = df.copy()
    for c in df.columns:
        s = df[c]
        if s.dtype == object or pd.api.types.is_string_dtype(s):
            nn = s.dropna()
            if nn.empty:
                continue
            st = nn.astype(str)
            df[c] = s.where(s.isna(), s.astype(str).str.strip())
            if st.str.match(_NUM).mean() > 0.9:
                df[c] = _to_number(s.where(s.notna(), None).fillna("nan"))
                continue
            name_hint = re.search(r"date|time|day|month|created|updated|at$|_on$", str(c), re.I)
            looks = st.str.match(r"^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}").mean() > 0.8
            if name_hint or looks:
                d = pd.to_datetime(s, errors="coerce", dayfirst=False)
                if d.notna().mean() > 0.85:
                    df[c] = d
    return df


def profile(df, name=None, max_cols=40):
    """Print a compact overview: shape, types, missing, ranges, top values, duplicates."""
    import pandas as pd
    lines = [f"{name or 'data'}: {len(df):,} rows × {df.shape[1]} cols"]
    dup = int(df.duplicated().sum())
    if dup:
        lines.append(f"  ! {dup:,} duplicate rows")
    for c in list(df.columns)[:max_cols]:
        s = df[c]
        miss = s.isna().mean()
        tag = f"{miss:.0%} missing" if miss else ""
        if pd.api.types.is_numeric_dtype(s):
            d = s.describe()
            info = f"num  min {d['min']:,.4g} · median {s.median():,.4g} · max {d['max']:,.4g} · sum {s.sum():,.4g}"
        elif pd.api.types.is_datetime64_any_dtype(s):
            info = f"date {s.min():%Y-%m-%d} → {s.max():%Y-%m-%d}"
        else:
            u = s.nunique(dropna=True)
            top = s.value_counts(dropna=True).head(4)
            tops = ", ".join(f"{str(k)[:24]} ({v:,})" for k, v in top.items())
            info = f"text {u:,} unique" + (" (id?)" if u == len(s) and len(s) > 20 else "") + f" · {tops}"
        lines.append(f"  {str(c)[:30]:<30} {info}" + (f" · {tag}" if tag else ""))
    if df.shape[1] > max_cols:
        lines.append(f"  … {df.shape[1] - max_cols} more columns")
    print("\n".join(lines))


def summarize(df, by, values, agg="sum", *, top=None, share=True, sort=True):
    """Group and aggregate. Adds a 'share' column for sums. Returns a flat DataFrame."""
    vals = [values] if isinstance(values, str) else list(values)
    g = df.groupby(by, dropna=False)[vals].agg(agg).reset_index()
    if sort:
        g = g.sort_values(vals[0], ascending=False)
    if share and agg == "sum" and len(vals) == 1:
        tot = g[vals[0]].sum()
        g["share"] = g[vals[0]] / tot if tot else 0
    if top and len(g) > top:
        rest = g.iloc[top:]
        g = g.iloc[:top].copy()
        other = {c: ("Other" if c in ([by] if isinstance(by, str) else by) else rest[c].sum()) for c in g.columns}
        import pandas as pd
        g = pd.concat([g, pd.DataFrame([other])], ignore_index=True)
    return g.reset_index(drop=True)


def by_period(df, date_col, values, freq="M", agg="sum"):
    """Resample to day/week/month/quarter/year ('D','W','M','Q','Y'). Returns label + value columns."""
    import pandas as pd
    d = df.copy()
    d[date_col] = pd.to_datetime(d[date_col], errors="coerce")
    vals = [values] if isinstance(values, str) else list(values)
    rule = {"M": "MS", "Q": "QS", "Y": "YS"}.get(freq, freq)
    out = d.set_index(date_col)[vals].resample(rule).agg(agg).reset_index()
    fmts = {"D": "%Y-%m-%d", "W": "%Y-%m-%d", "M": "%b %Y", "Q": None, "Y": "%Y"}
    if freq == "Q":
        out["period"] = out[date_col].dt.year.astype(str) + " Q" + out[date_col].dt.quarter.astype(str)
    else:
        f = fmts.get(freq, "%Y-%m-%d")
        if freq == "M" and out[date_col].dt.year.nunique() == 1:
            f = "%b"
        out["period"] = out[date_col].dt.strftime(f)
    return out[["period"] + vals]


def change(new, old):
    """Signed change label: (120, 100) → '+20%'."""
    if not old:
        return "n/a"
    p = (new - old) / abs(old)
    return f"{'+' if p >= 0 else '−'}{abs(p) * 100:.0f}%"


def md(df, n=20, fmt=None):
    """Markdown table of the first n rows with formatted numbers — paste into the answer."""
    import pandas as pd
    fmt = fmt or {}
    d = df.head(n)
    cols = [str(c) for c in d.columns]
    out = ["| " + " | ".join(cols) + " |", "|" + "|".join("---:" if pd.api.types.is_numeric_dtype(d[c]) else "---" for c in d.columns) + "|"]
    for _, r in d.iterrows():
        cells = []
        for c in d.columns:
            v = r[c]
            f = fmt.get(c) or ("pct" if str(c) == "share" else None)
            if f:
                cells.append(fmt_value(v, f))
            elif isinstance(v, float):
                cells.append(f"{v:,.2f}")
            elif hasattr(v, "strftime"):
                cells.append(v.strftime("%Y-%m-%d"))
            else:
                cells.append(f"{v:,}" if isinstance(v, int) else str(v))
        out.append("| " + " | ".join(cells) + " |")
    if len(df) > n:
        out.append(f"\n_{len(df) - n:,} more rows_")
    return "\n".join(out)


money = lambda v, sym="$": fmt_value(v, f"money:{sym}")  # noqa: E731
pct = lambda v: fmt_value(v, "pct")  # noqa: E731
